/**
 * Example script to run Module 14: EthicsReproducibilityTransparencyAnalyzer
 * 
 * Usage: npx tsx src/examples/run-module14.ts <paper_path> <paper_id> [document_id]
 * 
 * This module evaluates ethical responsibility, reproducibility quality, and transparency:
 * ethics, risk analysis, limitations, reproducibility details, responsible research practices.
 * It requires Module 2 (structure) and optionally Module 6 (claims).
 */

import 'dotenv/config';
import { EthicsReproducibilityTransparencyAnalyzerModule } from '../modules/ethics-reproducibility-analyzer.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module14.ts <paper_path> <paper_id> [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-module14.ts /path/to/paper.pdf paper-123 doc-456');
    console.error('');
    console.error('Note: This module requires:');
    console.error('  - Module 2 (StructuralScanner) to have been run');
    console.error('  - Module 6 (ArgumentationAndClaimSupportAnalyzer) is optional but recommended');
    process.exit(1);
  }

  const paperPath = resolve(args[0]);
  const paperId = args[1];
  const documentId = args[2] || paperId;

  console.log('PaperMock3 - Module 14: EthicsReproducibilityTransparencyAnalyzer');
  console.log('===============================================================');
  console.log('');
  console.log('Paper Path:', paperPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');
  console.log('Note: This module evaluates ethics, reproducibility, and transparency across 4 categories:');
  console.log('      ethics & risk analysis, transparency & honesty, reproducibility quality,');
  console.log('      responsible research practices.');
  console.log('      It uses structured information from Module 2 and Module 6.');
  console.log('');

  const module = new EthicsReproducibilityTransparencyAnalyzerModule();

  try {
    console.log('Extracting ethics/reproducibility sections and analyzing transparency...');
    console.log('');

    const result = await module.process(documentId, paperId, paperPath);

    if (!result.success) {
      console.error('❌ Module 14 failed:', result.error);
      process.exit(1);
    }

    console.log('Ethics, Reproducibility, and Transparency Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Analysis complete!');
    console.log('');
    console.log('Key Metrics:');
    console.log(`  Overall Ethics/Reproducibility Quality: ${(result.ert_scores.overall_ethics_reproducibility_quality * 100).toFixed(1)}%`);
    console.log(`  Ethics Completeness: ${(result.ert_scores.ethics_completeness * 100).toFixed(1)}%`);
    console.log(`  Risk Awareness: ${(result.ert_scores.risk_awareness * 100).toFixed(1)}%`);
    console.log(`  Transparency Level: ${(result.ert_scores.transparency_level * 100).toFixed(1)}%`);
    console.log(`  Limitation Quality: ${(result.ert_scores.limitation_quality * 100).toFixed(1)}%`);
    console.log(`  Reproducibility Completeness: ${(result.ert_scores.reproducibility_completeness * 100).toFixed(1)}%`);
    console.log(`  Responsible Research Quality: ${(result.ert_scores.responsible_research_quality * 100).toFixed(1)}%`);
    console.log('');
    console.log(`ERT Issues: ${result.ert_issues.length}`);
    if (result.ert_issues.length > 0) {
      const highSeverity = result.ert_issues.filter(i => i.severity === 'high').length;
      const mediumSeverity = result.ert_issues.filter(i => i.severity === 'medium').length;
      const lowSeverity = result.ert_issues.filter(i => i.severity === 'low').length;
      console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
    }

  } catch (error) {
    console.error('Error running Module 14:', error);
    process.exit(1);
  }
}

main().catch(console.error);

