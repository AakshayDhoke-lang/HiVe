import prisma from '../config/db';

export interface TextChunk {
  pdfId: string;
  filename: string;
  text: string;
}

/**
 * Splits extracted document text into smaller, overlapping chunks.
 * Uses a sliding word window strategy.
 */
export function chunkText(text: string, pdfId: string, filename: string, chunkSize = 200, overlap = 50): TextChunk[] {
  // Normalize whitespace
  const words = text.trim().split(/\s+/);
  const chunks: TextChunk[] = [];
  
  if (words.length === 0 || (words.length === 1 && words[0] === '')) {
    return [];
  }

  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    const chunkWords = words.slice(i, i + chunkSize);
    
    // Ignore extremely small leftovers
    if (chunkWords.length < 15 && chunks.length > 0) {
      break;
    }
    
    chunks.push({
      pdfId,
      filename,
      text: chunkWords.join(' '),
    });
    
    if (i + chunkSize >= words.length) {
      break;
    }
  }
  
  return chunks;
}

/**
 * Searches and scores text chunks based on query keyword matches (TF-like approach).
 */
export function searchChunks(query: string, chunks: TextChunk[], limit = 5): TextChunk[] {
  // Clean query and extract keywords
  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2); // Filter out common stop-word indicators (e.g. "a", "to", "the", "in")

  if (queryTerms.length === 0) {
    // Fallback: return top chunks if no keywords extracted
    return chunks.slice(0, limit);
  }

  const scored = chunks.map(chunk => {
    const chunkTextLower = chunk.text.toLowerCase();
    let score = 0;

    queryTerms.forEach(term => {
      // Direct whole-word check
      const regex = new RegExp(`\\b${term}\\b`, 'g');
      const matches = chunkTextLower.match(regex);
      if (matches) {
        score += matches.length * 1.5; // Boost exact matches
      } else if (chunkTextLower.includes(term)) {
        score += 0.5; // Partial matching
      }
    });

    return { chunk, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk);
}

/**
 * Pulls all PDFs related to a user and subject, chunks their contents, and retrieves the most relevant context.
 */
export async function retrieveContextForSubject(
  userId: string,
  subjectId: string | null | undefined,
  query: string,
  limit = 5
): Promise<{ context: string; sources: Array<{ pdfId: string; filename: string }> }> {
  // 1. Fetch PDFs
  const pdfs = await prisma.pdf.findMany({
    where: {
      userId,
      ...(subjectId ? { subjectId } : {}), // Filter by subject if specified, else search all
    },
    select: {
      id: true,
      filename: true,
      extractedText: true,
    },
  });

  // 2. Extract and chunk text
  const allChunks: TextChunk[] = [];
  for (const pdf of pdfs) {
    const chunks = chunkText(pdf.extractedText, pdf.id, pdf.filename);
    allChunks.push(...chunks);
  }

  // 3. Search and sort
  const topChunks = searchChunks(query, allChunks, limit);

  // 4. Build context string and source references
  const context = topChunks
    .map((c, i) => `[Source ${i + 1}: ${c.filename}]\n${c.text}\n`)
    .join('\n');

  const uniqueSourcesMap = new Map<string, string>();
  topChunks.forEach(c => uniqueSourcesMap.set(c.pdfId, c.filename));
  const sources = Array.from(uniqueSourcesMap.entries()).map(([pdfId, filename]) => ({
    pdfId,
    filename,
  }));

  return { context, sources };
}
