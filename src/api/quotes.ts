import express from 'express';
import { db } from '../db/index';
import { quotes, categories } from '../db/schema';
import { ilike, eq, and, or, between } from 'drizzle-orm';
import { generateWithGemini } from '../gemini';

// Utility function to parse quote and author from Gemini response
function parseQuoteAndAuthor(geminiText: string): { quote: string; author: string } {
    // Matches: "Something here." - Someone
    const match = geminiText.match(/^["“”']?(.*?)[.?!]["“”']?\s*-\s*(.+)$/);
    if (match) {
        return {
            quote: match[1].trim(),
            author: match[2].trim(),
        };
    }
    // If not matched, fallback
    return {
        quote: geminiText.trim(),
        author: 'Unknown'
    };
}

const router = express.Router();

// Create a quote powered by Gemini
router.post('/', async (req, res) => {
    try {
        const { category, author, type, date } = req.body;

        if (!category) {
            return res.status(400).json({ error: 'Category is required.' });
        }

        // Look up category by name (case-insensitive)
        const [categoryRecord] = await db
            .select()
            .from(categories)
            .where(ilike(categories.name, String(category)))
            .limit(1);

        if (!categoryRecord) {
            return res.status(400).json({ error: `Category "${category}" not found.` });
        }

        // Build Gemini prompt
        let prompt = `Give me a quote`;
        if (author) prompt += ` by ${author}`;
        prompt += ` in the category ${categoryRecord.name}.`;
        if (type) prompt += ` The quote type is ${type}.`;
        if (date) prompt += ` For the date ${date}.`;

        // Call Gemini to generate the quote
        const rawGemini = await generateWithGemini(prompt);
        const { quote: parsedQuote, author: parsedAuthor } = parseQuoteAndAuthor(rawGemini);

        const finalAuthor = author || parsedAuthor || 'Unknown';

        // Insert the new quote
        const [newQuote] = await db
            .insert(quotes)
            .values({
                quote: parsedQuote,
                author: finalAuthor,
                category_id: categoryRecord.id,
                type: type ?? 'daily',
                date: date ? new Date(date) : new Date(),
            })
            .returning();

        res.status(201).json({ message: 'Quote created', quote: newQuote });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// List quotes, filter by category and author only
router.get('/', async (req, res) => {
    try {
        const { category, author } = req.query;

        let whereClause = [];
        if (category) {
            const [cat] = await db.select().from(categories).where(ilike(categories.name, String(category))).limit(1);
            if (cat) whereClause.push(eq(quotes.category_id, cat.id));
            else return res.status(200).json([]); // No such category, return empty
        }
        if (author) whereClause.push(ilike(quotes.author, `%${String(author)}%`));

        const q = db
            .select({
                id: quotes.id,
                uuid: quotes.uuid,
                quote: quotes.quote,
                author: quotes.author,
                category: categories.name,
                type: quotes.type,
                date: quotes.date,
            })
            .from(quotes)
            .leftJoin(categories, eq(quotes.category_id, categories.id))
            .where(whereClause.length ? and(...whereClause) : undefined);

        const result = await q;
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// Get quote by id
router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

        const [quoteData] = await db
            .select({
                id: quotes.id,
                uuid: quotes.uuid,
                quote: quotes.quote,
                author: quotes.author,
                category: categories.name,
                type: quotes.type,
                date: quotes.date,
            })
            .from(quotes)
            .leftJoin(categories, eq(quotes.category_id, categories.id))
            .where(eq(quotes.id, id))
            .limit(1);

        if (!quoteData) return res.status(404).json({ error: 'Quote not found.' });
        res.json(quoteData);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// Edit quote (manual, not Gemini-powered)
router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { quote, author, category, type, date } = req.body;
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

        const [existing] = await db.select().from(quotes).where(eq(quotes.id, id));
        if (!existing) return res.status(404).json({ error: 'Quote not found.' });

        let category_id;
        if (category) {
            const [cat] = await db.select().from(categories).where(ilike(categories.name, String(category))).limit(1);
            if (!cat) return res.status(400).json({ error: `Category "${category}" not found.` });
            category_id = cat.id;
        }

        await db.update(quotes)
            .set({
                quote: quote ?? existing.quote,
                author: author ?? existing.author,
                type: type ?? existing.type,
                date: date ? new Date(date) : existing.date,
                ...(category_id && { category_id }),
            })
            .where(eq(quotes.id, id));

        res.json({ message: 'Quote updated.' });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// Delete quote
router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

        const result = await db.delete(quotes).where(eq(quotes.id, id)).returning();
        if (result.length === 0) return res.status(404).json({ error: 'Quote not found.' });

        res.json({ message: 'Quote deleted.' });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// Quote of the Day endpoint: GET /api/quotes/random/of-the-day
router.get('/random/of-the-day', async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // 1. Try to find today's QOTD
        const [existingQOTD] = await db
            .select()
            .from(quotes)
            .where(
                and(
                    eq(quotes.type, 'daily'),
                    eq(quotes.date, today)
                )
            )
            .limit(1);

        if (existingQOTD) {
            return res.json(existingQOTD);
        }

        // 2. Pick a random quote from all quotes (not marked as QOTD already for today)
        const allQuotes = await db
            .select()
            .from(quotes)
            .where(
                // Exclude today's QOTD if any exist (shouldn't, but for safety)
                or(
                    eq(quotes.type, ''), // or type !== 'daily'
                    eq(quotes.type, ''),
                    eq(quotes.type, 'regular'),
                    eq(quotes.type, 'quote'), // or whatever your default types are
                )
            );

        if (!allQuotes.length) {
            return res.status(404).json({ error: "No quotes available." });
        }

        const randomQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];

        // 3. Insert a new QOTD entry with type: 'daily' and date: today
        // (Do not mutate the original quote; create a new QOTD record)
        const [newQOTD] = await db
            .insert(quotes)
            .values({
                quote: randomQuote.quote,
                author: randomQuote.author,
                category_id: randomQuote.category_id,
                type: 'daily',
                date: today,
            })
            .returning();

        res.json(newQOTD);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

export default router;