/**
 * Module 16: PDFReportLayoutGenerator
 * Takes FinalReportComposer output and generates a complete PDF report
 * - Generates LaTeX document
 * - Compiles LaTeX to PDF automatically
 * - Returns PDF path
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import { compileLaTeXToPDF } from './pdf-compiler.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import type { ModuleConfig, AssessmentResult } from '../types/index.js';

interface SubmissionMetadata {
  submission_id?: string;
  paper_title?: string;
  authors?: string[];
  venue?: string | null;
  submission_date?: string | null;
}

interface Module16Input {
  document_id: string;
  submission: SubmissionMetadata;
  final_report: any; // Output from Module 15
}

interface PDFReportOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  format: string;
  latex_source: string;
  latex_path?: string;
  pdf_path?: string;
  pdf_size?: number;
  compilation_method?: string;
  error?: string;
}

export class PDFReportLayoutGeneratorModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'PDFReportLayoutGenerator',
      description: 'Generates LaTeX document and compiles to PDF from FinalReportComposer output',
      version: '2.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('PDFReportLayoutGenerator must be called with process() method, not assess()');
  }

  /**
   * Get Module 15 output
   */
  async getFinalReport(paperId: string, documentId: string): Promise<any | null> {
    try {
      // Try by paperId first
      let assessment = await getLatestAssessment(paperId, 'FinalReportComposer');
      
      // If not found, try by documentId
      if (!assessment || !assessment.result) {
        const { getAllAssessments } = await import('../db/storage.js');
        const allAssessments = await getAllAssessments();
        const byDocId = allAssessments.filter(
          a => a.moduleName === 'FinalReportComposer' && a.result?.document_id === documentId
        );
        if (byDocId.length > 0) {
          assessment = byDocId.sort(
            (a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
          )[0];
        }
      }
      
      if (assessment && assessment.result) {
        return assessment.result;
      }
    } catch (error) {
      console.error('Error getting final report:', error);
    }
    return null;
  }

  /**
   * Process and generate PDF report
   */
  async process(
    documentId: string,
    paperId?: string,
    submission?: SubmissionMetadata
  ): Promise<any> {
    try {
      const searchId = paperId || documentId;

      // Get Module 15 output
      const finalReport = await this.getFinalReport(searchId, documentId);

      if (!finalReport || !finalReport.success) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          format: 'pdf',
          latex_source: '',
          error: 'Invalid or incomplete FinalReportComposer output.',
        };
      }

      // Prepare input for LLM
      const input: Module16Input = {
        document_id: documentId,
        submission: submission || {
          submission_id: documentId,
          paper_title: 'Untitled Paper',
          authors: [],
          venue: null,
          submission_date: null,
        },
        final_report: finalReport,
      };

      // Call OpenAI to generate LaTeX document
      const systemPrompt = `You are Module 16: "PDFReportLayoutGenerator" for the PaperMock3/PaperDig system. Your ONLY job is to take the FinalReportComposer output and generate a complete, compilable LaTeX document. You MUST NOT:
- Invent new issues, strengths, weaknesses, or scores
- Modify the meaning of content from Module 15
- Change scores or verdict
- Add new criticism or praise
- Re-analyze the paper

You ONLY structure and format the existing review into a LaTeX document.`;

      // Clean the input to avoid [object Object] in LaTeX
      const cleanInput = {
        document_id: input.document_id,
        submission: input.submission,
        final_report: {
          ...input.final_report,
          paper_summary: typeof input.final_report.paper_summary === 'string' 
            ? input.final_report.paper_summary 
            : JSON.stringify(input.final_report.paper_summary || ''),
          strengths: Array.isArray(input.final_report.strengths) 
            ? input.final_report.strengths.map(s => typeof s === 'string' ? s : String(s))
            : [],
          weaknesses: Array.isArray(input.final_report.weaknesses)
            ? input.final_report.weaknesses.map(w => typeof w === 'string' ? w : String(w))
            : [],
        },
      };

      const userPrompt = `Generate a complete LaTeX document for a professional mock review PDF.

INPUT DATA:
${JSON.stringify(cleanInput, null, 2)}

REQUIREMENTS:

1. LATEX DOCUMENT STRUCTURE:
   - Use: \\documentclass[11pt,a4paper]{article}
   - Required packages:
     \\usepackage[margin=1in]{geometry}
     \\usepackage{lmodern}
     \\usepackage[T1]{fontenc}
     \\usepackage[utf8]{inputenc}
     \\usepackage{setspace}
     \\usepackage{hyperref}
     \\usepackage{graphicx}
     \\usepackage{longtable}
     \\usepackage{booktabs}
     \\usepackage{enumitem}
     \\usepackage{fancyhdr}
     \\usepackage{xcolor}
     \\usepackage{titlesec}
   - Set: \\onehalfspacing
   - Configure hyperref with PDF metadata

2. HEADER/FOOTER:
   - Header (every page): "PaperDig Mock Reviewer v3 – Automated Mock Review Report"
   - Footer: Page numbers (\\thepage)
   - Use fancyhdr for consistent header/footer

3. TITLE PAGE:
   - System name: "PaperDig Mock Reviewer v3"
   - Subtitle: "Automated Structured Mock Review"
   - Paper title (from submission.paper_title)
   - Submission ID
   - Authors (comma-separated)
   - Venue (if provided)
   - Submission date (if provided)
   - Document ID
   - Final verdict (formatted nicely, e.g., "Mock Decision: Weak Accept")
   - Note: "This document is an automatically generated mock review. It is NOT an official journal or conference decision."

4. DOCUMENT SECTIONS (in order):
   1. Executive Summary (based on final_report.paper_summary)
   2. Global Evaluation & Verdict (restate verdict, summarize using strengths/weaknesses)
   3. Strengths (itemized list from final_report.strengths)
   4. Weaknesses (itemized list from final_report.weaknesses)
   5. Priority Revision Plan (three subsections: High, Medium, Low from priority_fix_list)
   6. Dimension-wise Scores & Comments (tables of scores from detailed_sections)
   7. Detailed Module Reports (for each module: summary, issues grouped by severity)
   8. Appendix: Full Issue Lists (optional, if content available)

5. STYLE:
   - Use \\section, \\subsection, \\subsubsection
   - Use \\textbf for important labels
   - Proper vertical spacing
   - Professional, neutral tone
   - Escape all LaTeX special characters: %, $, #, _, {, }, &, ~, ^, \\

6. PDF METADATA:
   \\hypersetup{
     pdftitle={PaperDig Mock Review for <paper_title>},
     pdfauthor={PaperDig Mock Reviewer v3},
     pdfsubject={Automated Mock Review Report},
     pdfkeywords={mock review, PaperDig, academic review}
   }

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "PDFReportLayoutGenerator",
  "version": "2.0.0",
  "success": true,
  "document_id": "${documentId}",
  "format": "latex",
  "latex_source": "<COMPLETE LATEX DOCUMENT HERE>"
}

The latex_source MUST be a complete, compilable LaTeX document starting with \\documentclass and ending with \\end{document}.

CRITICAL RULES:
- DO NOT alter numeric scores
- DO NOT add new issues or change severity
- DO NOT invent new sections
- DO NOT modify content meaning
- Escape ALL LaTeX special characters in dynamic text
- Return ONLY valid JSON, no markdown code blocks
- The LaTeX must be syntactically valid and compilable`;

      console.log('  [Module 16] Generating LaTeX document...');
      const llmResult = await callOpenAIJSON<PDFReportOutput>(
        userPrompt,
        'gpt-4o-mini',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: PDFReportOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        format: llmResult.format || 'latex',
        latex_source: llmResult.latex_source || '',
        error: llmResult.error,
      };

      // Validate that latex_source is present and non-empty
      if (!output.latex_source || output.latex_source.trim().length === 0) {
        output.success = false;
        output.error = 'Generated LaTeX source is empty or invalid.';
        return output;
      }

      // Save LaTeX file
      const reportsDir = resolve('./data/reports');
      if (!existsSync(reportsDir)) {
        await mkdir(reportsDir, { recursive: true });
      }
      const latexPath = join(reportsDir, `${documentId}_review.tex`);
      await writeFile(latexPath, output.latex_source, 'utf-8');
      output.latex_path = latexPath;
      console.log(`  [Module 16] LaTeX file saved: ${latexPath}`);

      // Compile LaTeX to PDF
      console.log('  [Module 16] Compiling LaTeX to PDF...');
      const compileResult = await compileLaTeXToPDF(latexPath, reportsDir);

      if (compileResult.success && compileResult.pdfPath) {
        const { statSync } = await import('fs');
        const stats = statSync(compileResult.pdfPath);
        output.pdf_path = compileResult.pdfPath;
        output.pdf_size = stats.size;
        output.compilation_method = compileResult.method;
        output.success = true;
        console.log(`  [Module 16] ✅ PDF generated successfully!`);
        console.log(`  [Module 16] 📄 PDF: ${compileResult.pdfPath}`);
        console.log(`  [Module 16] 📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`  [Module 16] 🔧 Method: ${compileResult.method}`);
      } else {
        // PDF compilation failed, but LaTeX was generated
        output.success = true; // Still success since LaTeX was generated
        output.error = compileResult.error || 'PDF compilation failed, but LaTeX file is available.';
        console.log(`  [Module 16] ⚠️  PDF compilation failed: ${compileResult.error}`);
        console.log(`  [Module 16] 📄 LaTeX file available: ${latexPath}`);
      }

      // Store the assessment result
      const { storeAssessment } = await import('../db/storage.js');
      const assessmentResult: AssessmentResult = {
        paperId: searchId,
        moduleName: this.config.name,
        assessmentDate: new Date().toISOString(),
        result: output,
      };
      await storeAssessment(assessmentResult);

      return output;
    } catch (error) {
      console.error(`Error in PDFReportLayoutGenerator module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        format: 'pdf',
        latex_source: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
