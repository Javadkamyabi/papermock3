/**
 * Module1: IngestionAndAppropriateness
 * Analyzes academic papers for safety, appropriateness, document type, and metadata
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import type { ModuleConfig } from '../types/index.js';

interface IngestionInput {
  filename: string;
  document_text: string;
  word_count: number;
}

interface IngestionOutput {
  module: string;
  version: string;
  success: boolean;
  file_metadata: {
    original_filename: string;
    text_language: string;
    word_count: number;
  };
  document_type: {
    doc_type: 'paper' | 'report' | 'thesis' | 'not_academic';
    doc_type_confidence: number;
    is_academic_style: boolean;
    academic_style_confidence: number;
    detected_features: string[];
    notes: string;
  };
  appropriateness: {
    is_content_safe: boolean;
    safety_confidence: number;
    safety_flags: string[];
    inappropriateness_reason: string | null;
  };
}

export class IngestionAndAppropriatenessModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'IngestionAndAppropriateness',
      description: 'Analyzes academic papers for safety, appropriateness, document type, and metadata',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Assess the paper text and return structured analysis
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    // Count words (approximate)
    const wordCount = paperText.split(/\s+/).filter(word => word.length > 0).length;

    // Prepare input for OpenAI
    const input: IngestionInput = {
      filename: `paper_${paperId}.pdf`,
      document_text: paperText,
      word_count: wordCount,
    };

    // Truncate text if too long (OpenAI has token limits)
    // For very large documents, use aggressive truncation
    // We need to stay under ~7000 tokens total (including prompt)
    // Prompt is ~2000 tokens, so we have ~5000 tokens for text
    // Approximate: 1 word ≈ 1.3 tokens, so ~3800 words ≈ ~5000 tokens ≈ ~20k characters
    const maxLength = 20000; // Aggressive truncation for large documents
    let truncatedText = paperText;
    
    if (paperText.length > maxLength) {
      // For very large documents, take samples from beginning and end
      const sampleSize = Math.floor(maxLength / 2);
      truncatedText = paperText.substring(0, sampleSize) + 
                     '\n\n... [middle section truncated - document is very large] ...\n\n' +
                     paperText.substring(paperText.length - sampleSize) +
                     '\n\n[Document truncated for analysis. Original length: ' + paperText.length + ' characters, ' + wordCount + ' words]';
    }

    const inputForAnalysis: IngestionInput = {
      ...input,
      document_text: truncatedText,
    };

    const prompt = `You are Module1: "IngestionAndAppropriateness" for the PaperMock3 system.

Your ONLY job is to analyze the given academic file text and return a single JSON object describing:

1. Whether the content is safe and appropriate.
2. Whether it is an academic-style document.
3. The most likely document type: "paper", "report", "thesis", or "not_academic".
4. Short reasoning details that other modules can read.
5. Basic metadata (filename, language guess, word count).

Follow these rules strictly:

- Output MUST be valid JSON.
- Do NOT include any extra commentary or markdown.
- If there is not enough information, use "unknown" and give a short explanation.
- Be conservative and honest; if you are not sure, lower the confidence.

DEFINITIONS
-----------

"Safe content":
- Does NOT contain explicit sexual content, graphic violence, hate speech, self-harm instructions, or criminal instructions.
- General academic mentions of violence, self-harm, or crime in a research context are allowed.

"Academic-style document":
- Has a formal or semi-formal tone.
- Appears to present information, research, analysis, or a structured report.
- Could realistically be: a journal or conference paper, a course report, a project report, a thesis or dissertation.

"Document type":
- "paper": A journal or conference-style article; usually 5–30 pages, with sections like Abstract, Introduction, Related Work, Methods, Results, Conclusion, References.
- "thesis": A long document, usually with chapters (e.g., "Chapter 1", "Chapter 2"), acknowledgements, supervisor/advisor, degree information, and a very detailed methodology and literature review.
- "report": A structured but flexible document, often for a course, project, company or organization, possibly with an executive summary, objectives, methodology, results, and recommendations.
- "not_academic": Clearly not an academic document (e.g., novel, blog, random web article, personal diary, marketing copy, pornographic story, etc.).

CONFIDENCE SCORES
-----------------

For classification, always return confidence as a number from 0.0 to 1.0:
- 0.9–1.0: Very sure
- 0.7–0.89: Fairly sure
- 0.4–0.69: Uncertain
- < 0.4: Mostly guessing

Input data:
${JSON.stringify(inputForAnalysis, null, 2)}

Return EXACTLY ONE JSON object with this shape:

{
  "module": "IngestionAndAppropriateness",
  "version": "1.0.0",
  "success": true,
  "file_metadata": {
    "original_filename": "user_upload.pdf",
    "text_language": "en",
    "word_count": 12345
  },
  "document_type": {
    "doc_type": "thesis",
    "doc_type_confidence": 0.86,
    "is_academic_style": true,
    "academic_style_confidence": 0.9,
    "detected_features": [
      "chapters_with_numbers",
      "acknowledgements_section",
      "supervisor_or_degree_information"
    ],
    "notes": "Long multi-chapter document with degree and supervisor mentioned; structure consistent with a graduate thesis."
  },
  "appropriateness": {
    "is_content_safe": true,
    "safety_confidence": 0.97,
    "safety_flags": [],
    "inappropriateness_reason": null
  }
}

Edge cases:
- If the content is clearly unsafe, set "is_content_safe": false and add one or more "safety_flags": e.g. "explicit_sexual_content", "graphic_violence", "hate_speech", "self_harm_instructions", "criminal_instruction", "spam_or_scam".
- If the document is not academic: "doc_type": "not_academic", "is_academic_style": false.
- If language cannot be reliably detected, set "text_language": "unknown".

IMPORTANT:
- Do NOT invent structured sections that are not actually present.
- Base your reasoning on the actual text content.
- The final answer MUST be valid JSON, parsable by a standard JSON parser.
- Return ONLY the JSON object, no markdown, no code blocks, no explanations.`;

    const systemPrompt = `You are a specialized academic document analyzer. Your task is to analyze documents and return structured JSON assessments. Always return valid JSON only, with no additional commentary or markdown formatting.`;

    try {
      const result = await callOpenAIJSON<IngestionOutput>(
        prompt,
        'gpt-4o-mini',
        systemPrompt
      );

      // Ensure the result has the correct structure
      const output: IngestionOutput = {
        module: result.module || 'IngestionAndAppropriateness',
        version: result.version || '1.0.0',
        success: result.success !== undefined ? result.success : true,
        file_metadata: {
          original_filename: result.file_metadata?.original_filename || input.filename,
          text_language: result.file_metadata?.text_language || 'unknown',
          word_count: result.file_metadata?.word_count || wordCount,
        },
        document_type: {
          doc_type: result.document_type?.doc_type || 'not_academic',
          doc_type_confidence: result.document_type?.doc_type_confidence || 0.5,
          is_academic_style: result.document_type?.is_academic_style ?? false,
          academic_style_confidence: result.document_type?.academic_style_confidence || 0.5,
          detected_features: result.document_type?.detected_features || [],
          notes: result.document_type?.notes || 'Analysis completed',
        },
        appropriateness: {
          is_content_safe: result.appropriateness?.is_content_safe ?? true,
          safety_confidence: result.appropriateness?.safety_confidence || 0.5,
          safety_flags: result.appropriateness?.safety_flags || [],
          inappropriateness_reason: result.appropriateness?.inappropriateness_reason || null,
        },
      };

      return output;
    } catch (error) {
      console.error(`Error in ${this.config.name} module:`, error);
      
      // Return a safe default structure on error
      return {
        module: 'IngestionAndAppropriateness',
        version: '1.0.0',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        file_metadata: {
          original_filename: input.filename,
          text_language: 'unknown',
          word_count: wordCount,
        },
        document_type: {
          doc_type: 'not_academic',
          doc_type_confidence: 0.0,
          is_academic_style: false,
          academic_style_confidence: 0.0,
          detected_features: [],
          notes: 'Error during analysis',
        },
        appropriateness: {
          is_content_safe: true,
          safety_confidence: 0.0,
          safety_flags: [],
          inappropriateness_reason: null,
        },
      };
    }
  }
}

