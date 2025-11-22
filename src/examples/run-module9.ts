/**
 * Example script to run Module 9: NoveltyAndContributionAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module9.ts <paper_path> <paper_id> [document_id]
 * 
 * This module evaluates originality, contribution clarity, and scientific significance.
 * It requires Module 2 (structure) and optionally Module 3 (citations) and Module 6 (claims).
 */

import 'dotenv/config';
import { NoveltyAndContributionAnalyzerModule } from '../modules/novelty-contribution-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module9.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module9.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 3 (CitationIntegrity) is optional but recommended');
    console.error('  - Module 6 (ArgumentationAndClaimSupportAnalyzer) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 9: NoveltyAndContributionAnalyzer');
  console.log('====================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates novelty, contributions, and scientific significance.');
  console.log('      It uses structured information from Module 2, Module 3, and Module 6.');
  console.log('');

  const module = new NoveltyAndContributionAnalyzerModule();

  try {
    console.log('Extracting contribution-related sections and analyzing novelty...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 9 failed:', result.error);
      process.exit(1);
    }

    console.log('Novelty and Contribution Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Novelty: ${(result.novelty_scores.overall_novelty * 100).toFixed(1)}%`);
    console.log(`  Contribution Clarity: ${(result.novelty_scores.contribution_clarity * 100).toFixed(1)}%`);
    console.log(`  Originality of Approach: ${(result.novelty_scores.originality_of_approach * 100).toFixed(1)}%`);
    console.log(`  Positioning Strength: ${(result.novelty_scores.positioning_strength * 100).toFixed(1)}%`);
    console.log(`  Significance: ${(result.novelty_scores.significance * 100).toFixed(1)}%`);
    console.log(`  Gap Articulation Quality: ${(result.novelty_scores.gap_articulation_quality * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Contributions Identified: ${result.contributions.length}`);
    if (result.contributions.length > 0) {
      const highNovelty = result.contributions.filter(c => c.novelty_level === 'high').length;
      const moderateNovelty = result.contributions.filter(c => c.novelty_level === 'moderate').length;
      const lowNovelty = result.contributions.filter(c => c.novelty_level === 'low').length;
      const unclearNovelty = result.contributions.filter(c => c.novelty_level === 'unclear').length;
      console.log(`  - High Novelty: ${highNovelty}, Moderate: ${moderateNovelty}, Low: ${lowNovelty}, Unclear: ${unclearNovelty}`);
    }
    console.log(`Novelty Issues: ${result.novelty_issues.length}`);
    if (result.novelty_issues.length > 0) {
      const highSeverity = result.novelty_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.novelty_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.novelty_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 9:', error);
    process.exit(1);
  }
}

main().catch(console.error);

