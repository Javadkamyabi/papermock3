/**
 * Example script to run Module 8: DatasetAndDataReliabilityAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module8.ts <paper_path> <paper_id> [document_id]
 * 
 * This module provides comprehensive evaluation of dataset-related aspects:
 * source, validity, bias, preprocessing, balancing, limitations, appropriateness.
 * It requires Module 2 (structure) to have been run first.
 */

import 'dotenv/config';
import { DatasetAndDataReliabilityAnalyzerModule } from '../modules/dataset-reliability-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module8.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module8.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 8: DatasetAndDataReliabilityAnalyzer');
  console.log('========================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module analyzes dataset quality, reliability, bias,');
  console.log('      preprocessing, balancing, and limitations.');
  console.log('      It uses structured information from Module 2.');
  console.log('');

  const module = new DatasetAndDataReliabilityAnalyzerModule();

  try {
    console.log('Extracting dataset-related sections and analyzing reliability...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 8 failed:', result.error);
      process.exit(1);
    }

    console.log('Dataset Reliability Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`Datasets Identified: ${result.datasets.length}`);
    
    if (result.datasets.length > 0) {
      result.datasets.forEach((dataset, idx) => {
        const scores = result.dataset_scores[dataset.dataset_id];
        if (scores) {
          console.log(`\nDataset ${idx + 1} (${dataset.dataset_id}): ${dataset.dataset_name}`);
          console.log(`  Type: ${dataset.dataset_type}`);
          console.log(`  Overall Quality: ${(scores.overall_dataset_quality * 100).toFixed(1)}%`);
          console.log(`  Reliability: ${(scores.reliability * 100).toFixed(1)}%`);
          console.log(`  Representativeness: ${(scores.representativeness * 100).toFixed(1)}%`);
          console.log(`  Bias Risk: ${(scores.bias_risk * 100).toFixed(1)}%`);
          console.log(`  Preprocessing Quality: ${(scores.preprocessing_quality * 100).toFixed(1)}%`);
          console.log(`  Balancing Quality: ${(scores.balancing_quality * 100).toFixed(1)}%`);
          console.log(`  Metric Appropriateness: ${(scores.metric_appropriateness * 100).toFixed(1)}%`);
          console.log(`  Transparency: ${(scores.transparency_of_description * 100).toFixed(1)}%`);
        }
      });
    }
    
    console.log('');
    console.log(`Dataset Issues: ${result.dataset_issues.length}`);
    if (result.dataset_issues.length > 0) {
      const highSeverity = result.dataset_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.dataset_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.dataset_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 8:', error);
    process.exit(1);
  }
}

main().catch(console.error);

