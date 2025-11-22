/**
 * Module 10: LiteratureReviewAnalyzer
 * Performs deep, comprehensive, multi-dimensional evaluation of the literature review
 * Uses structured information from Module 2 (structure) and Module 3 (citations)
 * Does NOT analyze citation correctness, novelty, methodology, dataset, structure, writing, or raw PDF
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import { extractTextFromPDF } from '../pdf/parser.js';
import type { ModuleConfig } from '../types/index.js';

interface StructuredText {
  [sectionName: string]: string;
}

interface CitationAnalysis {
  summary?: {
    total_references_detected?: number;
    recent_0_5_years?: number;
    older_10_years?: number;
  };
  quality?: {
    recency_analysis?: {
      recent_0_5_years?: number;
      older_10_years?: number;
    };
    outdated_ratio?: {
      ratio?: number;
    };
  };
  problems?: Array<{
    severity: 'low' | 'medium' | 'high';
    type: string;
    description: string;
  }>;
}

interface Module10Input {
  document_id: string;
  structured_text: StructuredText;
  citation_analysis?: CitationAnalysis | null;
}

interface LiteratureReviewIssue {
  issue_id: string;
  issue_type: 'incomplete_coverage' | 'missing_foundational_work' | 'missing_recent_work' | 'irrelevant_sources' | 'weak_synthesis' | 'misorganization' | 'unclear_gap' | 'fabricated_gap' | 'misrepresented_prior_work' | 'biased_selection' | 'lack_of_competing_approaches' | 'shallow_review' | 'missing_comparison' | 'other_lit_review_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface LiteratureReviewScores {
  completeness: number;
  relevance: number;
  synthesis_quality: number;
  recency: number;
  organization_quality: number;
  gap_alignment: number;
  bias_risk: number;
  overall_lit_review_quality: number;
}

interface LiteratureReviewOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  lit_review_issues: LiteratureReviewIssue[];
  lit_review_scores: LiteratureReviewScores;
  lit_review_summary: string;
  error?: string;
}

export class LiteratureReviewAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'LiteratureReviewAnalyzer',
      description: 'Performs comprehensive evaluation of the literature review: coverage, relevance, synthesis, organization, gaps, recency, bias',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('LiteratureReviewAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on literature review sections
   */
  async extractStructuredText(documentText: string, paperId: string): Promise<StructuredText> {
    try {
      // Get Module 2 structure information
      const module2Assessment = await getLatestAssessment(paperId, 'StructuralScanner');
      if (!module2Assessment || !module2Assessment.result) {
        return this.extractSectionsHeuristically(documentText);
      }

      const structureInfo = module2Assessment.result as any;
      const structuredText: StructuredText = {};

      // Focus on literature review-related sections
      const litReviewSections = [
        'related_work', 'literature_review', 'background',
        'related_works', 'prior_work', 'state_of_the_art'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of litReviewSections) {
        const sectionInfo = sections[sectionName];
        if (sectionInfo && sectionInfo.exists) {
          const sectionText = this.extractSectionText(documentText, sectionName);
          if (sectionText) {
            structuredText[sectionName] = sectionText;
          }
        }
      }

      // Use dynamic headings for more precise extraction
      if (dynamicHeadings.length > 0) {
        const sortedHeadings = [...dynamicHeadings].sort((a: any, b: any) => a.start_index - b.start_index);
        
        for (let i = 0; i < sortedHeadings.length; i++) {
          const heading = sortedHeadings[i];
          const nextHeading = sortedHeadings[i + 1];
          const start = heading.start_index;
          const end = nextHeading ? nextHeading.start_index : documentText.length;
          const sectionText = documentText.substring(start, end).trim();
          
          if (sectionText.length > 100) {
            const normalizedName = heading.normalized_title.toLowerCase().replace(/\s+/g, '_');
            // Include if it's literature review-relevant
            if (litReviewSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('related') || 
                normalizedName.includes('literature') ||
                normalizedName.includes('background') ||
                normalizedName.includes('prior') ||
                normalizedName.includes('state_of_the_art')) {
              if (!structuredText[normalizedName] || structuredText[normalizedName].length < sectionText.length) {
                structuredText[normalizedName] = sectionText;
              }
            }
          }
        }
      }

      // Fallback to heuristic extraction if needed
      if (Object.keys(structuredText).length < 1) {
        const heuristicSections = this.extractSectionsHeuristically(documentText);
        // Filter to literature review-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (litReviewSections.includes(key) || key.includes('related') || key.includes('background')) {
            structuredText[key] = value;
          }
        }
      }

      return structuredText;
    } catch (error) {
      console.error('Error extracting structured text:', error);
      return this.extractSectionsHeuristically(documentText);
    }
  }

  /**
   * Heuristically extract sections from document text
   */
  private extractSectionsHeuristically(documentText: string): StructuredText {
    const structuredText: StructuredText = {};
    const sectionPatterns = [
      { name: 'related_work', patterns: [/related\s+work\s*[:\n]/i, /literature\s+review\s*[:\n]/i] },
      { name: 'background', patterns: [/background\s*[:\n]/i, /prior\s+work\s*[:\n]/i] },
    ];

    for (const { name, patterns } of sectionPatterns) {
      for (const pattern of patterns) {
        const match = documentText.match(pattern);
        if (match && match.index !== undefined) {
          const start = match.index + match[0].length;
          let end = documentText.length;
          for (const otherSection of sectionPatterns) {
            if (otherSection.name !== name) {
              for (const otherPattern of otherSection.patterns) {
                const otherMatch = documentText.substring(start).match(otherPattern);
                if (otherMatch && otherMatch.index !== undefined) {
                  const candidateEnd = start + otherMatch.index;
                  if (candidateEnd < end && candidateEnd > start) {
                    end = candidateEnd;
                  }
                }
              }
            }
          }
          // Also check for next major section
          const nextSectionPattern = /(?:methods?|methodology|experiments?|results?|discussion|conclusion)\s*[:\n]/i;
          const nextMatch = documentText.substring(start).match(nextSectionPattern);
          if (nextMatch && nextMatch.index !== undefined) {
            const candidateEnd = start + nextMatch.index;
            if (candidateEnd < end) {
              end = candidateEnd;
            }
          }
          const sectionText = documentText.substring(start, end).trim();
          if (sectionText.length > 200) {
            structuredText[name] = sectionText;
            break;
          }
        }
      }
    }

    return structuredText;
  }

  /**
   * Extract text for a specific section
   */
  private extractSectionText(documentText: string, sectionName: string): string | null {
    const patterns: RegExp[] = [];
    
    switch (sectionName) {
      case 'related_work':
      case 'literature_review':
        patterns.push(/related\s+work\s*[:\n]/i, /literature\s+review\s*[:\n]/i);
        break;
      case 'background':
        patterns.push(/background\s*[:\n]/i, /prior\s+work\s*[:\n]/i);
        break;
    }

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match.index !== undefined) {
        const start = match.index + match[0].length;
        const nextSectionPattern = /(?:methods?|methodology|experiments?|results?|discussion|conclusion|introduction)\s*[:\n]/i;
        const nextMatch = documentText.substring(start).match(nextSectionPattern);
        const end = nextMatch ? start + nextMatch.index : documentText.length;
        const sectionText = documentText.substring(start, end).trim();
        if (sectionText.length > 100) {
          return sectionText;
        }
      }
    }

    return null;
  }

  /**
   * Get citation analysis from Module 3
   */
  async getCitationAnalysis(paperId: string): Promise<CitationAnalysis | null> {
    try {
      const module3Assessment = await getLatestAssessment(paperId, 'CitationIntegrity');
      if (module3Assessment && module3Assessment.result) {
        return module3Assessment.result as CitationAnalysis;
      }
    } catch (error) {
      // Citation analysis is optional
    }
    return null;
  }

  /**
   * Process document and generate literature review analysis
   */
  async process(documentId: string, paperId?: string, paperPath?: string): Promise<any> {
    try {
      const searchId = paperId || documentId;

      // Get full document text if paperPath is provided
      let documentText = '';
      if (paperPath) {
        const parsedPDF = await extractTextFromPDF(paperPath);
        documentText = parsedPDF.text;
      } else {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          lit_review_issues: [],
          lit_review_scores: {
            completeness: 0,
            relevance: 0,
            synthesis_quality: 0,
            recency: 0,
            organization_quality: 0,
            gap_alignment: 0,
            bias_risk: 0,
            overall_lit_review_quality: 0,
          },
          lit_review_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on literature review sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any literature review content
      const hasLitReviewContent = Object.keys(structuredText).some(key => 
        key.includes('related') || 
        key.includes('literature') ||
        key.includes('background') ||
        key.includes('prior')
      );

      if (!hasLitReviewContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          lit_review_issues: [],
          lit_review_scores: {
            completeness: 0,
            relevance: 0,
            synthesis_quality: 0,
            recency: 0,
            organization_quality: 0,
            gap_alignment: 0,
            bias_risk: 0,
            overall_lit_review_quality: 0,
          },
          lit_review_summary: '',
          error: 'No literature review or related work content found in structured_text.',
        };
      }

      // Get optional citation analysis
      const citationAnalysis = await this.getCitationAnalysis(searchId);

      // Prepare input for LLM
      const input: Module10Input = {
        document_id: documentId,
        structured_text: structuredText,
        citation_analysis: citationAnalysis,
      };

      // Call OpenAI to generate literature review analysis
      const systemPrompt = `You are Module 10: "LiteratureReviewAnalyzer" for the PaperMock3 system. Your ONLY job is to perform deep, comprehensive evaluation of the literature review. You MUST NOT:
- Analyze citation correctness (Module 3 does this)
- Evaluate novelty (Module 9 does this)
- Evaluate methodology (Module 7 does this)
- Evaluate dataset (Module 8 does this)
- Detect structure (Module 2 does this)
- Evaluate writing clarity (Module 4 does this)
- Parse or read raw PDF (use only structured_text provided)

You ONLY evaluate the logic, structure, completeness, relevance, synthesis quality, and academic rigor of the literature review section.`;

      const userPrompt = `Analyze the literature review of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
Analyze the literature review along EIGHT core dimensions:

1. COVERAGE & COMPLETENESS
   - covers all major sub-domains relevant to the problem?
   - includes foundational works?
   - includes modern works (recent 3-5 years)?
   - includes key competing methods or approaches?
   - avoids major omissions?
   - Detect: missing categories, ignored well-known algorithms/papers, lack of competing approaches

2. RELEVANCE & FOCUS
   - are included works directly relevant?
   - indirectly relevant but justified?
   - irrelevant or filler citations?
   - Flag: irrelevant references, padding citations, citations with no connection

3. SYNTHESIS QUALITY (Very Important)
   - goes beyond summarizing papers?
   - explains relationships between works?
   - compares and contrasts approaches?
   - shows evolution of ideas?
   - identifies consistent patterns or weaknesses?
   - Flag: mere list of summaries, lacking synthesis, shallow and descriptive

4. LOGICAL ORGANIZATION
   - chronological order (if used)?
   - thematic clusters?
   - methodological grouping?
   - clarity of flow between paragraphs?
   - Flag: disorganized structure, abrupt transitions, mixed unrelated categories

5. GAP IDENTIFICATION
   - identifies specific research gaps?
   - explains limitations of existing work?
   - makes coherent case for need of this research?
   - ties gap to their own contributions?
   - Flag: unclear gap, fabricated gaps, incorrect understanding, hand-wavy statements

6. RECENCY & ACADEMIC MODERNITY
   - percentage of recent sources (use citation_analysis if available)?
   - outdated sources dominating?
   - missing recent breakthroughs?
   - Flag: excessive old works, missing key recent papers, weak modernization

7. BIAS & MISREPRESENTATION
   - cherry-picking only supportive sources?
   - ignoring competing or contradictory findings?
   - misrepresenting previous works?
   - exaggerating weaknesses in prior art?

8. CONNECTION TO THE CURRENT PAPER
   - leads logically to research question?
   - supports methodology chosen?
   - motivates dataset/model decisions?
   - aligns with claimed contributions?
   - Flag if connection is unclear

ISSUE GENERATION:
For each problem found, create an issue with (use ONLY these types):
- "incomplete_coverage", "missing_foundational_work", "missing_recent_work"
- "irrelevant_sources", "weak_synthesis", "misorganization"
- "unclear_gap", "fabricated_gap", "misrepresented_prior_work"
- "biased_selection", "lack_of_competing_approaches", "shallow_review"
- "missing_comparison", "other_lit_review_issue"

For each: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

LITERATURE REVIEW SCORES (0-1 floats):
- completeness
- relevance
- synthesis_quality
- recency
- organization_quality
- gap_alignment
- bias_risk
- overall_lit_review_quality

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "LiteratureReviewAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "lit_review_issues": [
    {
      "issue_id": "lr1",
      "issue_type": "<allowed type>",
      "severity": "low|medium|high",
      "section": "<section>",
      "excerpt": "<short text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "lit_review_scores": {
    "completeness": 0.0,
    "relevance": 0.0,
    "synthesis_quality": 0.0,
    "recency": 0.0,
    "organization_quality": 0.0,
    "gap_alignment": 0.0,
    "bias_risk": 0.0,
    "overall_lit_review_quality": 0.0
  },
  "lit_review_summary": "<1-3 paragraphs>"
}

RULES:
- Do NOT analyze citation correctness, novelty, methodology, dataset, structure, or writing
- Do NOT invent prior work or external knowledge
- Do NOT guess citations or authors
- ALL conclusions MUST come directly from structured_text
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<LiteratureReviewOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: LiteratureReviewOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        lit_review_issues: llmResult.lit_review_issues || [],
        lit_review_scores: llmResult.lit_review_scores || {
          completeness: 0.5,
          relevance: 0.5,
          synthesis_quality: 0.5,
          recency: 0.5,
          organization_quality: 0.5,
          gap_alignment: 0.5,
          bias_risk: 0.5,
          overall_lit_review_quality: 0.5,
        },
        lit_review_summary: llmResult.lit_review_summary || 'Analysis completed.',
        error: llmResult.error,
      };

      // Store the assessment result
      const { storeAssessment } = await import('../db/storage.js');
      const assessmentResult = {
        paperId: searchId,
        moduleName: this.config.name,
        assessmentDate: new Date().toISOString(),
        result: output,
      };
      await storeAssessment(assessmentResult);

      return output;
    } catch (error) {
      console.error(`Error in LiteratureReviewAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        lit_review_issues: [],
        lit_review_scores: {
          completeness: 0,
          relevance: 0,
          synthesis_quality: 0,
          recency: 0,
          organization_quality: 0,
          gap_alignment: 0,
          bias_risk: 0,
          overall_lit_review_quality: 0,
        },
        lit_review_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

