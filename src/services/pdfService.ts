import pdfParse from 'pdf-parse';

/**
 * Extracts raw text from a PDF file buffer.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error: any) {
    throw new Error(`Failed to parse PDF: ${error?.message || error}`);
  }
}
