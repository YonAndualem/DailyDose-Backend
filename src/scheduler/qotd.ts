import cron from 'node-cron';
import { db } from '../db/index';
import { categories, quotes } from '../db/schema';
import { generateWithGemini } from '../gemini';
import { eq, and, between } from 'drizzle-orm';

// Regex rewritten to avoid /s flag (dotAll), using [\s\S] for dotAll behavior
function parseQuoteAndAuthor(geminiText: string): { quote: string; author: string } {
    // Remove leading explanations or intro lines (e.g., "Here's a daily quote...")
    let cleaned = geminiText.replace(/^.*?:\s*\n+/g, '').trim();

    // Match quote and author (across multiple lines)
    const match = cleaned.match(/["“”']?([\s\S]*?)[.!?]?"?\s*-\s*([^\n]+)$/);
    if (match) {
        return {
            quote: match[1].replace(/^["“”']|["“”']$/g, '').trim(),
            author: match[2].trim(),
        };
    }
    // Fallback: no author found
    return {
        quote: cleaned.trim(),
        author: 'Unknown',
    };
}

// Retry wrapper for Gemini requests with exponential backoff
async function generateWithGeminiWithRetry(prompt: string, retries = 5, delay = 2000): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            return await generateWithGemini(prompt);
        } catch (err: any) {
            if (err?.error?.code === 503 && i < retries - 1) {
                console.log(`Gemini overloaded, retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw err;
            }
        }
    }
    throw new Error('Gemini API repeatedly overloaded, giving up.');
}

// Schedule to run every day at midnight UTC
cron.schedule('0 0 * * *', async () => {
    try {
        const now = new Date();
        console.log('QOTD cron job triggered at', now.toISOString());

        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

        // Get all categories
        const allCategories = await db.select().from(categories);

        for (const cat of allCategories) {
            // Check if a daily quote already exists for this category today
            const [existingQOTD] = await db
                .select()
                .from(quotes)
                .where(
                    and(
                        eq(quotes.type, 'daily'),
                        eq(quotes.category_id, cat.id),
                        between(quotes.date, today, tomorrow)
                    )
                )
                .limit(1);

            if (existingQOTD) {
                console.log(`QOTD already exists for category ${cat.name} on ${today.toISOString()}`);
                continue; // Skip if already exists
            }

            // Generate quote for this category, with retries if Gemini is overloaded
            let rawGemini: string;
            try {
                rawGemini = await generateWithGeminiWithRetry(
                    `Give me a daily quote in the category ${cat.name}.`
                );
            } catch (err) {
                console.error(`Failed to fetch quote for category ${cat.name}:`, err);
                continue;
            }
            const { quote: parsedQuote, author: parsedAuthor } = parseQuoteAndAuthor(rawGemini);

            const inserted = await db
                .insert(quotes)
                .values({
                    quote: parsedQuote,
                    author: parsedAuthor || 'Unknown',
                    category_id: cat.id,
                    type: 'daily',
                    date: today,
                })
                .returning();

            console.log(`Generated QOTD for category ${cat.name}: "${parsedQuote}" - ${parsedAuthor}`);
            console.log('Inserted QOTD:', inserted);
        }
    } catch (err) {
        console.error('QOTD scheduler error:', err);
    }
});