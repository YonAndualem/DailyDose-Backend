import express from 'express';
import { db } from '../db/index';
import { categories } from '../db/schema';

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const cats = await db.select().from(categories);
        res.json(cats);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

export default router;