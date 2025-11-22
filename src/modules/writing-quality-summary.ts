/**
 * Module 5: WritingQualitySummary
 * Aggregates page-level writing issues from Module 4B into a global document analysis
 * Does NOT analyze raw text or find new issues - only interprets Module 4B results
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getPaperAssessments } from '../db/storage.js';
import { getLatestAssessment } from '../db/storage.js';
import type { ModuleConfig, AssessmentResult } from '../types/index.js';
import { getAccuracyRulesSystemAddition } from '../config/accuracy-rules.js';
interface IssueSpan {
  char_start: number;
  char_end: number;
  excerpt: string;
}

interface WritingIssue {
  id: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high';
  span: IssueSpan;
  why_problematic: string;
  suggested_fix: string;
}

interface PageIssueData {
  page_id: string;
  page_number: number;
  section_hint: string | null;
  issues: WritingIssue[];
}

interface Module5Input {
  document_id: string;
  pages: PageIssueData[];
  structure_info?: Record<string, any>;
}

interface SectionSummary {
  score: number;
  main_issues: string[];
  summary: string;
}

interface RepresentativeIssue {
  page_number: number;
  issue_id: string;
}

interface Theme {
  theme_id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  sections: string[];
  pages: number[];
  description: string;
  representative_issues: RepresentativeIssue[];
}

interface PrioritizedAction {
  priority: number;
  area: string;
  description: string;
  recommended_action: string;
}

interface WritingQualitySummaryOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  global_scores: {
    overall_writing_quality: number;
    clarity: number;
    readability: number;
    academic_tone: number;
    cohesion: number;
    conciseness: number;
  };
  section_summaries: Record<string, SectionSummary>;
  themes: Theme[];
  prioritized_actions: PrioritizedAction[];
  overall_comment: string;
  error?: string;
}

export class WritingQualitySummaryModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'WritingQualitySummary',
      description: 'Aggregates page-level writing issues into a global document analysis',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   * Required by BaseAssessmentModule interface but we override process() instead
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('WritingQualitySummary must be called with process() method, not assess()');
  }

  /**
   * Collect all Module 4B results for a document
   */
  async collectModule4BResults(documentId: string, paperId?: string): Promise<PageIssueData[]> {
    // Module 4B stores with paperId = document_id, so search by documentId first
    let assessments = await getPaperAssessments(documentId);
    
    // Also try paperId if provided and different (for backward compatibility)
    if (paperId && paperId !== documentId) {
      const paperAssessments = await getPaperAssessments(paperId);
      assessments = [...assessments, ...paperAssessments];
    }
    
    // Also search ALL WritingIssueScanner assessments and filter by document_id in result
    // This is the most reliable method since Module 4B stores paperId = document_id
    const { getAllAssessments } = await import('../db/storage.js');
    const allAssessments = await getAllAssessments();
    const module4bAll = allAssessments.filter((a) => a.moduleName === 'WritingIssueScanner');
    
    // Combine: assessments with matching paperId OR matching document_id in result
    const module4bAssessments = [
      ...assessments.filter((a) => a.moduleName === 'WritingIssueScanner'),
      ...module4bAll.filter((a) => {
        const result = a.result as any;
        // Match by document_id in result OR by paperId (since Module 4B stores paperId = document_id)
        return result && (result.document_id === documentId || a.paperId === documentId);
      }),
    ];

    // Remove duplicates (same assessmentDate + paperId)
    const uniqueAssessments = Array.from(
      new Map(
        module4bAssessments.map((a) => [`${a.paperId}-${a.assessmentDate}`, a])
      ).values()
    );

    // Sort by page number
    const sorted = uniqueAssessments.sort((a, b) => {
      const aPage = (a.result as any)?.page_number || 0;
      const bPage = (b.result as any)?.page_number || 0;
      return aPage - bPage;
    });

    const pages: PageIssueData[] = [];

    for (const assessment of sorted) {
      const result = assessment.result as any;
      if (result && result.success !== false && result.issues) {
        pages.push({
          page_id: result.page_id || '',
          page_number: result.page_number || 0,
          section_hint: result.section_hint || null,
          issues: result.issues || [],
        });
      }
    }

    return pages;
  }

  /**
   * Get optional structure info from Module 2
   */
  async getStructureInfo(paperId: string): Promise<Record<string, any> | undefined> {
    try {
      const module2Assessment = await getLatestAssessment(paperId, 'StructuralScanner');
      if (module2Assessment && module2Assessment.result) {
        return module2Assessment.result as Record<string, any>;
      }
    } catch (error) {
      // Module 2 data is optional, so we ignore errors
    }
    return undefined;
  }

  /**
   * Process document and generate writing quality summary
   * Overrides base process() method with different signature
   */
  async process(documentId: string, paperId?: string): Promise<any> {
    try {
      // Use paperId if provided, otherwise use documentId
      const searchId = paperId || documentId;

      // Collect all Module 4B results (pass both documentId and paperId for better search)
      const pages = await this.collectModule4BResults(documentId, paperId);

      if (pages.length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          global_scores: {
            overall_writing_quality: 0,
            clarity: 0,
            readability: 0,
            academic_tone: 0,
            cohesion: 0,
            conciseness: 0,
          },
          section_summaries: {},
          themes: [],
          prioritized_actions: [],
          overall_comment: '',
          error: 'No Module 4B results found for this document. Please run Module 4B on all pages first.',
        };
      }

      // Get optional structure info from Module 2
      const structureInfo = await this.getStructureInfo(searchId);

      // Prepare input for LLM
      const input: Module5Input = {
        document_id: documentId,
        pages: pages,
        structure_info: structureInfo,
      };

      // Count total issues for validation
      const totalIssues = pages.reduce((sum, page) => sum + page.issues.length, 0);

      if (totalIssues === 0) {
        // Special case: no issues found, return high scores
        return {
          module: this.config.name,
          version: this.config.version,
          success: true,
          document_id: documentId,
          global_scores: {
            overall_writing_quality: 0.95,
            clarity: 0.95,
            readability: 0.95,
            academic_tone: 0.95,
            cohesion: 0.95,
            conciseness: 0.95,
          },
          section_summaries: {},
          themes: [],
          prioritized_actions: [],
          overall_comment: 'No writing issues were detected across all analyzed pages. The document demonstrates strong writing quality with clear, readable, and academically appropriate prose throughout.',
        };
      }

      // Call OpenAI to generate the summary
      const systemPrompt = `You are Module 5: "WritingQualitySummary" for the PaperMock3 system. Your ONLY job is to aggregate and interpret writing issues detected by Module 4B. You MUST NOT:
${getAccuracyRulesSystemAddition()}
- Find new issues
- Analyze raw text
- Comment on scientific correctness
- Rewrite text or propose new spans

You ONLY interpret the structured issue data provided to you.`;

      const userPrompt = `Analyze the following writing issues detected by Module 4B and produce a comprehensive global writing quality summary.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
1. Calculate global writing scores (0.0-1.0) based on:
   - Distribution of issue types
   - Severity (high severity reduces score more)
   - How widespread issues are across pages/sections
   - Scores: overall_writing_quality, clarity, readability, academic_tone, cohesion, conciseness

2. Create section-level summaries for each unique section_hint found:
   - Calculate aggregated score for that section
   - List main issue types present
   - Write a short paragraph summarizing writing strengths/weaknesses

3. Identify themes (groupings of related issues):
   - Group issues that share patterns (e.g., "Clarity problems in Methods", "Redundant content in Discussion")
   - For each theme: theme_id, title, severity, sections involved, pages involved, description, 1-3 representative issues

4. Create prioritized actions (1 = highest priority):
   - Based on severity and frequency of issues
   - Include affected sections, problem pattern summary, recommended actions

5. Write overall document comment (1-3 paragraphs):
   - Summarize overall quality
   - Highlight major areas needing revision
   - Acknowledge strengths if present

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "WritingQualitySummary",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "global_scores": {
    "overall_writing_quality": 0.0,
    "clarity": 0.0,
    "readability": 0.0,
    "academic_tone": 0.0,
    "cohesion": 0.0,
    "conciseness": 0.0
  },
  "section_summaries": {
    "<section_name>": {
      "score": 0.0,
      "main_issues": ["<issue_type>"],
      "summary": "<paragraph>"
    }
  },
  "themes": [
    {
      "theme_id": "theme_1",
      "title": "<string>",
      "severity": "low|medium|high",
      "sections": ["<section>"],
      "pages": [<page_numbers>],
      "description": "<short description>",
      "representative_issues": [
        { "page_number": <int>, "issue_id": "<issue_id>" }
      ]
    }
  ],
  "prioritized_actions": [
    {
      "priority": 1,
      "area": "<section or multiple sections>",
      "description": "<why this area matters>",
      "recommended_action": "<high-level fix based on 4B issues>"
    }
  ],
  "overall_comment": "<1-3 paragraph narrative summary>"
}

RULES:
- Scores must be between 0.0 and 1.0
- Themes must reference existing issues only (by page_number and issue_id)
- Do NOT invent new issues
- Do NOT include raw page_text
- If section_hint is null, use "unknown_section" or merge appropriately
- Be deterministic and realistic in scoring`;

      const llmResult = await callOpenAIJSON<WritingQualitySummaryOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure the output matches expected structure
      const output: WritingQualitySummaryOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        global_scores: llmResult.global_scores || {
          overall_writing_quality: 0.5,
          clarity: 0.5,
          readability: 0.5,
          academic_tone: 0.5,
          cohesion: 0.5,
          conciseness: 0.5,
        },
        section_summaries: llmResult.section_summaries || {},
        themes: llmResult.themes || [],
        prioritized_actions: llmResult.prioritized_actions || [],
        overall_comment: llmResult.overall_comment || 'Analysis completed.',
        error: llmResult.error,
      };

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
      console.error(`Error in WritingQualitySummary module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        global_scores: {
          overall_writing_quality: 0,
          clarity: 0,
          readability: 0,
          academic_tone: 0,
          cohesion: 0,
          conciseness: 0,
        },
        section_summaries: {},
        themes: [],
        prioritized_actions: [],
        overall_comment: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

