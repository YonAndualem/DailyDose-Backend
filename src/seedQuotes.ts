import { db } from './db/index';
import { categories, quotes } from './db/schema';
import { generateWithGemini } from './gemini';
import { eq, and, between } from 'drizzle-orm';
import { parseQuoteAndAuthor } from './utils/parseQuoteAndAuthor';
import { cleanGeminiOutput } from './utils/cleanGeminiOutput';

// --- Prompt templates for randomization ---
const promptVariants = [
    (cat: string) => `Share a famous ${cat} quote. Format: [quote text] - [author]. Only the quote, nothing else.`,
    (cat: string) => `Give me a well-known ${cat} quote, only the quote and author in this format: [quote text] - [author]. No extra text.`,
    (cat: string) => `Provide a ${cat} quote by a notable person. Respond with only the quote, formatted: [quote text] - [author].`,
    (cat: string) => `What is an inspiring ${cat} quote? Please reply with just the quote and author, formatted as: [quote text] - [author].`,
    (cat: string) => `Only return a famous ${cat} quote and its author. Use this exact format: [quote text] - [author]. No explanations.`
];

// --- Gemini Free Tier Rate Limits ---
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_REQUESTS_PER_DAY = 250;
const MIN_DELAY_BETWEEN_REQUESTS = 6000; // 6 seconds (10 RPM)

let requestsThisMinute = 0;
let requestsThisDay = 0;
let minuteWindowStart = Date.now();

async function rateLimit() {
    if (requestsThisDay >= MAX_REQUESTS_PER_DAY) {
        throw new Error('Gemini API daily request limit reached. Halting.');
    }
    // Reset per-minute window if needed
    const now = Date.now();
    if (now - minuteWindowStart >= 60_000) {
        requestsThisMinute = 0;
        minuteWindowStart = now;
    }
    if (requestsThisMinute >= MAX_REQUESTS_PER_MINUTE) {
        const wait = 60_000 - (now - minuteWindowStart);
        console.log(`Gemini RPM exceeded, waiting ${(wait / 1000).toFixed(1)} seconds...`);
        await new Promise(res => setTimeout(res, wait));
        requestsThisMinute = 0;
        minuteWindowStart = Date.now();
    } else if (requestsThisMinute > 0) {
        // Wait at least 6s between requests
        await new Promise(res => setTimeout(res, MIN_DELAY_BETWEEN_REQUESTS));
    }
    requestsThisMinute++;
    requestsThisDay++;
}

// Exponential backoff: at least 30 seconds, doubles each retry, max 5 minutes
async function generateWithGeminiWithRetry(prompt: string, retries = 5, minDelay = 30000, maxDelay = 300000): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            await rateLimit();
            return await generateWithGemini(prompt);
        } catch (err: any) {
            if ((err?.error?.code === 503 || err?.error?.code === 429) && i < retries - 1) {
                const backoff = Math.min(minDelay * Math.pow(2, i), maxDelay);
                console.log(`Gemini overloaded or quota exceeded, retrying in ${Math.round(backoff / 1000)} seconds...`);
                await new Promise(res => setTimeout(res, backoff));
            } else {
                throw err;
            }
        }
    }
    throw new Error('Gemini API repeatedly overloaded, giving up.');
}

export async function seedDailyQuotes() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const allCategories = await db.select().from(categories);
    console.log('Found categories:', allCategories.map(c => c.name));

    let totalRequestsPlanned = 0;
    for (const cat of allCategories) {
        // See how many quotes are left to create for this category today
        const countQuotes = await db
            .select({ quote: quotes.quote })
            .from(quotes)
            .where(
                and(
                    eq(quotes.category_id, cat.id),
                    eq(quotes.type, 'daily'),
                    between(quotes.date, today, tomorrow)
                )
            );
        let count = countQuotes.length;
        totalRequestsPlanned += Math.max(0, 5 - count);
    }
    if (totalRequestsPlanned > MAX_REQUESTS_PER_DAY) {
        console.log(`Would exceed daily Gemini quota (${MAX_REQUESTS_PER_DAY}). Only seeding the first ${MAX_REQUESTS_PER_DAY} missing quotes.`);
    }

    let usedUpToday = 0;
    for (const cat of allCategories) {
        // Get all quotes for this category today
        const countQuotes = await db
            .select({ quote: quotes.quote })
            .from(quotes)
            .where(
                and(
                    eq(quotes.category_id, cat.id),
                    eq(quotes.type, 'daily'),
                    between(quotes.date, today, tomorrow)
                )
            );

        let count = countQuotes.length;
        const usedQuotesList = countQuotes.map(q => `"${q.quote}"`).join(', ');

        console.log(`Category "${cat.name}" has ${count} quotes for today.`);

        let attempts = 0;
        for (let i = count; i < 5 && attempts < 20 && usedUpToday < MAX_REQUESTS_PER_DAY;) {
            const randomIndex = Math.floor(Math.random() * promptVariants.length);
            let prompt = promptVariants[randomIndex](cat.name);

            if (usedQuotesList.length > 0)
                prompt += ` Do NOT use any of these quotes: ${usedQuotesList}`;

            let rawGemini: string;
            try {
                rawGemini = await generateWithGeminiWithRetry(prompt, 5, 30000, 300000);
            } catch (err) {
                console.error(`Failed to fetch quote for ${cat.name}:`, err);
                attempts++;
                continue;
            }
            const cleaned = cleanGeminiOutput(rawGemini);
            const { quote, author } = parseQuoteAndAuthor(cleaned);

            // Check for duplicates for this category and date
            const existingQuote = await db
                .select()
                .from(quotes)
                .where(
                    and(
                        eq(quotes.category_id, cat.id),
                        eq(quotes.type, 'daily'),
                        between(quotes.date, today, tomorrow),
                        eq(quotes.quote, quote)
                    )
                )
                .limit(1);

            if (existingQuote.length > 0) {
                console.log('Duplicate quote found, retrying...');
                attempts++;
                continue;
            }

            // Insert if unique
            try {
                const inserted = await db
                    .insert(quotes)
                    .values({
                        quote,
                        author: author || 'Unknown',
                        category_id: cat.id,
                        type: 'daily',
                        date: today,
                    })
                    .returning();

                console.log(`Inserted for category ${cat.name}: "${quote}" - ${author}`);
                i++;
                count++;
                usedUpToday++;
            } catch (err) {
                console.error('Insert failed:', err);
            }
            attempts++;
        }
        if (usedUpToday >= MAX_REQUESTS_PER_DAY) {
            console.log('Reached the Gemini daily request limit. Stopping further seeding.');
            break;
        }
    }
}

if (require.main === module) {
    seedDailyQuotes()
        .then(() => console.log('Seeding daily quotes complete!'))
        .catch(err => console.error('Seeding daily quotes error:', err));
}