/**
 * Example script to run Module 10: LiteratureReviewAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module10.ts <paper_path> <paper_id> [document_id]
 * 
 * This module performs comprehensive evaluation of the literature review:
 * coverage, relevance, synthesis, organization, gaps, recency, bias.
 * It requires Module 2 (structure) and optionally Module 3 (citations).
 */

import 'dotenv/config';
import { LiteratureReviewAnalyzerModule } from '../modules/literature-review-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module10.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module10.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 3 (CitationIntegrity) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 10: LiteratureReviewAnalyzer');
  console.log('==================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates literature review quality across 8 dimensions:');
  console.log('      coverage, relevance, synthesis, organization, gaps, recency, bias, connection.');
  console.log('      It uses structured information from Module 2 and Module 3.');
  console.log('');

  const module = new LiteratureReviewAnalyzerModule();

  try {
    console.log('Extracting literature review sections and analyzing quality...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 10 failed:', result.error);
      process.exit(1);
    }

    console.log('Literature Review Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Literature Review Quality: ${(result.lit_review_scores.overall_lit_review_quality * 100).toFixed(1)}%`);
    console.log(`  Completeness: ${(result.lit_review_scores.completeness * 100).toFixed(1)}%`);
    console.log(`  Relevance: ${(result.lit_review_scores.relevance * 100).toFixed(1)}%`);
    console.log(`  Synthesis Quality: ${(result.lit_review_scores.synthesis_quality * 100).toFixed(1)}%`);
    console.log(`  Recency: ${(result.lit_review_scores.recency * 100).toFixed(1)}%`);
    console.log(`  Organization Quality: ${(result.lit_review_scores.organization_quality * 100).toFixed(1)}%`);
    console.log(`  Gap Alignment: ${(result.lit_review_scores.gap_alignment * 100).toFixed(1)}%`);
    console.log(`  Bias Risk: ${(result.lit_review_scores.bias_risk * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Literature Review Issues: ${result.lit_review_issues.length}`);
    if (result.lit_review_issues.length > 0) {
      const highSeverity = result.lit_review_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.lit_review_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.lit_review_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 10:', error);
    process.exit(1);
  }
}

main().catch(console.error);

