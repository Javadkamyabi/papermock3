/**
 * Example script to run Module 13: RobustnessAndGeneralizationAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module13.ts <paper_path> <paper_id> [document_id]
 * 
 * This module analyzes robustness and generalization:
 * cross-domain, seed stability, ablation, hyperparameter sensitivity, noise robustness, failure modes.
 * It requires Module 2 (structure) and optionally Module 6 (claims).
 */

import 'dotenv/config';
import { RobustnessAndGeneralizationAnalyzerModule } from '../modules/robustness-generalization-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module13.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module13.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 6 (ArgumentationAndClaimSupportAnalyzer) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 13: RobustnessAndGeneralizationAnalyzer');
  console.log('===========================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates robustness and generalization across 7 dimensions:');
  console.log('      cross-domain, seed stability, ablation, hyperparameter sensitivity,');
  console.log('      noise robustness, failure modes, overgeneralization detection.');
  console.log('      It uses structured information from Module 2 and Module 6.');
  console.log('');

  const module = new RobustnessAndGeneralizationAnalyzerModule();

  try {
    console.log('Extracting robustness-related sections and analyzing generalization...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 13 failed:', result.error);
      process.exit(1);
    }

    console.log('Robustness and Generalization Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Robustness Quality: ${(result.robustness_scores.overall_robustness_quality * 100).toFixed(1)}%`);
    console.log(`  Cross-Domain Generalization: ${(result.robustness_scores.cross_domain_generalization * 100).toFixed(1)}%`);
    console.log(`  Seed Stability: ${(result.robustness_scores.seed_stability * 100).toFixed(1)}%`);
    console.log(`  Ablation Quality: ${(result.robustness_scores.ablation_quality * 100).toFixed(1)}%`);
    console.log(`  Hyperparameter Sensitivity Analysis: ${(result.robustness_scores.hyperparameter_sensitivity_analysis * 100).toFixed(1)}%`);
    console.log(`  Noise Robustness: ${(result.robustness_scores.noise_robustness * 100).toFixed(1)}%`);
    console.log(`  Failure Mode Analysis Quality: ${(result.robustness_scores.failure_mode_analysis_quality * 100).toFixed(1)}%`);
    console.log(`  Generalization Claim Validity: ${(result.robustness_scores.generalization_claim_validity * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Robustness Issues: ${result.robustness_issues.length}`);
    if (result.robustness_issues.length > 0) {
      const highSeverity = result.robustness_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.robustness_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.robustness_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 13:', error);
    process.exit(1);
  }
}

main().catch(console.error);

