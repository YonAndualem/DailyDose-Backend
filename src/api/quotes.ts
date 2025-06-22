import express from 'express';
import { db } from '../db/index';
import { quotes, categories } from '../db/schema';
import { ilike, eq, and } from 'drizzle-orm';
import { generateWithGemini } from '../gemini';

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
        const geminiResult: { quote?: string; author?: string } | string = await generateWithGemini(prompt) as { quote?: string; author?: string } | string;

        // Type guard: check if geminiResult is an object with 'quote' property
        let generatedQuote: string;
        let finalAuthor: string;
        if (typeof geminiResult === 'object' && geminiResult !== null && 'quote' in geminiResult) {
            generatedQuote = geminiResult.quote || '';
            finalAuthor = author || (geminiResult as any).author || 'Unknown';
        } else if (typeof geminiResult === 'string') {
            generatedQuote = geminiResult;
            finalAuthor = author || 'Unknown';
        } else {
            // Fallback for unexpected Gemini result shape
            generatedQuote = '';
            finalAuthor = author || 'Unknown';
        }

        // Insert the new quote
        const [newQuote] = await db
            .insert(quotes)
            .values({
                quote: generatedQuote,
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

export default router;