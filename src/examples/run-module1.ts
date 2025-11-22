/**
 * Example script to run Module1: IngestionAndAppropriateness
 * 
 * Usage: npm run dev src/examples/run-module1.ts <path-to-pdf-file>
 */

import 'dotenv/config';
import { IngestionAndAppropriatenessModule } from '../modules/ingestion-and-appropriateness.js';
import { BaseAssessmentModule } from '../modules/base.js';

async function runModule1() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npm run dev src/examples/run-module1.ts <path-to-pdf-file>');
    process.exit(1);
  }

  const pdfPath = args[0];
  const paperId = args[1] || BaseAssessmentModule.generatePaperId();

  console.log('PaperMock3 - Module1: IngestionAndAppropriateness');
  console.log('==================================================\n');
  console.log(`PDF File: ${pdfPath}`);
  console.log(`Paper ID: ${paperId}\n`);

  try {
    const module = new IngestionAndAppropriatenessModule();
    console.log('Processing PDF...\n');
    
    const result = await module.process(pdfPath, paperId);
    
    console.log('Assessment Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✓ Assessment stored successfully!');
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

runModule1().catch(console.error);

