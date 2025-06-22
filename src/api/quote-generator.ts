import express from 'express';
import axios from 'axios';

const router = express.Router();

const HUGGINGFACE_API_TOKEN = process.env.HF_TOKEN; // Store your token in .env!

// Pick your model here:
const HF_MODEL = 'microsoft/phi-3-mini-4k-instruct';

router.post('/generate', async (req, res) => {
    const { mood, persona } = req.body;

    // Suggested prompt format
    const prompt = `
Generate a short, original quote about "${mood}" as if spoken by a famous person. 
If "persona" is provided, use their style. Otherwise, choose a well-known inspirational figure.
Respond ONLY with the quote and the attributed author, e.g.:
"Quote text here." - Albert Einstein
`;

    try {
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${HF_MODEL}`,
            { inputs: prompt },
            {
                headers: {
                    Authorization: `Bearer ${HUGGINGFACE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                timeout: 120_000,
            }
        );

        // The response format may vary by model
        const output = response.data[0]?.generated_text || response.data?.generated_text || '';
        // Optionally, parse the output into quote/author here

        res.json({ quote: output.trim() });
    } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to generate quote' });
    }
});

export default router;