import { db } from './db/index';
import { categories, quotes } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { generateWithGemini } from './gemini';

export async function seedDailyQuotes() {
    const allCategories = await db.select().from(categories);

    for (const cat of allCategories) {
        // Get all daily quotes for this category
        const dailyQuotes = await db
            .select()
            .from(quotes)
            .where(
                and(
                    eq(quotes.category_id, cat.id),
                    eq(quotes.type, 'daily')
                )
            );

        const count = dailyQuotes.length;

        for (let i = count; i < 5; i++) {
            const generatedQuote: string = await generateWithGemini(
                `Give me a daily quote in the category ${cat.name}.`
            );
            await db.insert(quotes).values({
                quote: generatedQuote,
                author: 'Unknown',
                category_id: cat.id,
                type: 'daily',
                date: new Date(),
            });
        }
    }
}