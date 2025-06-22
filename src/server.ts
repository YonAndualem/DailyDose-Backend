import express from 'express';
import quoteRoute from './api/quote-generator';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/quotes', quoteRoute);

app.listen(3001, () => {
    console.log('Quote backend running on http://localhost:3001');
});