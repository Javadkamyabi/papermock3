/**
 * Professional LaTeX Compiler
 * Uses online services to compile LaTeX to PDF properly
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface CompileResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
  method?: string;
}

/**
 * Compile LaTeX using LaTeXBase API
 */
async function compileViaLaTeXBase(latexContent: string): Promise<Buffer | null> {
  try {
    const response = await fetch('https://latexbase.com/api/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latex: latexContent }),
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return null;
  } catch (error) {
    console.error('LaTeXBase API error:', error);
    return null;
  }
}

/**
 * Compile LaTeX using Overleaf ShareLaTeX API (if available)
 */
async function compileViaOverleaf(latexContent: string): Promise<Buffer | null> {
  // Overleaf doesn't have a public API, but we can try ShareLaTeX API
  // For now, return null as this requires authentication
  return null;
}

/**
 * Main compilation function
 */
export async function compileLaTeXProfessionally(
  latexFilePath: string,
  outputDir?: string
): Promise<CompileResult> {
  const latexPath = resolve(latexFilePath);
  const dir = outputDir ? resolve(outputDir) : resolve(latexPath, '..');
  const fileName = latexPath.split('/').pop()?.replace('.tex', '') || 'output';
  const pdfPath = resolve(dir, `${fileName}.pdf`);

  try {
    const latexContent = await readFile(latexPath, 'utf-8');

    // Try LaTeXBase first
    console.log('  [Professional Compiler] Trying LaTeXBase API...');
    let pdfBuffer = await compileViaLaTeXBase(latexContent);

    if (pdfBuffer) {
      await writeFile(pdfPath, pdfBuffer);
      return {
        success: true,
        pdfPath,
        method: 'latexbase.com',
      };
    }

    // Try other services...
    return {
      success: false,
      error: 'No online LaTeX compiler service available. Please install BasicTeX or use Docker.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
