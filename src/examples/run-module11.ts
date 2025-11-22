/**
 * Example script to run Module 11: AIBC-CoherenceAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module11.ts <paper_path> <paper_id> [document_id]
 * 
 * This module evaluates quality, correctness, internal coherence, and logical alignment
 * of Abstract, Introduction, Background, and Contributions sections.
 * It requires Module 2 (structure) and optionally Module 6 (claims).
 */

import 'dotenv/config';
import { AIBCCoherenceAnalyzerModule } from '../modules/aibc-coherence-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module11.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module11.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 6 (ArgumentationAndClaimSupportAnalyzer) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 11: AIBC-CoherenceAnalyzer');
  console.log('===============================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates coherence and alignment of:');
  console.log('      Abstract, Introduction, Background, and Contributions.');
  console.log('      It uses structured information from Module 2 and Module 6.');
  console.log('');

  const module = new AIBCCoherenceAnalyzerModule();

  try {
    console.log('Extracting AIBC sections and analyzing coherence...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 11 failed:', result.error);
      process.exit(1);
    }

    console.log('AIBC Coherence Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall AIBC Quality: ${(result.aibc_scores.overall_AIBC_quality * 100).toFixed(1)}%`);
    console.log(`  Abstract Quality: ${(result.aibc_scores.abstract_quality * 100).toFixed(1)}%`);
    console.log(`  Abstract Accuracy: ${(result.aibc_scores.abstract_accuracy * 100).toFixed(1)}%`);
    console.log(`  Problem Clarity: ${(result.aibc_scores.problem_clarity * 100).toFixed(1)}%`);
    console.log(`  Motivation Strength: ${(result.aibc_scores.motivation_strength * 100).toFixed(1)}%`);
    console.log(`  Background Quality: ${(result.aibc_scores.background_quality * 100).toFixed(1)}%`);
    console.log(`  Section Alignment: ${(result.aibc_scores.section_alignment * 100).toFixed(1)}%`);
    console.log(`  Contribution Clarity: ${(result.aibc_scores.contribution_clarity * 100).toFixed(1)}%`);
    console.log(`  Contribution Alignment: ${(result.aibc_scores.contribution_alignment * 100).toFixed(1)}%`);
    console.log('');
    console.log(`AIBC Issues: ${result.aibc_issues.length}`);
    if (result.aibc_issues.length > 0) {
      const highSeverity = result.aibc_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.aibc_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.aibc_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 11:', error);
    process.exit(1);
  }
}

main().catch(console.error);

