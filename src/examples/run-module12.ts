/**
 * Example script to run Module 12: ResultsAndStatisticalSoundnessAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module12.ts <paper_path> <paper_id> [document_id]
 * 
 * This module performs comprehensive evaluation of the Results section:
 * metrics, statistical validity, baselines, numerical consistency, interpretation.
 * It requires Module 2 (structure) and optionally Module 6 (claims).
 */

import 'dotenv/config';
import { ResultsAndStatisticalSoundnessAnalyzerModule } from '../modules/results-statistical-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module12.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module12.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 6 (ArgumentationAndClaimSupportAnalyzer) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 12: ResultsAndStatisticalSoundnessAnalyzer');
  console.log('==============================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates Results section across 8 dimensions:');
  console.log('      metrics, statistical validity, baselines, numerical consistency,');
  console.log('      interpretation, visualization, claim alignment, overall quality.');
  console.log('      It uses structured information from Module 2 and Module 6.');
  console.log('');

  const module = new ResultsAndStatisticalSoundnessAnalyzerModule();

  try {
    console.log('Extracting results sections and analyzing statistical soundness...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 12 failed:', result.error);
      process.exit(1);
    }

    console.log('Results and Statistical Soundness Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Results Quality: ${(result.results_scores.overall_results_quality * 100).toFixed(1)}%`);
    console.log(`  Metric Completeness: ${(result.results_scores.metric_completeness * 100).toFixed(1)}%`);
    console.log(`  Statistical Validity: ${(result.results_scores.statistical_validity * 100).toFixed(1)}%`);
    console.log(`  Baseline Quality: ${(result.results_scores.baseline_quality * 100).toFixed(1)}%`);
    console.log(`  Numerical Consistency: ${(result.results_scores.numerical_consistency * 100).toFixed(1)}%`);
    console.log(`  Interpretation Quality: ${(result.results_scores.interpretation_quality * 100).toFixed(1)}%`);
    console.log(`  Visualization Quality: ${(result.results_scores.visualization_quality * 100).toFixed(1)}%`);
    console.log(`  Result-Claim Alignment: ${(result.results_scores.result_claim_alignment * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Results Issues: ${result.results_issues.length}`);
    if (result.results_issues.length > 0) {
      const highSeverity = result.results_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.results_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.results_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 12:', error);
    process.exit(1);
  }
}

main().catch(console.error);

