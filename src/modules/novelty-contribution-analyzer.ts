/**
 * Module 9: NoveltyAndContributionAnalyzer
 * Evaluates originality, contribution clarity, and scientific significance
 * Uses structured information from Module 2 (structure), Module 3 (citations), and Module 6 (claims)
 * Does NOT analyze writing, argumentation, methodology, datasets, structure, or raw PDF text
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

interface Claim {
  claim_id: string;
  claim_type: string;
  section: string;
  excerpt: string;
}

interface Module9Input {
  document_id: string;
  structured_text: StructuredText;
  citation_analysis?: CitationAnalysis | null;
  claims?: Claim[] | null;
}

interface Contribution {
  contribution_id: string;
  contribution_type: 'methodological' | 'experimental' | 'theoretical' | 'dataset' | 'framework' | 'analysis' | 'engineering' | 'survey' | 'other';
  section: string;
  excerpt: string;
  novelty_level: 'high' | 'moderate' | 'low' | 'unclear';
}

interface NoveltyIssue {
  issue_id: string;
  issue_type: 'unclear_contribution' | 'overstated_novelty' | 'missing_prior_work_comparison' | 'gap_not_clear' | 'prior_work_misrepresented' | 'insufficient_citation_of_related_work' | 'outdated_references_affecting_novelty' | 'low_novelty' | 'uncited_competitors' | 'other_novelty_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface NoveltyScores {
  overall_novelty: number;
  contribution_clarity: number;
  originality_of_approach: number;
  positioning_strength: number;
  significance: number;
  gap_articulation_quality: number;
}

interface NoveltyOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  contributions: Contribution[];
  novelty_issues: NoveltyIssue[];
  novelty_scores: NoveltyScores;
  novelty_summary: string;
  error?: string;
}

export class NoveltyAndContributionAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'NoveltyAndContributionAnalyzer',
      description: 'Evaluates originality, contribution clarity, and scientific significance',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('NoveltyAndContributionAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on contribution-related sections
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

      // Focus on contribution-related sections
      const contributionSections = [
        'abstract', 'introduction', 'related_work', 'background',
        'contributions', 'discussion', 'conclusion', 'summary'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of contributionSections) {
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
            // Include if it's contribution-relevant
            if (contributionSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('contribution') || 
                normalizedName.includes('related') ||
                normalizedName.includes('background') ||
                normalizedName.includes('novel') ||
                normalizedName.includes('original')) {
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
        // Filter to contribution-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (contributionSections.includes(key) || key.includes('abstract') || key.includes('introduction') || key.includes('conclusion')) {
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
      { name: 'abstract', patterns: [/abstract\s*[:\n]/i, /^\s*abstract\s*$/im] },
      { name: 'introduction', patterns: [/introduction\s*[:\n]/i, /^\s*1\.?\s*introduction\s*$/im] },
      { name: 'related_work', patterns: [/related\s+work\s*[:\n]/i, /literature\s+review\s*[:\n]/i, /background\s*[:\n]/i] },
      { name: 'contributions', patterns: [/contribution\s*[:\n]/i, /contributions\s*[:\n]/i] },
      { name: 'discussion', patterns: [/discussion\s*[:\n]/i] },
      { name: 'conclusion', patterns: [/conclusion\s*[:\n]/i, /conclusions?\s*[:\n]/i] },
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
      case 'abstract':
        patterns.push(/abstract\s*[:\n]/i);
        break;
      case 'introduction':
        patterns.push(/introduction\s*[:\n]/i, /^\s*1\.?\s*introduction\s*$/im);
        break;
      case 'related_work':
      case 'background':
        patterns.push(/related\s+work\s*[:\n]/i, /literature\s+review\s*[:\n]/i, /background\s*[:\n]/i);
        break;
      case 'contributions':
        patterns.push(/contribution\s*[:\n]/i, /contributions\s*[:\n]/i);
        break;
      case 'discussion':
        patterns.push(/discussion\s*[:\n]/i);
        break;
      case 'conclusion':
        patterns.push(/conclusion\s*[:\n]/i);
        break;
    }

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match.index !== undefined) {
        const start = match.index + match[0].length;
        const nextSectionPattern = /(?:introduction|related|background|methods?|methodology|results?|discussion|conclusion|references?|bibliography)\s*[:\n]/i;
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
   * Get claims from Module 6
   */
  async getClaims(paperId: string): Promise<Claim[] | null> {
    try {
      const module6Assessment = await getLatestAssessment(paperId, 'ArgumentationAndClaimSupportAnalyzer');
      if (module6Assessment && module6Assessment.result) {
        const result = module6Assessment.result as any;
        return result.claims || null;
      }
    } catch (error) {
      // Claims are optional
    }
    return null;
  }

  /**
   * Process document and generate novelty and contribution analysis
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
          contributions: [],
          novelty_issues: [],
          novelty_scores: {
            overall_novelty: 0,
            contribution_clarity: 0,
            originality_of_approach: 0,
            positioning_strength: 0,
            significance: 0,
            gap_articulation_quality: 0,
          },
          novelty_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on contribution-related sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any contribution-relevant content
      const hasContributionContent = Object.keys(structuredText).some(key => 
        key.includes('abstract') || 
        key.includes('introduction') ||
        key.includes('contribution') ||
        key.includes('related') ||
        key.includes('background') ||
        key.includes('conclusion') ||
        key.includes('discussion')
      );

      if (!hasContributionContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          contributions: [],
          novelty_issues: [],
          novelty_scores: {
            overall_novelty: 0,
            contribution_clarity: 0,
            originality_of_approach: 0,
            positioning_strength: 0,
            significance: 0,
            gap_articulation_quality: 0,
          },
          novelty_summary: '',
          error: 'No contribution or novelty information found in structured_text.',
        };
      }

      // Get optional citation analysis and claims
      const citationAnalysis = await this.getCitationAnalysis(searchId);
      const claims = await this.getClaims(searchId);

      // Prepare input for LLM
      const input: Module9Input = {
        document_id: documentId,
        structured_text: structuredText,
        citation_analysis: citationAnalysis,
        claims: claims,
      };

      // Call OpenAI to generate novelty analysis
      const systemPrompt = `You are Module 9: "NoveltyAndContributionAnalyzer" for the PaperMock3 system. Your ONLY job is to evaluate originality, contribution clarity, and scientific significance. You MUST NOT:
- Analyze writing issues (Module 4 does this)
- Evaluate argumentation logic (Module 6 does this)
- Evaluate methodological soundness (Module 7 does this)
- Evaluate datasets (Module 8 does this)
- Detect structure (Module 2 does this)
- Parse raw PDF text (use only structured_text provided)

You ONLY analyze claims of novelty, stated contributions, comparison to related work, and significance.`;

      const userPrompt = `Analyze the novelty and contributions of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
1. IDENTIFY DECLARED CONTRIBUTIONS
   Extract all contributions claimed by the authors.
   For each: contribution_id, contribution_type (methodological|experimental|theoretical|dataset|framework|analysis|engineering|survey|other), excerpt, section, novelty_level (high|moderate|low|unclear)

2. ASSESS NOVELTY
   For each contribution:
   - Does the paper clearly state what is new?
   - Does it position its novelty relative to prior work?
   - Does it differentiate itself from closest related work?
   - Flag if novelty is overstated or vague

3. PRIOR WORK POSITIONING ANALYSIS
   Evaluate how well the paper positions itself relative to cited literature:
   - accurately summarizes prior art
   - clearly identifies gaps in existing work
   - explains how contribution addresses gaps
   - cites relevant and recent works (use citation_analysis when available)
   - avoids hand-wavy claims of originality
   
   Detect issues: weak positioning, missing comparison, unclear gap articulation, outdated references, uncited prior work

4. SIGNIFICANCE EVALUATION
   Evaluate importance:
   - theoretical significance
   - practical impact
   - scope of applicability
   - scalability to real-world use cases
   - potential academic impact
   - Score significance (0-1 float)

5. DETECT NOVELTY/CONTRIBUTION ISSUES
   Look for (use ONLY these types):
   - "unclear_contribution", "overstated_novelty", "missing_prior_work_comparison"
   - "gap_not_clear", "prior_work_misrepresented", "insufficient_citation_of_related_work"
   - "outdated_references_affecting_novelty", "low_novelty", "uncited_competitors", "other_novelty_issue"
   
   For each: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

6. PRODUCE NOVELTY & CONTRIBUTION SCORES (0-1 floats)
   - overall_novelty
   - contribution_clarity
   - originality_of_approach
   - positioning_strength
   - significance
   - gap_articulation_quality

7. GLOBAL NOVELTY SUMMARY
   - 1-3 paragraph narrative: what is new, what is unclear, how this compares to prior art
   - what strengthens or weakens its novelty, significance of contributions

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "NoveltyAndContributionAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "contributions": [
    {
      "contribution_id": "c1",
      "contribution_type": "methodological|experimental|theoretical|dataset|framework|analysis|engineering|survey|other",
      "section": "<section_name>",
      "excerpt": "<short text>",
      "novelty_level": "high|moderate|low|unclear"
    }
  ],
  "novelty_issues": [
    {
      "issue_id": "nv1",
      "issue_type": "<one of allowed types>",
      "severity": "low|medium|high",
      "section": "<section_name>",
      "excerpt": "<short text>",
      "why_problematic": "<explanation>",
      "suggested_fix": "<string>"
    }
  ],
  "novelty_scores": {
    "overall_novelty": 0.0,
    "contribution_clarity": 0.0,
    "originality_of_approach": 0.0,
    "positioning_strength": 0.0,
    "significance": 0.0,
    "gap_articulation_quality": 0.0
  },
  "novelty_summary": "<1-3 paragraph narrative>"
}

RULES:
- DO NOT invent prior work or external knowledge
- DO NOT guess citations or authors
- DO NOT generate new claims not present in structured_text
- Only evaluate novelty relative to what the paper itself presents
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<NoveltyOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: NoveltyOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        contributions: llmResult.contributions || [],
        novelty_issues: llmResult.novelty_issues || [],
        novelty_scores: llmResult.novelty_scores || {
          overall_novelty: 0.5,
          contribution_clarity: 0.5,
          originality_of_approach: 0.5,
          positioning_strength: 0.5,
          significance: 0.5,
          gap_articulation_quality: 0.5,
        },
        novelty_summary: llmResult.novelty_summary || 'Analysis completed.',
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
      console.error(`Error in NoveltyAndContributionAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        contributions: [],
        novelty_issues: [],
        novelty_scores: {
          overall_novelty: 0,
          contribution_clarity: 0,
          originality_of_approach: 0,
          positioning_strength: 0,
          significance: 0,
          gap_articulation_quality: 0,
        },
        novelty_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

