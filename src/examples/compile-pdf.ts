/**
 * Standalone script to compile LaTeX to PDF
 * Usage: npx tsx src/examples/compile-pdf.ts <latex-file-path>
 */

import { compilePDF } from '../modules/pdf-compiler.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx src/examples/compile-pdf.ts <latex-file-path>');
    console.log('');
    console.log('Example:');
    console.log('  npx tsx src/examples/compile-pdf.ts data/reports/5fafe711-f315-4087-af1e-4c8a13878b70_review.tex');
    process.exit(1);
  }

  const latexPath = resolve(args[0]);
  console.log('=== PDF Compiler ===');
  console.log(`LaTeX file: ${latexPath}`);
  console.log('');
  
  await compilePDF(latexPath);
}

main().catch(console.error);

