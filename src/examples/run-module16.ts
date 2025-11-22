/**
 * Example script to run Module 16: PDFReportLayoutGenerator
 * 
 * Usage: npx tsx src/examples/run-module16.ts <document_id> [paper_id] [paper_title] [authors...]
 * 
 * This module generates a LaTeX document from Module 15's final report output.
 * The LaTeX can be compiled to a professional PDF mock review.
 * 
 * Note: This module requires Module 15 (FinalReportComposer) to have been run first.
 */

import 'dotenv/config';
import { PDFReportLayoutGeneratorModule } from '../modules/pdf-report-layout-generator.js';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npx tsx src/examples/run-module16.ts <document_id> [paper_id] [paper_title] [authors...]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module16.ts doc-123 paper-456 "My Paper Title" "Author 1" "Author 2"');
    console.error('');
    console.error('Note: This module requires Module 15 (FinalReportComposer) to have been run first.');
    console.error('      It generates a LaTeX document that can be compiled to PDF.');
    process.exit(1);
  }

  const documentId = args[0];
  const paperId = args[1] || documentId;
  const paperTitle = args[2] || 'Untitled Paper';
  const authors = args.slice(3) || [];

  console.log('PaperMock3 - Module 16: PDFReportLayoutGenerator');
  console.log('==================================================');
  console.log('');
  console.log('Document ID:', documentId);
  console.log('Paper ID (for assessment lookup):', paperId);
  console.log('Paper Title:', paperTitle);
  console.log('Authors:', authors.length > 0 ? authors.join(', ') : 'Not specified');
  console.log('');
  console.log('Note: This module generates a LaTeX document from Module 15 output.');
  console.log('      The LaTeX can be compiled to a professional PDF mock review.');
  console.log('');

  const module = new PDFReportLayoutGeneratorModule();

  try {
    console.log('Retrieving Module 15 output and generating LaTeX document...');
    console.log('');

    const submission = {
      submission_id: documentId,
      paper_title: paperTitle,
      authors: authors,
      venue: null,
      submission_date: new Date().toISOString().split('T')[0],
    };

    const result = await module.process(documentId, paperId, submission);

    if (!result.success) {
      console.error('❌ Module 16 failed:', result.error);
      process.exit(1);
    }

    console.log('✓ LaTeX document generated successfully!');
    console.log('');
    console.log('Output Summary:');
    console.log(`  Format: ${result.format}`);
    console.log(`  LaTeX Source Length: ${result.latex_source.length} characters`);
    console.log('');

    // Save LaTeX to file
    const outputPath = resolve(`./data/reports/${documentId}_review.tex`);
    const outputDir = resolve('./data/reports');
    
    // Ensure directory exists (create if needed)
    try {
      await mkdir(outputDir, { recursive: true });
      await writeFile(outputPath, result.latex_source, 'utf-8');
      console.log(`✓ LaTeX document saved to: ${outputPath}`);
      console.log('');
      console.log('To compile to PDF, run:');
      console.log(`  pdflatex ${outputPath}`);
      console.log('');
    } catch (writeError) {
      console.warn('Warning: Could not save LaTeX file:', writeError);
      console.log('');
      console.log('LaTeX Source (first 1000 characters):');
      console.log(result.latex_source.substring(0, 1000));
      console.log('...');
    }

    // Also output full JSON result
    console.log('Full Result (JSON):');
    console.log(JSON.stringify({ ...result, latex_source: result.latex_source.substring(0, 200) + '... (truncated)' }, null, 2));

  } catch (error) {
    console.error('Error running Module 16:', error);
    process.exit(1);
  }
}

main().catch(console.error);

