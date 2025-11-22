/**
 * Example script to run Module2: StructuralScanner
 * 
 * Note: Module2 requires Module1 to run first to get document type.
 * Usage: npm run dev src/examples/run-module2.ts <path-to-pdf-file> [paper-id]
 */

import 'dotenv/config';
import { StructuralScannerModule } from '../modules/structural-scanner.js';
import { BaseAssessmentModule } from '../modules/base.js';

async function runModule2() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx src/examples/run-module2.ts <path-to-pdf-file> [paper-id]');
    console.error('\nNote: Module2 works best when Module1 has already run for the same paper.');
    process.exit(1);
  }

  const pdfPath = args[0];
  const paperId = args[1] || BaseAssessmentModule.generatePaperId();

  console.log('PaperMock3 - Module2: StructuralScanner');
  console.log('========================================\n');
  console.log(`PDF File: ${pdfPath}`);
  console.log(`Paper ID: ${paperId}`);
  console.log('Note: This module will use document type from Module1 if available.\n');

  try {
    const module = new StructuralScannerModule();
    console.log('Analyzing document structure...\n');
    
    const result = await module.process(pdfPath, paperId);
    
    console.log('Structural Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✓ Structural analysis stored successfully!');
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

runModule2().catch(console.error);

