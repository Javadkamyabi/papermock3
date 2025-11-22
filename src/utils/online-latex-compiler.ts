/**
 * Online LaTeX Compiler
 * Uses online services to compile LaTeX to PDF without local installation
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import puppeteer from 'puppeteer';

export interface OnlineCompileResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
  method?: string;
}

/**
 * Compile LaTeX using Overleaf-like online service via browser automation
 */
export async function compileLaTeXOnline(
  latexFilePath: string,
  outputDir?: string
): Promise<OnlineCompileResult> {
  const latexPath = resolve(latexFilePath);
  const dir = outputDir ? resolve(outputDir) : resolve(latexPath, '..');
  const fileName = latexPath.split('/').pop()?.replace('.tex', '') || 'output';
  const pdfPath = resolve(dir, `${fileName}.pdf`);

  try {
    // Read LaTeX content
    const latexContent = await readFile(latexPath, 'utf-8');

    // Method 1: Try using Overleaf API (if available) or browser automation
    // For now, we'll use a simpler approach: convert to HTML then PDF
    
    // Actually, let's use a direct online service
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Try using an online LaTeX compiler service
    // Option: Use ShareLaTeX/Overleaf API or similar service
    
    // Alternative: Use latexonline.cc or similar
    console.log('  [Online Compiler] Attempting online compilation...');
    
    // For now, let's use a workaround: convert LaTeX to HTML/Markdown, then to PDF
    // Or use a service like latexonline.cc
    
    await browser.close();
    
    return {
      success: false,
      error: 'Online compilation service not yet implemented. Please use Overleaf.com or install BasicTeX.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Alternative: Use latexonline.cc API
 */
export async function compileViaLatexOnline(
  latexFilePath: string,
  outputDir?: string
): Promise<OnlineCompileResult> {
  const latexPath = resolve(latexFilePath);
  const dir = outputDir ? resolve(outputDir) : resolve(latexPath, '..');
  const fileName = latexPath.split('/').pop()?.replace('.tex', '') || 'output';
  const pdfPath = resolve(dir, `${fileName}.pdf`);

  try {
    const latexContent = await readFile(latexPath, 'utf-8');
    
    // latexonline.cc API endpoint
    const apiUrl = 'https://latexonline.cc/compile';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `text=${encodeURIComponent(latexContent)}`,
    });

    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer();
      await writeFile(pdfPath, Buffer.from(pdfBuffer));
      
      return {
        success: true,
        pdfPath,
        method: 'latexonline.cc',
      };
    } else {
      return {
        success: false,
        error: `API returned status ${response.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

