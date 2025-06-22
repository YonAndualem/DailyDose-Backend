import express from 'express';
import cors from 'cors';
import { generateWithGemini } from './gemini';

// Drizzle imports:
import { db } from './db/index'; // adjust path if needed
import { categories } from './db/schema'; // adjust path if needed

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Category seeding logic ---
const initialCategories = [
    { name: 'Inspiration', description: 'Uplifting and motivating quotes.' },
    { name: 'Love', description: 'Quotes about love and relationships.' },
    { name: 'Success', description: 'Quotes about achieving goals and success.' },
    { name: 'Happiness', description: 'Quotes to inspire joy and happiness.' },
    { name: 'Wisdom', description: 'Quotes sharing wisdom and knowledge.' },
    { name: 'Perseverance', description: 'Quotes about persistence and resilience.' },
];

async function seedCategories() {
    for (const cat of initialCategories) {
        await db.insert(categories).values(cat).onConflictDoNothing();
    }
    console.log('Categories seeded!');
}

// --- Call the seeding function at startup ---
seedCategories().catch(e => console.error('Seeding error:', e));

// --- Your Gemini endpoint ---
app.post('/api/gemini-generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
        const geminiResponse = await generateWithGemini(prompt);
        res.json({ response: geminiResponse });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Gemini backend running on http://localhost:${PORT}`);
});