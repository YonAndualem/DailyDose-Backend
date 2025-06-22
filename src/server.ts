import express from 'express';
import cors from 'cors';
import { generateWithGemini } from './gemini';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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