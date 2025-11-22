/**
 * Main entry point for PaperMock3
 */

import type { BaseModule } from './types/index.js';
import { BaseAssessmentModule } from './modules/base.js';
import { IngestionAndAppropriatenessModule } from './modules/ingestion-and-appropriateness.js';
import { StructuralScannerModule } from './modules/structural-scanner.js';
import { CitationIntegrityModule } from './modules/citation-integrity.js';
import { PdfPageSplitterModule } from './modules/pdf-page-splitter.js';
import { WritingIssueScannerModule } from './modules/writing-issue-scanner.js';
import { WritingQualitySummaryModule } from './modules/writing-quality-summary.js';
import { ArgumentationAndClaimSupportAnalyzerModule } from './modules/argumentation-analyzer.js';
import { MethodologyQualityAnalyzerModule } from './modules/methodology-quality-analyzer.js';
import { DatasetAndDataReliabilityAnalyzerModule } from './modules/dataset-reliability-analyzer.js';
import { NoveltyAndContributionAnalyzerModule } from './modules/novelty-contribution-analyzer.js';
import { LiteratureReviewAnalyzerModule } from './modules/literature-review-analyzer.js';
import { AIBCCoherenceAnalyzerModule } from './modules/aibc-coherence-analyzer.js';
import { ResultsAndStatisticalSoundnessAnalyzerModule } from './modules/results-statistical-analyzer.js';
import { RobustnessAndGeneralizationAnalyzerModule } from './modules/robustness-generalization-analyzer.js';
import { EthicsReproducibilityTransparencyAnalyzerModule } from './modules/ethics-reproducibility-analyzer.js';
import { FinalReportComposerModule } from './modules/final-report-composer.js';
import { PDFReportLayoutGeneratorModule } from './modules/pdf-report-layout-generator.js';
import { PipelineModule } from './modules/pipeline-module.js';

// Example usage - this will be expanded as modules are added
async function main() {
  console.log('PaperMock3 - Modular PDF Assessment System');
  console.log('==========================================\n');

  // Register available modules
  const modules: BaseModule[] = [
    new IngestionAndAppropriatenessModule(),
    new StructuralScannerModule(),
    new CitationIntegrityModule(),
    new PdfPageSplitterModule(),
    new WritingIssueScannerModule(),
    new WritingQualitySummaryModule(),
    new ArgumentationAndClaimSupportAnalyzerModule(),
    new MethodologyQualityAnalyzerModule(),
    new DatasetAndDataReliabilityAnalyzerModule(),
    new NoveltyAndContributionAnalyzerModule(),
    new LiteratureReviewAnalyzerModule(),
    new AIBCCoherenceAnalyzerModule(),
    new ResultsAndStatisticalSoundnessAnalyzerModule(),
    new RobustnessAndGeneralizationAnalyzerModule(),
    new EthicsReproducibilityTransparencyAnalyzerModule(),
    new FinalReportComposerModule(),
    new PDFReportLayoutGeneratorModule(),
    new PipelineModule(),
  ];

  console.log(`Registered ${modules.length} module(s):`);
  modules.forEach((module) => {
    console.log(`  - ${module.config.name} (v${module.config.version}): ${module.config.description}`);
  });
  console.log('\nTo use a module, import it and call the process() method with a PDF file path.');
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { BaseAssessmentModule, IngestionAndAppropriatenessModule, StructuralScannerModule, CitationIntegrityModule, PdfPageSplitterModule, WritingIssueScannerModule, WritingQualitySummaryModule, ArgumentationAndClaimSupportAnalyzerModule, MethodologyQualityAnalyzerModule, DatasetAndDataReliabilityAnalyzerModule, NoveltyAndContributionAnalyzerModule, LiteratureReviewAnalyzerModule, AIBCCoherenceAnalyzerModule, ResultsAndStatisticalSoundnessAnalyzerModule, RobustnessAndGeneralizationAnalyzerModule, EthicsReproducibilityTransparencyAnalyzerModule, FinalReportComposerModule, PDFReportLayoutGeneratorModule, PipelineModule };
export type { BaseModule };

