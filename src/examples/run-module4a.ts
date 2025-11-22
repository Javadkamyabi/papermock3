/**
 * Example script to run Module 4A: PdfPageSplitter
 * 
 * Usage: npx tsx src/examples/run-module4a.ts <path-to-pdf-file> [paper-id]
 */

import 'dotenv/config';
import { PdfPageSplitterModule } from '../modules/pdf-page-splitter.js';
import { BaseAssessmentModule } from '../modules/base.js';

async function runModule4A() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx src/examples/run-module4a.ts <path-to-pdf-file> [paper-id]');
    process.exit(1);
  }

  const pdfPath = args[0];
  const paperId = args[1] || BaseAssessmentModule.generatePaperId();

  console.log('PaperMock3 - Module 4A: PdfPageSplitter');
  console.log('========================================\n');
  console.log(`PDF File: ${pdfPath}`);
  console.log(`Paper ID: ${paperId}\n`);
  console.log('Note: This module splits the PDF into individual pages and extracts text from each page.\n');

  try {
    const module = new PdfPageSplitterModule();
    console.log('Splitting PDF and extracting page information...\n');
    
    // Use the new persistent storage method
    const result = await module.processWithPersistence(pdfPath, paperId, paperId);
    
    console.log('Page Splitter Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.document) {
      console.log(`\n✓ Successfully split PDF into ${result.document.page_count} pages!`);
      console.log(`✓ Document ID: ${result.document.document_id}`);
      console.log(`✓ Original PDF stored at: ${result.document.storage_path}`);
      console.log(`✓ Single-page PDFs stored in: ./data/pages/${result.document.document_id}/`);
    } else {
      console.error(`\n✗ Error: ${result.error || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

runModule4A().catch(console.error);

