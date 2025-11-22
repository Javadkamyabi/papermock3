/**
 * Complete TST2.pdf pipeline by running Modules 15 and 16
 */

import 'dotenv/config';
import { FinalReportComposerModule } from '../modules/final-report-composer.js';
import { PDFReportLayoutGeneratorModule } from '../modules/pdf-report-layout-generator.js';

async function main() {
  const docId = '55989119-e11f-48b9-8268-53878cb0448e';
  const paperId = 'paper-1763776624986';

  console.log('=== Completing TST2.pdf Pipeline ===');
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
    console.error('This needs to be fixed!');
    process.exit(1);
  }

  // Step 16: Run Module 16
  console.log('');
  console.log('📄 Step 16/16: Running Module 16 (PDFReportLayoutGenerator)...');
  const module16 = new PDFReportLayoutGeneratorModule();
  const result16 = await module16.process(docId, paperId, {
    submission_id: docId,
    paper_title: 'TST2 Paper',
    authors: [],
    venue: null,
    submission_date: new Date().toISOString().split('T')[0],
  });

  console.log('Module 16 Result:');
  console.log('  Success:', result16.success);
  
  if (!result16.success) {
    console.error('❌ Module 16 failed:', result16.error);
    console.error('This needs to be fixed!');
    process.exit(1);
  }

  // Check for PDF
  if (result16.pdf_path) {
    console.log('');
    console.log('✅✅✅ PDF REPORT GENERATED! ✅✅✅');
    console.log('');
    console.log('📄 PDF Location:');
    console.log(`   ${result16.pdf_path}`);
    console.log('');
    console.log('📊 PDF Details:');
    console.log(`   Size: ${(result16.pdf_size! / 1024).toFixed(2)} KB`);
    console.log(`   Compilation method: ${result16.compilation_method}`);
    console.log('');
    console.log('🎉 All 16 modules completed successfully!');
  } else if (result16.latex_path) {
    console.log('');
    console.log('⚠️  PDF compilation failed, but LaTeX file is available:');
    console.log(`   ${result16.latex_path}`);
    console.log('');
    console.log('Error:', result16.error);
    console.log('');
    console.log('To compile manually:');
    console.log('  1. Use Overleaf.com (upload the .tex file)');
    console.log('  2. Install BasicTeX: brew install --cask basictex');
    console.log('  3. Use Docker: docker run --rm -v "$(pwd)/data/reports:/workdir" texlive/texlive:latest pdflatex ...');
  } else {
    console.error('❌ No LaTeX or PDF generated!');
    process.exit(1);
  }
}

main().catch(console.error);

