/**
 * Full Pipeline Execution Script
 * Runs all modules sequentially on a PDF and generates the final PDF report
 * 
 * Usage: npx tsx src/examples/run-full-pipeline.ts <pdf_path> [paper_id] [document_id]
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import all modules
import { IngestionAndAppropriatenessModule } from '../modules/ingestion-and-appropriateness.js';
import { StructuralScannerModule } from '../modules/structural-scanner.js';
import { CitationIntegrityModule } from '../modules/citation-integrity.js';
import { PdfPageSplitterModule } from '../modules/pdf-page-splitter.js';
import { WritingIssueScannerModule } from '../modules/writing-issue-scanner.js';
import { WritingQualitySummaryModule } from '../modules/writing-quality-summary.js';
import { ArgumentationAndClaimSupportAnalyzerModule } from '../modules/argumentation-analyzer.js';
import { MethodologyQualityAnalyzerModule } from '../modules/methodology-quality-analyzer.js';
import { DatasetAndDataReliabilityAnalyzerModule } from '../modules/dataset-reliability-analyzer.js';
import { NoveltyAndContributionAnalyzerModule } from '../modules/novelty-contribution-analyzer.js';
import { LiteratureReviewAnalyzerModule } from '../modules/literature-review-analyzer.js';
import { AIBCCoherenceAnalyzerModule } from '../modules/aibc-coherence-analyzer.js';
import { ResultsAndStatisticalSoundnessAnalyzerModule } from '../modules/results-statistical-analyzer.js';
import { RobustnessAndGeneralizationAnalyzerModule } from '../modules/robustness-generalization-analyzer.js';
import { EthicsReproducibilityTransparencyAnalyzerModule } from '../modules/ethics-reproducibility-analyzer.js';
import { FinalReportComposerModule } from '../modules/final-report-composer.js';
import { PDFReportLayoutGeneratorModule } from '../modules/pdf-report-layout-generator.js';
import { getDocumentPages } from '../db/documents.js';

const execAsync = promisify(exec);

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npx tsx src/examples/run-full-pipeline.ts <pdf_path> [paper_id] [document_id]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-full-pipeline.ts /path/to/paper.pdf');
    process.exit(1);
  }

  const pdfPath = resolve(args[0]);
  const paperId = args[1] || `paper-${Date.now()}`;
  const documentId = args[2] || randomUUID();

  console.log('PaperMock3 - Full Pipeline Execution');
  console.log('====================================');
  console.log('');
  console.log('PDF Path:', pdfPath);
  console.log('Paper ID:', paperId);
  console.log('Document ID:', documentId);
  console.log('');

  const modules = {
    module1: new IngestionAndAppropriatenessModule(),
    module2: new StructuralScannerModule(),
    module3: new CitationIntegrityModule(),
    module4a: new PdfPageSplitterModule(),
    module4b: new WritingIssueScannerModule(),
    module5: new WritingQualitySummaryModule(),
    module6: new ArgumentationAndClaimSupportAnalyzerModule(),
    module7: new MethodologyQualityAnalyzerModule(),
    module8: new DatasetAndDataReliabilityAnalyzerModule(),
    module9: new NoveltyAndContributionAnalyzerModule(),
    module10: new LiteratureReviewAnalyzerModule(),
    module11: new AIBCCoherenceAnalyzerModule(),
    module12: new ResultsAndStatisticalSoundnessAnalyzerModule(),
    module13: new RobustnessAndGeneralizationAnalyzerModule(),
    module14: new EthicsReproducibilityTransparencyAnalyzerModule(),
    module15: new FinalReportComposerModule(),
    module16: new PDFReportLayoutGeneratorModule(),
  };

  try {
    // Step 1: Run Module 1
    console.log('📄 Step 1/16: Running Module 1 (IngestionAndAppropriateness)...');
    const result1 = await modules.module1.process(pdfPath, paperId);
    const module1Output = result1.result;
    if (!module1Output || !module1Output.success) {
      throw new Error(`Module 1 failed: ${module1Output?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 1 completed');

    // Step 2: Run Module 2
    console.log('📄 Step 2/16: Running Module 2 (StructuralScanner)...');
    const result2 = await modules.module2.process(pdfPath, paperId);
    const module2Output = result2.result;
    if (!module2Output || !module2Output.success) {
      throw new Error(`Module 2 failed: ${module2Output?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 2 completed');

    // Step 3: Run Module 3
    console.log('📄 Step 3/16: Running Module 3 (CitationIntegrity)...');
    const result3 = await modules.module3.process(pdfPath, paperId);
    const module3Output = result3.result;
    if (!module3Output || !module3Output.success) {
      throw new Error(`Module 3 failed: ${module3Output?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 3 completed');

    // Step 4A: Run Module 4A (PDF Page Splitter)
    console.log('📄 Step 4A/16: Running Module 4A (PdfPageSplitter)...');
    // Module 4A has processWithPersistence method that returns PdfPageSplitterOutput directly
    const result4a = await (modules.module4a as any).processWithPersistence(pdfPath, paperId, paperId, documentId);
    // Module 4A returns PdfPageSplitterOutput directly (not wrapped in AssessmentResult)
    if (!result4a || !result4a.success) {
      console.error('Module 4A error details:', result4a?.error);
      throw new Error(`Module 4A failed: ${result4a?.error || 'Unknown error'}`);
    }
    const actualDocumentId = result4a.document?.document_id || documentId;
    console.log(`✓ Module 4A completed (${result4a.pages?.length || 0} pages, document_id: ${actualDocumentId})`);

    // Step 4B: Run Module 4B on all pages
    console.log('📄 Step 4B/16: Running Module 4B (WritingIssueScanner) on all pages...');
    // Use the actual document ID from Module 4A output
    const finalDocumentId = result4a.document?.document_id || documentId;
    const pages = await getDocumentPages(finalDocumentId);
    console.log(`  Found ${pages.length} pages to process`);
    
    let pageSuccessCount = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`  Processing page ${i + 1}/${pages.length}...`);
      try {
        const result4b = await modules.module4b.scanPage({
          document_id: finalDocumentId,
          page_id: page.page_id,
          page_number: page.page_number,
          page_text: page.page_text,
          section_hint: page.section_hint,
        });
        if (result4b.success) {
          pageSuccessCount++;
        } else {
          console.warn(`  ⚠️  Page ${page.page_number} failed: ${result4b.error}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Page ${page.page_number} error: ${error}`);
      }
    }
    console.log(`✓ Module 4B completed (${pageSuccessCount}/${pages.length} pages successful)`);

    // Step 5: Run Module 5
    console.log('📄 Step 5/16: Running Module 5 (WritingQualitySummary)...');
    const result5 = await modules.module5.process(finalDocumentId, paperId);
    if (!result5.success) {
      throw new Error(`Module 5 failed: ${result5.error || 'Unknown error'}`);
    }
    console.log('✓ Module 5 completed');

    // Step 6: Run Module 6
    console.log('📄 Step 6/16: Running Module 6 (ArgumentationAndClaimSupportAnalyzer)...');
    const result6 = await modules.module6.process(finalDocumentId, paperId, pdfPath);
    if (!result6 || !result6.success) {
      throw new Error(`Module 6 failed: ${result6?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 6 completed');

    // Step 7: Run Module 7
    console.log('📄 Step 7/16: Running Module 7 (MethodologyQualityAnalyzer)...');
    const result7 = await modules.module7.process(finalDocumentId, paperId, pdfPath);
    if (!result7 || !result7.success) {
      throw new Error(`Module 7 failed: ${result7?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 7 completed');

    // Step 8: Run Module 8
    console.log('📄 Step 8/16: Running Module 8 (DatasetAndDataReliabilityAnalyzer)...');
    const result8 = await modules.module8.process(finalDocumentId, paperId, pdfPath);
    if (!result8 || !result8.success) {
      throw new Error(`Module 8 failed: ${result8?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 8 completed');

    // Step 9: Run Module 9
    console.log('📄 Step 9/16: Running Module 9 (NoveltyAndContributionAnalyzer)...');
    const result9 = await modules.module9.process(finalDocumentId, paperId, pdfPath);
    if (!result9 || !result9.success) {
      throw new Error(`Module 9 failed: ${result9?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 9 completed');

    // Step 10: Run Module 10
    console.log('📄 Step 10/16: Running Module 10 (LiteratureReviewAnalyzer)...');
    const result10 = await modules.module10.process(finalDocumentId, paperId, pdfPath);
    if (!result10 || !result10.success) {
      throw new Error(`Module 10 failed: ${result10?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 10 completed');

    // Step 11: Run Module 11
    console.log('📄 Step 11/16: Running Module 11 (AIBC-CoherenceAnalyzer)...');
    const result11 = await modules.module11.process(finalDocumentId, paperId, pdfPath);
    if (!result11 || !result11.success) {
      throw new Error(`Module 11 failed: ${result11?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 11 completed');

    // Step 12: Run Module 12
    console.log('📄 Step 12/16: Running Module 12 (ResultsAndStatisticalSoundnessAnalyzer)...');
    const result12 = await modules.module12.process(finalDocumentId, paperId, pdfPath);
    if (!result12 || !result12.success) {
      throw new Error(`Module 12 failed: ${result12?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 12 completed');

    // Step 13: Run Module 13
    console.log('📄 Step 13/16: Running Module 13 (RobustnessAndGeneralizationAnalyzer)...');
    const result13 = await modules.module13.process(finalDocumentId, paperId, pdfPath);
    if (!result13 || !result13.success) {
      throw new Error(`Module 13 failed: ${result13?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 13 completed');

    // Step 14: Run Module 14
    console.log('📄 Step 14/16: Running Module 14 (EthicsReproducibilityTransparencyAnalyzer)...');
    const result14 = await modules.module14.process(finalDocumentId, paperId, pdfPath);
    if (!result14 || !result14.success) {
      throw new Error(`Module 14 failed: ${result14?.error || 'Unknown error'}`);
    }
    console.log('✓ Module 14 completed');

    // Step 15: Run Module 15 (FinalReportComposer)
    console.log('📄 Step 15/16: Running Module 15 (FinalReportComposer)...');
    const result15 = await modules.module15.process(finalDocumentId, paperId);
    if (!result15.success) {
      throw new Error(`Module 15 failed: ${result15.error || 'Unknown error'}`);
    }
    console.log('✓ Module 15 completed');
    console.log(`  Final Verdict: ${result15.final_verdict.toUpperCase()}`);

    // Step 16: Run Module 16 (PDFReportLayoutGenerator)
    console.log('📄 Step 16/16: Running Module 16 (PDFReportLayoutGenerator)...');
    const paperTitle = module1Output.document_type?.doc_type || 'Academic Paper';
    const result16 = await modules.module16.process(finalDocumentId, paperId, {
      submission_id: finalDocumentId,
      paper_title: paperTitle,
      authors: [],
      venue: null,
      submission_date: new Date().toISOString().split('T')[0],
    });
    if (!result16.success) {
      throw new Error(`Module 16 failed: ${result16.error || 'Unknown error'}`);
    }
    console.log('✓ Module 16 completed');

    // Compile LaTeX to PDF
    const latexPath = resolve(`./data/reports/${finalDocumentId}_review.tex`);
    const pdfOutputPath = resolve(`./data/reports/${finalDocumentId}_review.pdf`);
    
    console.log('');
    console.log('📄 Compiling LaTeX to PDF...');
    
    // Try multiple methods to compile LaTeX
    let pdfGenerated = false;
    
    // Method 1: Try pdflatex directly
    try {
      await execAsync('which pdflatex');
      console.log('  Using pdflatex...');
      await execAsync(`cd data/reports && pdflatex -interaction=nonstopmode "${finalDocumentId}_review.tex"`, { cwd: resolve('.') });
      await execAsync(`cd data/reports && pdflatex -interaction=nonstopmode "${finalDocumentId}_review.tex"`, { cwd: resolve('.') });
      if (require('fs').existsSync(pdfOutputPath)) {
        pdfGenerated = true;
        console.log(`✓ PDF generated: ${pdfOutputPath}`);
      }
    } catch (error) {
      // Try Docker method
      try {
        console.log('  Trying Docker with texlive...');
        await execAsync(`docker run --rm -v "${resolve('./data/reports')}:/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${finalDocumentId}_review.tex"`);
        await execAsync(`docker run --rm -v "${resolve('./data/reports')}:/workdir" -w /workdir texlive/texlive:latest pdflatex -interaction=nonstopmode "${finalDocumentId}_review.tex"`);
        if (require('fs').existsSync(pdfOutputPath)) {
          pdfGenerated = true;
          console.log(`✓ PDF generated: ${pdfOutputPath}`);
        }
      } catch (dockerError) {
        // Docker not available, try installing basictex via homebrew
        try {
          console.log('  Attempting to install BasicTeX via Homebrew...');
          await execAsync('brew install --cask basictex');
          await execAsync('eval "$(/usr/libexec/path_helper)" && pdflatex -version');
          console.log('  Using newly installed pdflatex...');
          await execAsync(`cd data/reports && eval "$(/usr/libexec/path_helper)" && pdflatex -interaction=nonstopmode "${finalDocumentId}_review.tex"`, { cwd: resolve('.') });
          await execAsync(`cd data/reports && eval "$(/usr/libexec/path_helper)" && pdflatex -interaction=nonstopmode "${finalDocumentId}_review.tex"`, { cwd: resolve('.') });
          if (require('fs').existsSync(pdfOutputPath)) {
            pdfGenerated = true;
            console.log(`✓ PDF generated: ${pdfOutputPath}`);
          }
        } catch (installError) {
          console.warn('⚠️  Could not automatically compile LaTeX to PDF');
          console.warn('   LaTeX source is available at:', latexPath);
          console.warn('   Options:');
          console.warn('   1. Install MacTeX: brew install --cask mactex');
          console.warn('   2. Install BasicTeX: brew install --cask basictex');
          console.warn('   3. Use Overleaf.com (upload the .tex file)');
          console.warn('   4. Use Docker: docker run --rm -v "$(pwd)/data/reports:/workdir" texlive/texlive:latest pdflatex ...');
        }
      }
    }
    
    if (pdfGenerated) {
      console.log('');
      console.log('🎉 Pipeline completed successfully!');
      console.log(`📄 Final PDF report: ${pdfOutputPath}`);
      const fs = require('fs');
      const stats = fs.statSync(pdfOutputPath);
      console.log(`📊 PDF size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log('');
      console.log('✅ Pipeline completed! LaTeX file ready for compilation.');
      console.log(`📄 LaTeX source: ${latexPath}`);
    }

  } catch (error) {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);

