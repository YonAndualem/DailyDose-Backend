import { db } from './db/index';
import { categories, quotes } from './db/schema';
import { generateWithGemini } from './gemini';
import { eq, and, between } from 'drizzle-orm';

function parseQuoteAndAuthor(geminiText: string): { quote: string; author: string } {
    let cleaned = geminiText.replace(/^.*?:\s*\n+/g, '').trim();
    const match = cleaned.match(/["“”']?([\s\S]*?)[.!?]?"?\s*-\s*([^\n]+)$/);
    if (match) {
        return {
            quote: match[1].replace(/^["“”']|["“”']$/g, '').trim(),
            author: match[2].trim(),
        };
    }
    return { quote: cleaned.trim(), author: 'Unknown' };
}

async function generateWithGeminiWithRetry(prompt: string, retries = 5, delay = 2000): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            return await generateWithGemini(prompt);
        } catch (err: any) {
            if (err?.error?.code === 503 && i < retries - 1) {
                console.log(`Gemini overloaded, retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
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
        console.log(`Checking for existing quote for category ${cat.name} on ${today.toISOString()}`);

        const [existing] = await db
            .select()
            .from(quotes)
            .where(
                and(
                    eq(quotes.category_id, cat.id),
                    eq(quotes.type, 'daily'),
                    between(quotes.date, today, tomorrow)
                )
            )
            .limit(1);

        if (existing) {
            console.log(`Quote already exists for category ${cat.name} for today, skipping.`);
            continue;
        }

        console.log(`Generating quote for category ${cat.name}...`);
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

        console.log(`Inserting for category ${cat.name}: "${quote}" - ${author}`);
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

            console.log('Inserted:', inserted);
        } catch (err) {
            console.error('Insert failed:', err);
        }
    }
}

if (require.main === module) {
    seedDailyQuotes()
        .then(() => console.log('Seeding daily quotes complete!'))
        .catch(err => console.error('Seeding daily quotes error:', err));
}