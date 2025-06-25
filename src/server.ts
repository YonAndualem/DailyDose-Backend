import express from 'express';
import cors from 'cors';
import quotesRouter from './api/quotes';
import categoriesRouter from './api/categories';
import './scheduler/qotd';

// Only start the API server – no seeding logic here.
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Quotes endpoints ---
app.use('/api/quotes', quotesRouter);

// --- Categories endpoints ---
app.use('/api/categories', categoriesRouter);

app.listen(PORT, () => {
    console.log(`Gemini backend running on http://localhost:${PORT}`);
});