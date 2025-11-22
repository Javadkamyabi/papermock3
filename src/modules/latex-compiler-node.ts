/**
 * Node.js LaTeX to PDF compiler using latex.js
 * Alternative to system pdflatex
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface LaTeXCompileResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
  method?: string;
}

/**
 * Compile LaTeX to PDF using latex.js (if available)
 */
export async function compileLaTeXWithNode(latexFilePath: string): Promise<LaTeXCompileResult> {
  try {
    // Try to use latex.js if available
    const latexjs = await import('latex.js').catch(() => null);
    
    if (!latexjs) {
      return {
        success: false,
        error: 'latex.js package not available. Please install: npm install latex.js',
      };
    }

    const latexSource = await readFile(latexFilePath, 'utf-8');
    const pdfPath = latexFilePath.replace('.tex', '.pdf');

    // Compile using latex.js
    const { LaTeX } = latexjs;
    const latex = new LaTeX();
    const pdf = await latex.parseAndGeneratePDF(latexSource);

    // Save PDF
    await writeFile(pdfPath, pdf);

    if (existsSync(pdfPath)) {
      return {
        success: true,
        pdfPath,
        method: 'latex.js',
      };
    }

    return {
      success: false,
      error: 'PDF file was not created',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

