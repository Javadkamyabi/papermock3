/**
 * Module2: StructuralScanner (Revised)
 * Analyzes the structural organization of academic documents and classifies document subtypes
 * NOTE: Does NOT repeat Module1 tasks (document type, appropriateness, basic metadata)
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import type { ModuleConfig } from '../types/index.js';
import { getAccuracyRulesSystemAddition } from '../config/accuracy-rules.js';
interface StructuralInput {
  document_type: 'paper' | 'report' | 'thesis' | 'not_academic';
  document_text: string;
  file_metadata?: {
    original_filename?: string;
    text_language?: string;
    word_count?: number;
  };
}

interface SectionInfo {
  exists: boolean;
  confidence: number;
  completeness_score: number;
}

interface DynamicHeading {
  raw_title: string;
  normalized_title: string;
  confidence: number;
  start_index: number;
}

interface DocumentSubtype {
  subtype: string;
  confidence: number;
  justification: string;
}

interface StructuralOutput {
  module: string;
  version: string;
  success: boolean;
  document_subtype: DocumentSubtype;
  sections: {
    abstract: SectionInfo;
    introduction: SectionInfo;
    literature_review: SectionInfo;
    methodology: SectionInfo;
    results: SectionInfo;
    discussion: SectionInfo;
    conclusion: SectionInfo;
    references: SectionInfo;
  };
  dynamic_headings: DynamicHeading[];
  markers: {
    acknowledgements: SectionInfo;
    supervisor_info: SectionInfo;
    appendix: SectionInfo;
    executive_summary: SectionInfo;
    recommendations: SectionInfo;
    objectives_or_scope: SectionInfo;
  };
  tables_count: number;
  figures_count: number;
  notes: string;
}

export class StructuralScannerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'StructuralScanner',
      description: 'Analyzes the structural organization of academic documents and classifies document subtypes',
      version: '2.2.0',
    };
    super(config);
  }

  /**
   * Get document type and metadata from Module1 assessment if available
   */
  private async getModule1Data(paperId: string): Promise<{
    document_type: 'paper' | 'report' | 'thesis' | 'not_academic';
    file_metadata?: any;
  }> {
    try {
      const module1Assessment = await getLatestAssessment(paperId, 'IngestionAndAppropriateness');
      if (module1Assessment?.result) {
        return {
          document_type: module1Assessment.result.document_type?.doc_type as 'paper' | 'report' | 'thesis' | 'not_academic' || 'paper',
          file_metadata: module1Assessment.result.file_metadata,
        };
      }
    } catch (error) {
      console.warn('Could not retrieve Module1 assessment, defaulting to "paper"');
    }
    return { document_type: 'paper' }; // Default fallback
  }

  /**
   * Assess the paper structure and return structured analysis
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    // Get document type and metadata from Module1 if available
    const module1Data = await this.getModule1Data(paperId);
    const documentType = module1Data.document_type;

    // Truncate text if too long (OpenAI has token limits)
    // We need to stay under 8192 tokens total (gpt-4 context limit)
    // Prompt instructions are ~2500 tokens, so we have ~5500 tokens for text
    // Approximate: 1 word ≈ 1.3 tokens, so ~4200 words ≈ ~5500 tokens ≈ ~25k characters
    // But to be safe, use ~6000 characters max for document text
    const maxLength = 6000; // Very aggressive truncation to stay within token limits
    let truncatedText = paperText;
    
    if (paperText.length > maxLength) {
      // For very large documents, take smaller samples from beginning and end
      const sampleSize = Math.floor(maxLength / 2);
      truncatedText = paperText.substring(0, sampleSize) + 
                     '\n\n... [middle section truncated - document is very large] ...\n\n' +
                     paperText.substring(paperText.length - sampleSize) +
                     '\n\n[Document truncated for analysis. Original length: ' + paperText.length + ' characters]';
    }

    const input: StructuralInput = {
      document_type: documentType,
      document_text: truncatedText,
      file_metadata: module1Data.file_metadata,
    };

    const prompt = `You are revising Module2: "StructuralScanner" for the PaperMock3 system.

Your ONLY responsibility is structural analysis + document SUBTYPE classification.

You MUST NOT repeat any tasks from Module1.

Module1 already performed:
- document type classification (paper/report/thesis/not_academic)
- appropriateness & safety scanning
- basic metadata extraction (title, authors, word count, language)

Do NOT redo these.

Input data:
${JSON.stringify(input, null, 2)}

YOUR TASKS (NO REDUNDANCY)
---------------------------

### 1. Analyze structural components:

Detect presence + completeness of:
- abstract
- introduction
- literature review
- methodology
- results
- discussion
- conclusion
- references

Each must return:
{
  "exists": true/false,
  "confidence": 0.0-1.0,
  "completeness_score": 0.0-1.0
}

### 2. Extract dynamic headings:

Detect all high-level headings dynamically.

Return:
{
  "raw_title": "...",
  "normalized_title": "...",
  "confidence": 0.0-1.0,
  "start_index": integer
}

### 3. Detect extra markers:
- acknowledgements
- supervisor/advisor mention
- appendix
- executive summary (for reports)
- recommendations (for reports)
- objectives/scope

### 4. Count:
- tables
- figures

### 5. NEW FEATURE — Document SUBTYPE Classification

DO NOT guess document TYPE (paper/thesis/report) — Module 1 already did that.

You MUST classify the **subtype** based on structure, patterns, headings, and content markers.

Allowable subtypes:

For papers:
- "survey_review"
- "systematic_review"
- "experimental_paper"
- "theoretical_paper"
- "methodology_paper"
- "dataset_paper"
- "case_study"
- "position_paper"
- "comparative_study"
- "short_communication"
- "extended_abstract"
- "unknown"

For theses:
- "research_thesis"
- "experimental_thesis"
- "mixed_methods_thesis"
- "project_based_thesis"
- "design_implementation_thesis"
- "unknown"

For reports:
- "technical_report"
- "engineering_report"
- "evaluation_report"
- "market_analysis_report"
- "feasibility_report"
- "unknown"

Return:
{
  "subtype": "experimental_paper",
  "confidence": 0.82,
  "justification": "Detected methods, experiments, results, evaluation sections."
}

Return EXACTLY this JSON shape:

{
  "module": "StructuralScanner",
  "version": "2.2.0",
  "success": true,
  "document_subtype": {
    "subtype": "",
    "confidence": 0.0,
    "justification": ""
  },
  "sections": {
    "abstract": { "exists": true, "confidence": 0.9, "completeness_score": 0.85 },
    "introduction": { "exists": true, "confidence": 0.9, "completeness_score": 0.8 },
    "literature_review": { "exists": false, "confidence": 0.3, "completeness_score": 0.0 },
    "methodology": { "exists": true, "confidence": 0.85, "completeness_score": 0.75 },
    "results": { "exists": true, "confidence": 0.8, "completeness_score": 0.7 },
    "discussion": { "exists": true, "confidence": 0.8, "completeness_score": 0.65 },
    "conclusion": { "exists": true, "confidence": 0.88, "completeness_score": 0.78 },
    "references": { "exists": true, "confidence": 0.95, "completeness_score": 0.9 }
  },
  "dynamic_headings": [
    {
      "raw_title": "1. Introduction",
      "normalized_title": "introduction",
      "confidence": 0.95,
      "start_index": 150
    }
  ],
  "markers": {
    "acknowledgements": { "exists": false, "confidence": 0.2 },
    "supervisor_info": { "exists": false, "confidence": 0.1 },
    "appendix": { "exists": false, "confidence": 0.1 },
    "executive_summary": { "exists": false, "confidence": 0.1 },
    "recommendations": { "exists": false, "confidence": 0.1 },
    "objectives_or_scope": { "exists": false, "confidence": 0.1 }
  },
  "tables_count": 0,
  "figures_count": 0,
  "notes": "Short structural summary."
}

RULES
-----
- NEVER re-detect document type (paper/report/thesis).
- ALWAYS classify SUBTYPE ONLY.
- NEVER redo any Module 1 functions.
- Use ONLY document_text for structure and subtype.
- No comments outside the JSON.
- Return ONLY the JSON object, no markdown, no code blocks, no explanations.

Document type from Module1: ${input.document_type}

Document text to analyze:
${truncatedText.replace(/`/g, "'")}`;

    const systemPrompt = `You are a specialized structural document analyzer. Your task is to analyze document structure and classify document subtypes. Always return valid JSON only, with no additional commentary or markdown formatting. Focus ONLY on structure and subtype classification. Do NOT repeat Module1's tasks.`;

    try {
      const result = await callOpenAIJSON<StructuralOutput>(
        prompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure the result has the correct structure with defaults
      const defaultSection: SectionInfo = { exists: false, confidence: 0.0, completeness_score: 0.0 };
      
      const output: StructuralOutput = {
        module: result.module || 'StructuralScanner',
        version: result.version || '2.2.0',
        success: result.success !== undefined ? result.success : true,
        document_subtype: {
          subtype: result.document_subtype?.subtype || 'unknown',
          confidence: result.document_subtype?.confidence || 0.0,
          justification: result.document_subtype?.justification || 'Unable to determine subtype',
        },
        sections: {
          abstract: result.sections?.abstract || defaultSection,
          introduction: result.sections?.introduction || defaultSection,
          literature_review: result.sections?.literature_review || defaultSection,
          methodology: result.sections?.methodology || defaultSection,
          results: result.sections?.results || defaultSection,
          discussion: result.sections?.discussion || defaultSection,
          conclusion: result.sections?.conclusion || defaultSection,
          references: result.sections?.references || defaultSection,
        },
        dynamic_headings: result.dynamic_headings || [],
        markers: {
          acknowledgements: result.markers?.acknowledgements || defaultSection,
          supervisor_info: result.markers?.supervisor_info || defaultSection,
          appendix: result.markers?.appendix || defaultSection,
          executive_summary: result.markers?.executive_summary || defaultSection,
          recommendations: result.markers?.recommendations || defaultSection,
          objectives_or_scope: result.markers?.objectives_or_scope || defaultSection,
        },
        tables_count: result.tables_count || 0,
        figures_count: result.figures_count || 0,
        notes: result.notes || 'Structural analysis completed',
      };

      return output;
    } catch (error) {
      console.error(`Error in ${this.config.name} module:`, error);
      
      // Return a safe default structure on error
      const defaultSection: SectionInfo = { exists: false, confidence: 0.0, completeness_score: 0.0 };
      
      return {
        module: 'StructuralScanner',
        version: '2.2.0',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        document_subtype: {
          subtype: 'unknown',
          confidence: 0.0,
          justification: 'Error during analysis',
        },
        sections: {
          abstract: defaultSection,
          introduction: defaultSection,
          literature_review: defaultSection,
          methodology: defaultSection,
          results: defaultSection,
          discussion: defaultSection,
          conclusion: defaultSection,
          references: defaultSection,
        },
        dynamic_headings: [],
        markers: {
          acknowledgements: defaultSection,
          supervisor_info: defaultSection,
          appendix: defaultSection,
          executive_summary: defaultSection,
          recommendations: defaultSection,
          objectives_or_scope: defaultSection,
        },
        tables_count: 0,
        figures_count: 0,
        notes: 'Error during structural analysis',
      };
    }
  }
}
