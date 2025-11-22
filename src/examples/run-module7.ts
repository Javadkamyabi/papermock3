/**
 * Example script to run Module 7: MethodologyQualityAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module7.ts <paper_path> <paper_id> [document_id]
 * 
 * This module evaluates the quality, rigor, clarity, and appropriateness of the methodology.
 * It requires Module 2 (structure) and optionally Module 6 (argumentation) to have been run first.
 */

import 'dotenv/config';
import { MethodologyQualityAnalyzerModule } from '../modules/methodology-quality-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module7.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module7.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 6 (ArgumentationAndClaimSupportAnalyzer) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 7: MethodologyQualityAnalyzer');
  console.log('==================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates methodological quality and rigor.');
  console.log('      It uses structured information from Module 2 and Module 6.');
  console.log('');

  const module = new MethodologyQualityAnalyzerModule();

  try {
    console.log('Extracting methodology sections and analyzing quality...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 7 failed:', result.error);
      process.exit(1);
    }

    console.log('Methodology Quality Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Methodology Quality: ${(result.methodology_scores.overall_methodology_quality * 100).toFixed(1)}%`);
    console.log(`  Rigor: ${(result.methodology_scores.rigor * 100).toFixed(1)}%`);
    console.log(`  Validity: ${(result.methodology_scores.validity * 100).toFixed(1)}%`);
    console.log(`  Reproducibility: ${(result.methodology_scores.reproducibility * 100).toFixed(1)}%`);
    console.log(`  Appropriateness: ${(result.methodology_scores.appropriateness * 100).toFixed(1)}%`);
    console.log(`  Completeness: ${(result.methodology_scores.completeness * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Methodology Elements Identified: ${result.methodology_elements.length}`);
    console.log(`Methodology Issues: ${result.methodology_issues.length}`);
    if (result.methodology_issues.length > 0) {
      const highSeverity = result.methodology_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.methodology_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.methodology_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 7:', error);
    process.exit(1);
  }
}

main().catch(console.error);

