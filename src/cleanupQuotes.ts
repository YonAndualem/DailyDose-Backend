import { db } from './db/index';
import { quotes } from './db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { parseQuoteAndAuthor } from './utils/parseQuoteAndAuthor';

// 1. Fetch all quotes
async function fetchAllQuotes() {
    return await db.select().from(quotes);
}

// 2. Normalize quote and author for deduplication
function normalize(str: string) {
    return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,"'’‘\-–—]/g, '');
}

// 3. Clean up a quote entry (fix "Unknown" authors)
function cleanQuoteEntry(q: any) {
    if (q.author === 'Unknown') {
        // Try to extract author from quote text
        const { quote, author } = parseQuoteAndAuthor(q.quote);
        q.quote = quote;
        if (author !== 'Unknown') q.author = author;
    }
    return q;
}

// 4. Main cleanup
async function cleanupQuotes() {
    const allQuotes = await fetchAllQuotes();
    const seen = new Set<string>();
    const toDelete: number[] = [];
    const cleaned: any[] = [];

    for (const q of allQuotes) {
        const cleanedQ = cleanQuoteEntry({ ...q });
        const key = normalize(cleanedQ.quote) + '|' + normalize(cleanedQ.author);

        if (!seen.has(key)) {
            seen.add(key);
            cleaned.push(cleanedQ);
        } else {
            toDelete.push(q.id);
        }
    }

    // Delete duplicates from DB
    if (toDelete.length > 0) {
        await db.delete(quotes).where(sql`${quotes.id} = ANY(${toDelete})`);
        console.log(`Deleted ${toDelete.length} duplicate quotes.`);
    } else {
        console.log('No duplicates found.');
    }
    // Optionally, update quotes with fixed authors
    for (const q of cleaned) {
        await db.update(quotes)
            .set({ quote: q.quote, author: q.author })
            .where(eq(quotes.id, q.id));
    }
    console.log('Updated author fields where possible.');
}

cleanupQuotes().then(() => {
    console.log('Quote cleanup complete.');
    process.exit(0);
}).catch(e => {
    console.error('Cleanup error:', e);
    process.exit(1);
});