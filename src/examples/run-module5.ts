/**
 * Example script to run Module 5: WritingQualitySummary
 * 
 * Usage: npx tsx src/examples/run-module5.ts <document_id> [paper_id]
 * 
 * If paper_id is not provided, document_id will be used for both.
 */

import 'dotenv/config';
import { WritingQualitySummaryModule } from '../modules/writing-quality-summary.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npx tsx src/examples/run-module5.ts <document_id> [paper_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module5.ts c23dc41e-c53d-470b-a326-95846009693e');
    process.exit(1);
  }

  const documentId = args[0];
  const paperId = args[1] || documentId; // Use documentId as paperId if not provided

  console.log('PaperMock3 - Module 5: WritingQualitySummary');
  console.log('============================================');
  console.log('');
  console.log('Document ID:', documentId);
  console.log('Paper ID (for assessment lookup):', paperId);
  console.log('');
  console.log('Note: This module aggregates writing issues from Module 4B.');
  console.log('      Make sure Module 4B has been run on all pages first.');
  console.log('');

  const module = new WritingQualitySummaryModule();

  try {
    console.log('Collecting Module 4B results and generating summary...');
    console.log('');

    const result = await module.process(documentId, paperId);

    if (!result.success) {
      console.error('❌ Module 5 failed:', result.error);
      process.exit(1);
    }

    console.log('Writing Quality Summary Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Summary generated successfully!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Writing Quality: ${(result.global_scores.overall_writing_quality * 100).toFixed(1)}%`);
    console.log(`  Clarity: ${(result.global_scores.clarity * 100).toFixed(1)}%`);
    console.log(`  Readability: ${(result.global_scores.readability * 100).toFixed(1)}%`);
    console.log(`  Academic Tone: ${(result.global_scores.academic_tone * 100).toFixed(1)}%`);
    console.log(`  Cohesion: ${(result.global_scores.cohesion * 100).toFixed(1)}%`);
    console.log(`  Conciseness: ${(result.global_scores.conciseness * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Themes Identified: ${result.themes.length}`);
    console.log(`Prioritized Actions: ${result.prioritized_actions.length}`);
    console.log(`Sections Analyzed: ${Object.keys(result.section_summaries).length}`);

  } catch (error) {
    console.error('Error running Module 5:', error);
    process.exit(1);
  }
}

main().catch(console.error);

