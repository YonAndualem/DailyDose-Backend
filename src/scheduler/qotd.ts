import cron from 'node-cron';
import { db } from '../db/index';
import { categories, quotes } from '../db/schema';
import { generateWithGemini } from '../gemini';
import { eq, and, between } from 'drizzle-orm';

function parseQuoteAndAuthor(geminiText: string): { quote: string; author: string } {
    const match = geminiText.match(/^["“”']?(.*?)[.?!]["“”']?\s*-\s*(.+)$/);
    if (match) {
        return {
            quote: match[1].trim(),
            author: match[2].trim(),
        };
    }
    return {
        quote: geminiText.trim(),
        author: 'Unknown',
    };
}

// Schedule to run every day at midnight UTC
cron.schedule('0 0 * * *', async () => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setUTCDate(today.getUTCDate() + 1);

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

            if (existingQOTD) continue; // Skip if already exists

            // Generate quote for this category
            const rawGemini = await generateWithGemini(
                `Give me a daily quote in the category ${cat.name}.`
            );
            const { quote: parsedQuote, author: parsedAuthor } = parseQuoteAndAuthor(rawGemini);

            await db
                .insert(quotes)
                .values({
                    quote: parsedQuote,
                    author: parsedAuthor || 'Unknown',
                    category_id: cat.id,
                    type: 'daily',
                    date: today,
                });

            console.log(`Generated QOTD for category ${cat.name}: "${parsedQuote}" - ${parsedAuthor}`);
        }
    } catch (err) {
        console.error('QOTD scheduler error:', err);
    }
});