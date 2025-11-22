/**
 * Example script to run Module 15: FinalReportComposer
 * 
 * Usage: npx tsx src/examples/run-module15.ts <document_id> [paper_id]
 * 
 * This module integrates outputs from ALL previous modules (1-14) into a single
 * coherent, structured final report.
 * 
 * Note: This module requires that other assessment modules have been run first.
 */

import 'dotenv/config';
import { FinalReportComposerModule } from '../modules/final-report-composer.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npx tsx src/examples/run-module15.ts <document_id> [paper_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module15.ts doc-123 paper-456');
    console.error('');
    console.error('Note: This module requires that other assessment modules have been run first.');
    console.error('      It integrates all module outputs into a single comprehensive report.');
    process.exit(1);
  }

  const documentId = args[0];
  const paperId = args[1] || documentId;

  console.log('PaperMock3 - Module 15: FinalReportComposer');
  console.log('============================================');
  console.log('');
  console.log('Document ID:', documentId);
  console.log('Paper ID (for assessment lookup):', paperId);
  console.log('');
  console.log('Note: This module integrates outputs from ALL previous modules (1-14)');
  console.log('      into a single coherent, structured final report.');
  console.log('');

  const module = new FinalReportComposerModule();

  try {
    console.log('Collecting module outputs and generating final report...');
    console.log('');

    const result = await module.process(documentId, paperId);

    if (!result.success) {
      console.error('❌ Module 15 failed:', result.error);
      process.exit(1);
    }

    console.log('Final Comprehensive Report:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Final report generated successfully!');
    console.log('');
    console.log('Report Summary:');
    console.log(`  Final Verdict: ${result.final_verdict.toUpperCase()}`);
    console.log(`  Strengths Identified: ${result.strengths.length}`);
    console.log(`  Weaknesses Identified: ${result.weaknesses.length}`);
    console.log(`  Priority Fixes:`);
    console.log(`    - High Priority: ${result.priority_fix_list.high.length}`);
    console.log(`    - Medium Priority: ${result.priority_fix_list.medium.length}`);
    console.log(`    - Low Priority: ${result.priority_fix_list.low.length}`);
    console.log(`  Modules Integrated: ${Object.keys(result.detailed_sections).length}`);

  } catch (error) {
    console.error('Error running Module 15:', error);
    process.exit(1);
  }
}

main().catch(console.error);

