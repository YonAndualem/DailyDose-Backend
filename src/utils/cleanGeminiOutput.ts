// Removes lines that look like instructions or explanations.
export function cleanGeminiOutput(raw: string): string {
    return raw
        .split('\n')
        .filter(line =>
            !/^here('|’)?s|^here is|^this is|^daily quote|^category|^sure[,.]?|^of course[,.]?/i.test(line.trim())
        )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
  }