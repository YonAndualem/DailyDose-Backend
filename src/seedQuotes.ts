import { db } from './db/index';
import { categories, quotes } from './db/schema';
import { generateWithGemini } from './gemini';
import { eq, and, between } from 'drizzle-orm';
import { parseQuoteAndAuthor } from './utils/parseQuoteAndAuthor';
import { cleanGeminiOutput } from './utils/cleanGeminiOutput';

async function generateWithGeminiWithRetry(prompt: string, retries = 5, delay = 2000): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            return await generateWithGemini(prompt);
        } catch (err: any) {
            if ((err?.error?.code === 503 || err?.error?.code === 429) && i < retries - 1) {
                const backoff = delay * (i + 1);
                console.log(`Gemini overloaded or quota exceeded, retrying in ${backoff}ms...`);
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

    for (const cat of allCategories) {
        // Count how many daily quotes exist for this category today
        const countQuotes = await db
            .select()
            .from(quotes)
            .where(
                and(
                    eq(quotes.category_id, cat.id),
                    eq(quotes.type, 'daily'),
                    between(quotes.date, today, tomorrow)
                )
            );

        let count = countQuotes.length;
        console.log(`Category "${cat.name}" has ${count} quotes for today.`);

        let attempts = 0;
        for (let i = count; i < 5 && attempts < 20;) {
            const prompt = `Give me only the text of a famous ${cat.name} quote, in the format: [quote] - [author]. No explanation, no introduction, just the quote.`;
            let rawGemini: string;
            try {
                rawGemini = await generateWithGeminiWithRetry(prompt);
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
            } catch (err) {
                console.error('Insert failed:', err);
            }
            attempts++;
        }
    }
}

if (require.main === module) {
    seedDailyQuotes()
        .then(() => console.log('Seeding daily quotes complete!'))
        .catch(err => console.error('Seeding daily quotes error:', err));
}