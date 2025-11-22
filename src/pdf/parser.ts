/**
 * PDF parsing utilities
 */

import pdfParse from 'pdf-parse';
import { readFile } from 'fs/promises';

export interface ParsedPDF {
  text: string;
  numPages: number;
  info?: any;
  metadata?: any;
}

/**
 * Extract text from a PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<ParsedPDF> {
  try {
    const dataBuffer = await readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
      metadata: data.metadata,
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract a specific page range from PDF
 */
export async function extractPagesFromPDF(
  filePath: string,
  startPage: number,
  endPage: number
): Promise<string> {
  const parsed = await extractTextFromPDF(filePath);
  const lines = parsed.text.split('\n');
  
  // Simple approximation: divide text by number of pages
  const linesPerPage = Math.ceil(lines.length / parsed.numPages);
  const startLine = (startPage - 1) * linesPerPage;
  const endLine = Math.min(endPage * linesPerPage, lines.length);
  
  return lines.slice(startLine, endLine).join('\n');
}

