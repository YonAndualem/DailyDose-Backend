import { db } from './db/index';
import { categories, quotes } from './db/schema';
import { generateWithGemini } from './gemini';
import { eq } from 'drizzle-orm';

// Improved parseQuoteAndAuthor function for various Gemini formats
function parseQuoteAndAuthor(geminiText: string): { quote: string; author: string } {
    // Remove leading explanations or intro lines (e.g., "Here's a daily quote...")
    let cleaned = geminiText.replace(/^.*?:\s*\n+/g, '').trim();

    // Try to extract the last occurrence of - Author (with optional quotes)
    // Accepts both straight and curly quotes, works across lines
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
            // Check for Gemini overload error
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

export async function seedDailyQuotes() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const allCategories = await db.select().from(categories);

    for (const cat of allCategories) {
        // Check if already seeded for today
        const [existing] = await db
            .select()
            .from(quotes)
            .where(
                eq(quotes.category_id, cat.id)
            )
            .limit(1);

        if (existing) {
            console.log(`Quote already exists for category ${cat.name}, skipping.`);
            continue;
        }

        let rawGemini: string;
        try {
            rawGemini = await generateWithGeminiWithRetry(
                `Give me a daily quote in the category ${cat.name}.`
            );
        } catch (err) {
            console.error(`Failed to fetch quote for ${cat.name}:`, err);
            continue;
        }
        const { quote, author } = parseQuoteAndAuthor(rawGemini);

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
        console.log('Inserted:', inserted);
    }
}

if (require.main === module) {
    seedDailyQuotes()
        .then(() => console.log('Seeding daily quotes complete!'))
        .catch(err => console.error('Seeding daily quotes error:', err));
}