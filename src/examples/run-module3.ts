/**
 * Example script to run Module3: CitationIntegrity
 * 
 * Note: Module3 requires Module1 and Module2 to run first to get document type, subtype, and structure info.
 * Usage: npx tsx src/examples/run-module3.ts <path-to-pdf-file> [paper-id]
 */

import 'dotenv/config';
import { CitationIntegrityModule } from '../modules/citation-integrity.js';
import { BaseAssessmentModule } from '../modules/base.js';

async function runModule3() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx src/examples/run-module3.ts <path-to-pdf-file> [paper-id]');
    console.error('\nNote: Module3 works best when Module1 and Module2 have already run for the same paper.');
    process.exit(1);
  }

  const pdfPath = args[0];
  const paperId = args[1] || BaseAssessmentModule.generatePaperId();

  console.log('PaperMock3 - Module3: CitationIntegrity');
  console.log('========================================\n');
  console.log(`PDF File: ${pdfPath}`);
  console.log(`Paper ID: ${paperId}`);
  console.log('Note: This module will use document type, subtype, and structure info from previous modules.\n');

  try {
    const module = new CitationIntegrityModule();
    console.log('Analyzing citation integrity...\n');
    
    const result = await module.process(pdfPath, paperId);
    
    console.log('Citation Integrity Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✓ Citation analysis stored successfully!');
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

runModule3().catch(console.error);

