// Robustly splits a quote and author from a string, using the last dash or em dash, and cleans brackets/quotes.
export function parseQuoteAndAuthor(text: string): { quote: string; author: string } {
    let cleaned = text.trim();

    // Try to split on last " - " or em dash " — "
    const dashRegex = /(?:\s+-\s+|\s+—\s+)/g;
    let parts = cleaned.split(dashRegex);

    if (parts.length >= 2) {
        const author = parts.pop()!.replace(/^["“”'\[\]]+|["“”'\[\]]+$/g, '').trim();
        const quote = parts.join(' - ').replace(/^["“”'\[\]]+|["“”'\[\]]+$/g, '').trim();
        return { quote, author };
    }

    // Fallback: try to split on last dash manually
    const lastDash = cleaned.lastIndexOf(' - ');
    if (lastDash !== -1) {
        const quote = cleaned.slice(0, lastDash).replace(/^["“”'\[\]]+|["“”'\[\]]+$/g, '').trim();
        const author = cleaned.slice(lastDash + 3).replace(/^["“”'\[\]]+|["“”'\[\]]+$/g, '').trim();
        return { quote, author };
    }

    // If all fails, return as quote with 'Unknown' author
    return { quote: cleaned.replace(/^["“”'\[\]]+|["“”'\[\]]+$/g, '').trim(), author: 'Unknown' };
  }