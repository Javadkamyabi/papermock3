/**
 * Fix and regenerate the report for a document
 */

import 'dotenv/config';
import { FinalReportComposerModule } from '../modules/final-report-composer.js';
import { PDFReportLayoutGeneratorModule } from '../modules/pdf-report-layout-generator.js';

async function main() {
  const docId = '5fafe711-f315-4087-af1e-4c8a13878b70';
  const paperId = 'paper-1763686501799';

  console.log('=== Fixing Report Generation ===');
  console.log(`Document ID: ${docId}`);
  console.log(`Paper ID: ${paperId}`);
  console.log('');

  // Step 1: Re-run Module 15 with fixed collection
  console.log('📄 Step 1: Running Module 15 (FinalReportComposer)...');
  const module15 = new FinalReportComposerModule();
  const result15 = await module15.process(docId, paperId);
  
  console.log('Module 15 Result:');
  console.log('  Success:', result15.success);
  console.log('  Paper Summary:', result15.paper_summary?.substring(0, 150) || 'EMPTY');
  console.log('  Strengths:', result15.strengths?.length || 0);
  console.log('  Weaknesses:', result15.weaknesses?.length || 0);
  console.log('  Detailed sections:', Object.keys(result15.detailed_sections || {}).length);
  console.log('  Final verdict:', result15.final_verdict);
  
  if (!result15.success) {
    console.error('❌ Module 15 failed:', result15.error);
    process.exit(1);
  }

  // Step 2: Re-run Module 16
  console.log('');
  console.log('📄 Step 2: Running Module 16 (PDFReportLayoutGenerator)...');
  const module16 = new PDFReportLayoutGeneratorModule();
  const result16 = await module16.process(docId, paperId, {
    submission_id: docId,
    paper_title: 'TST Paper',
    authors: [],
    venue: null,
    submission_date: new Date().toISOString().split('T')[0],
  });

  console.log('Module 16 Result:');
  console.log('  Success:', result16.success);
  
  if (!result16.success) {
    console.error('❌ Module 16 failed:', result16.error);
    process.exit(1);
  }

  // Step 3: Save LaTeX file
  if (result16.latex_source) {
    const { writeFile } = await import('fs/promises');
    const latexPath = `./data/reports/${docId}_review.tex`;
    await writeFile(latexPath, result16.latex_source);
    console.log('');
    console.log('✅ LaTeX file saved!');
    console.log(`📄 Location: ${latexPath}`);
    console.log(`📊 Size: ${result16.latex_source.length} characters`);
    
    // Show preview
    console.log('');
    console.log('LaTeX preview (first 500 chars):');
    console.log(result16.latex_source.substring(0, 500));
  } else {
    console.error('❌ No LaTeX source in Module 16 output');
    process.exit(1);
  }
}

main().catch(console.error);

