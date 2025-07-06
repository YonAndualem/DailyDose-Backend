import express from 'express';
import cors from 'cors';
import quotesRouter from './api/quotes';
import categoriesRouter from './api/categories';
import './scheduler/qotd';

// Only start the API server – no seeding logic here.
const app = express();

app.use(cors());
app.use(express.json());

// --- Quotes endpoints ---
app.use('/api/quotes', quotesRouter);

// --- Categories endpoints ---
app.use('/api/categories', categoriesRouter);

// Remove app.listen!

export default app; // For ES module (TypeScript/ES6+)
module.exports = app; // For CommonJS compatibility