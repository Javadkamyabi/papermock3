/**
 * Module 4B: WritingIssueScanner
 * Analyzes writing quality issues on a single page of text
 * Focuses on clarity, tone, structure, and local organization
 * Does NOT analyze scientific correctness, citations, or structure
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import type { ModuleConfig } from '../types/index.js';

interface WritingIssueInput {
  document_id: string;
  page_id: string;
  page_number: number;
  page_text: string;
  section_hint: string | null;
}

interface IssueSpan {
  char_start: number;
  char_end: number;
  excerpt: string;
}

interface WritingIssue {
  id: string;
  issue_type: 'unclear_sentence' | 'overly_complex_sentence' | 'vague_wording' | 'informal_tone' | 'inconsistent_academic_tone' | 'redundant_content' | 'weak_paragraph_structure' | 'abrupt_transition' | 'ambiguous_reference' | 'other_writing_issue';
  severity: 'low' | 'medium' | 'high';
  span: IssueSpan;
  why_problematic: string;
  suggested_fix: string;
}

interface WritingIssueOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  page_id: string;
  page_number: number | null;
  section_hint: string | null;
  issues: WritingIssue[];
  page_summary: string;
}

export class WritingIssueScannerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'WritingIssueScanner',
      description: 'Analyzes writing quality issues on a single page of text',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - analyzes writing quality on a single page
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('WritingIssueScanner must be called with scanPage() method, not assess()');
  }

  /**
   * Scan a single page for writing issues
   * This is the main entry point for Module 4B
   */
  async scanPage(input: WritingIssueInput): Promise<WritingIssueOutput> {
    try {
      // Validate input
      if (!input.page_text || typeof input.page_text !== 'string') {
        return {
          module: 'WritingIssueScanner',
          version: '1.0.0',
          success: false,
          document_id: input.document_id || '',
          page_id: input.page_id || '',
          page_number: null,
          section_hint: null,
          issues: [],
          page_summary: 'Input was invalid or page_text was not provided.',
        };
      }

      // Truncate if too long to stay within token limits
      const maxTextLength = 8000; // Conservative limit for single page analysis
      const pageText = input.page_text.length > maxTextLength
        ? input.page_text.substring(0, maxTextLength) + '\n\n[Text truncated for analysis]'
        : input.page_text;

      const sectionHint = input.section_hint || 'null';

      const prompt = `You are Module 4B: "WritingIssueScanner" for the PaperMock3 system.

Your job is to analyze writing quality on a SINGLE page of an academic document.

You MUST focus ONLY on local writing-quality problems such as:
- unclear or hard-to-follow sentences
- overly long / overly complex sentences
- vague wording
- informal or non-academic tone
- inconsistent academic tone
- redundant or repetitive content
- weak paragraph structure
- abrupt transitions between sentences or paragraphs
- ambiguous references (e.g., "this", "it", "they" with unclear antecedent)
- other local writing issues that hurt clarity and academic style

You MUST NOT:
- Analyze scientific correctness or research quality
- Comment on citations, references, or structural presence of sections
- Judge whether the research conclusions are valid
- Analyze content accuracy or novelty

You ONLY judge writing clarity, readability, tone, coherence, and local organization.

For each problem you find:
1. Classify its type (from the fixed vocabulary below)
2. Assign severity (low / medium / high)
3. Point to the approximate character span in page_text (char_start, char_end)
4. Include a short excerpt of the problematic text
5. Explain WHY it is problematic in academic writing
6. Provide a concrete suggestion for how to improve it

Focus on HIGH and MEDIUM severity issues. If the page is mostly fine, return few or zero issues.

ISSUE TYPE VOCABULARY (use ONLY these):
- "unclear_sentence"
- "overly_complex_sentence"
- "vague_wording"
- "informal_tone"
- "inconsistent_academic_tone"
- "redundant_content"
- "weak_paragraph_structure"
- "abrupt_transition"
- "ambiguous_reference"
- "other_writing_issue"

Severity MUST be: "low" | "medium" | "high"

OUTPUT FORMAT:
Return EXACTLY ONE JSON object:
{
  "issues": [
    {
      "id": "p{page_number}-issue-1",
      "issue_type": "unclear_sentence",
      "severity": "high",
      "span": {
        "char_start": 120,
        "char_end": 210,
        "excerpt": "short excerpt of the problematic text..."
      },
      "why_problematic": "Short explanation of why this is a problem in academic writing.",
      "suggested_fix": "Concrete suggestion for how to rewrite or improve this specific part."
    }
  ],
  "page_summary": "Short summary (2–4 sentences) of the overall writing quality on this page, mentioning the main types of issues if any."
}

RULES:
- char_start and char_end are 0-based indices into page_text
- excerpt MUST be a short substring of page_text around that span
- If you find no meaningful issues, set "issues": [] and write a short positive/neutral page_summary
- You MUST NOT output anything outside the JSON
- You MUST NOT hallucinate content that is not in page_text

Page number: ${input.page_number}
Section hint: ${sectionHint}
Page text:
${pageText}`;

      const systemPrompt = `You are a specialized academic writing quality analyzer. Your task is to identify local writing issues on a single page of text. Focus on clarity, readability, tone, and coherence. Always return valid JSON only, with no additional commentary or markdown formatting.`;

      const result = await callOpenAIJSON<{ issues: WritingIssue[]; page_summary: string }>(
        prompt,
        'gpt-4o-mini',
        systemPrompt
      );

      // Ensure issue IDs are properly formatted
      const issues = (result.issues || []).map((issue, index) => ({
        ...issue,
        id: issue.id || `p${input.page_number}-issue-${index + 1}`,
      }));

      // Create output
      const output: WritingIssueOutput = {
        module: 'WritingIssueScanner',
        version: '1.0.0',
        success: true,
        document_id: input.document_id,
        page_id: input.page_id,
        page_number: input.page_number,
        section_hint: input.section_hint,
        issues: issues,
        page_summary: result.page_summary || 'No significant writing issues detected on this page.',
      };

      // Store the assessment result
      const { storeAssessment } = await import('../db/storage.js');
      const { AssessmentResult } = await import('../types/index.js');
      const assessmentResult = {
        paperId: input.document_id, // Use document_id as paperId for consistency
        moduleName: this.config.name,
        assessmentDate: new Date().toISOString(),
        result: output,
      };
      await storeAssessment(assessmentResult);

      return output;
    } catch (error) {
      // Return error output
      return {
        module: 'WritingIssueScanner',
        version: '1.0.0',
        success: false,
        document_id: input.document_id || '',
        page_id: input.page_id || '',
        page_number: input.page_number,
        section_hint: input.section_hint,
        issues: [],
        page_summary: `Error during analysis: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

