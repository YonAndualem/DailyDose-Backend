import express from 'express';
import cors from 'cors';
import quotesRouter from './api/quotes';
import categoriesRouter from './api/categories';
import './scheduler/qotd';
import { db } from './db/index';
import { categories } from './db/schema';
import { seedDailyQuotes } from './seedQuotes';

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

seedCategories().catch(e => console.error('Seeding error:', e));

// --- Quotes endpoints ---
app.use('/api/quotes', quotesRouter);

// --- Categories endpoints ---
app.use('/api/categories', categoriesRouter);

// --- Seed daily quotes per category (ensure 5 per category) ---
seedDailyQuotes().then(() => {
    console.log('Daily quotes seeded!');
}).catch(e => {
    console.error('Seeding daily quotes error:', e);
});

app.listen(PORT, () => {
    console.log(`Gemini backend running on http://localhost:${PORT}`);
});