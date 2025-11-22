/**
 * Complete the test by running Modules 15 and 16
 */

import 'dotenv/config';
import { FinalReportComposerModule } from '../modules/final-report-composer.js';
import { PDFReportLayoutGeneratorModule } from '../modules/pdf-report-layout-generator.js';
import { writeFile } from 'fs/promises';

async function main() {
  const docId = '45b4907d-86f1-45a7-a23f-2e684e76e349';
  const paperId = 'paper-1763775176127';

  console.log('=== Completing Test: Modules 15 & 16 ===');
  console.log(`Document ID: ${docId}`);
  console.log(`Paper ID: ${paperId}`);
  console.log('');

  // Step 15: Run Module 15
  console.log('📄 Step 15/16: Running Module 15 (FinalReportComposer)...');
  const module15 = new FinalReportComposerModule();
  const result15 = await module15.process(docId, paperId);
  
  console.log('Module 15 Result:');
  console.log('  Success:', result15.success);
  console.log('  Paper Summary length:', result15.paper_summary?.length || 0);
  console.log('  Strengths:', result15.strengths?.length || 0);
  console.log('  Weaknesses:', result15.weaknesses?.length || 0);
  console.log('  Detailed sections:', Object.keys(result15.detailed_sections || {}).length);
  console.log('  Final verdict:', result15.final_verdict);
  
  if (!result15.success) {
    console.error('❌ Module 15 failed:', result15.error);
    process.exit(1);
  }

  // Step 16: Run Module 16
  console.log('');
  console.log('📄 Step 16/16: Running Module 16 (PDFReportLayoutGenerator)...');
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

  // Save LaTeX file
  if (result16.latex_source) {
    const latexPath = `./data/reports/${docId}_review.tex`;
    await writeFile(latexPath, result16.latex_source);
    console.log('');
    console.log('✅ LaTeX file saved!');
    console.log(`📄 Location: ${latexPath}`);
    console.log(`📊 Size: ${result16.latex_source.length} characters`);
  } else {
    console.error('❌ No LaTeX source in Module 16 output');
    process.exit(1);
  }

  console.log('');
  console.log('🎉 All 16 modules completed successfully!');
}

main().catch(console.error);

