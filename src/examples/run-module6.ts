/**
 * Example script to run Module 6: ArgumentationAndClaimSupportAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module6.ts <paper_path> <paper_id> [document_id]
 * 
 * This module analyzes logical structure, claim-evidence alignment, and argumentation quality.
 * It requires Module 2 (structure) and optionally Module 3 (citations) to have been run first.
 */

import 'dotenv/config';
import { ArgumentationAndClaimSupportAnalyzerModule } from '../modules/argumentation-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module6.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module6.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 3 (CitationIntegrity) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 6: ArgumentationAndClaimSupportAnalyzer');
  console.log('============================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module analyzes logical structure and argumentation quality.');
  console.log('      It uses structured information from Module 2 and Module 3.');
  console.log('');

  const module = new ArgumentationAndClaimSupportAnalyzerModule();

  try {
    console.log('Extracting structured text and analyzing argumentation...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 6 failed:', result.error);
      process.exit(1);
    }

    console.log('Argumentation Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Argument Quality: ${(result.argumentation_scores.overall_argument_quality * 100).toFixed(1)}%`);
    console.log(`  Claim Support: ${(result.argumentation_scores.claim_support * 100).toFixed(1)}%`);
    console.log(`  Logical Consistency: ${(result.argumentation_scores.logical_consistency * 100).toFixed(1)}%`);
    console.log(`  Alignment with Problem: ${(result.argumentation_scores.alignment_with_problem * 100).toFixed(1)}%`);
    console.log(`  Interpretation Faithfulness: ${(result.argumentation_scores.interpretation_faithfulness * 100).toFixed(1)}%`);
    console.log(`  Novelty Positioning: ${(result.argumentation_scores.novelty_positioning * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Claims Identified: ${result.claims.length}`);
    console.log(`Argumentation Issues: ${result.argumentation_issues.length}`);
    if (result.argumentation_issues.length > 0) {
      const highSeverity = result.argumentation_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.argumentation_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.argumentation_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 6:', error);
    process.exit(1);
  }
}

main().catch(console.error);

