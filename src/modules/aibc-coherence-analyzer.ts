/**
import { truncateStructuredText, estimateTokens } from '../utils/text-truncation.js'; * Module 11: AIBC-CoherenceAnalyzer (Abstract–Introduction–Background–Contributions)
 * Evaluates quality, correctness, internal coherence, and logical alignment of foundational sections
 * Uses structured information from Module 2 (structure) and Module 6 (claims)
 * Does NOT analyze related work, novelty, citations, datasets, methodology, or writing
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import { extractTextFromPDF } from '../pdf/parser.js';
import type { ModuleConfig } from '../types/index.js';
import { getAccuracyRulesSystemAddition } from '../config/accuracy-rules.js';
interface StructuredText {
  [sectionName: string]: string;
}

interface Claim {
  claim_id: string;
  claim_type: string;
  section: string;
  excerpt: string;
}

interface Module11Input {
  document_id: string;
  structured_text: StructuredText;
  claims?: Claim[] | null;
}

interface AIBCIssue {
  issue_id: string;
  issue_type: 'unclear_problem_statement' | 'weak_motivation' | 'missing_problem_definition' | 'misaligned_abstract' | 'unsupported_claim_in_abstract' | 'exaggerated_claim' | 'irrelevant_background' | 'incorrect_background' | 'missing_background' | 'unclear_contributions' | 'misaligned_contributions' | 'contribution_not_addressing_problem' | 'logical_inconsistency' | 'contradiction_between_sections' | 'shallow_introduction' | 'other_aibc_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface AIBCScores {
  abstract_quality: number;
  abstract_accuracy: number;
  problem_clarity: number;
  motivation_strength: number;
  background_quality: number;
  section_alignment: number;
  contribution_clarity: number;
  contribution_alignment: number;
  overall_AIBC_quality: number;
}

interface AIBCOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  aibc_issues: AIBCIssue[];
  aibc_scores: AIBCScores;
  aibc_summary: string;
  error?: string;
}

export class AIBCCoherenceAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'AIBC-CoherenceAnalyzer',
      description: 'Evaluates quality, correctness, internal coherence, and logical alignment of Abstract, Introduction, Background, and Contributions',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('AIBC-CoherenceAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on AIBC sections
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

      // Focus on AIBC sections
      const aibcSections = [
        'abstract', 'introduction', 'background', 'contributions'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of aibcSections) {
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
            // Include if it's AIBC-relevant
            if (aibcSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('abstract') || 
                normalizedName.includes('introduction') ||
                normalizedName.includes('background') ||
                normalizedName.includes('contribution')) {
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
        // Filter to AIBC-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (aibcSections.includes(key)) {
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
      { name: 'background', patterns: [/background\s*[:\n]/i] },
      { name: 'contributions', patterns: [/contribution\s*[:\n]/i, /contributions\s*[:\n]/i] },
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
          const nextSectionPattern = /(?:methods?|methodology|related|literature|experiments?|results?|discussion|conclusion)\s*[:\n]/i;
          const nextMatch = documentText.substring(start).match(nextSectionPattern);
          if (nextMatch && nextMatch.index !== undefined) {
            const candidateEnd = start + nextMatch.index;
            if (candidateEnd < end) {
              end = candidateEnd;
            }
          }
          const sectionText = documentText.substring(start, end).trim();
          if (sectionText.length > 100) {
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
      case 'background':
        patterns.push(/background\s*[:\n]/i);
        break;
      case 'contributions':
        patterns.push(/contribution\s*[:\n]/i, /contributions\s*[:\n]/i);
        break;
    }

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match.index !== undefined) {
        const start = match.index + match[0].length;
        const nextSectionPattern = /(?:introduction|background|contribution|methods?|methodology|related|results?|discussion|conclusion)\s*[:\n]/i;
        const nextMatch = documentText.substring(start).match(nextSectionPattern);
        const end = nextMatch ? start + nextMatch.index : documentText.length;
        const sectionText = documentText.substring(start, end).trim();
        if (sectionText.length > 50) {
          return sectionText;
        }
      }
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
   * Process document and generate AIBC coherence analysis
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
          aibc_issues: [],
          aibc_scores: {
            abstract_quality: 0,
            abstract_accuracy: 0,
            problem_clarity: 0,
            motivation_strength: 0,
            background_quality: 0,
            section_alignment: 0,
            contribution_clarity: 0,
            contribution_alignment: 0,
            overall_AIBC_quality: 0,
          },
          aibc_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on AIBC sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any AIBC content
      const hasAIBCContent = Object.keys(structuredText).some(key => 
        key.includes('abstract') || 
        key.includes('introduction') ||
        key.includes('background') ||
        key.includes('contribution')
      );

      if (!hasAIBCContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          aibc_issues: [],
          aibc_scores: {
            abstract_quality: 0,
            abstract_accuracy: 0,
            problem_clarity: 0,
            motivation_strength: 0,
            background_quality: 0,
            section_alignment: 0,
            contribution_clarity: 0,
            contribution_alignment: 0,
            overall_AIBC_quality: 0,
          },
          aibc_summary: '',
          error: 'No abstract, introduction, background, or contributions found in structured_text.',
        };
      }

      // Get optional claims
      const claims = await this.getClaims(searchId);

      // Prepare input for LLM
      const input: Module11Input = {
        document_id: documentId,
        structured_text: structuredText,
        claims: claims,
      };

      // Call OpenAI to generate AIBC analysis
      const systemPrompt = `You are Module 11: "AIBC-CoherenceAnalyzer" for the PaperMock3 system. Your ONLY job is to evaluate quality, correctness, internal coherence, and logical alignment of Abstract, Introduction, Background, and Contributions sections. You MUST NOT:
${getAccuracyRulesSystemAddition()}
- Evaluate related work quality (Module 10 does this)
- Evaluate novelty strength (Module 9 does this)
- Evaluate citations (Module 3 does this)
- Evaluate datasets (Module 8 does this)
- Evaluate methodology soundness (Module 7 does this)
- Evaluate writing clarity or grammar (Module 4 does this)
- Parse raw PDFs (use only structured_text provided)

You ONLY analyze Abstract, Introduction, Background, and Contributions and their coherence and alignment.`;

      const userPrompt = `Analyze the coherence and alignment of Abstract, Introduction, Background, and Contributions sections using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
Check SEVEN core dimensions:

1. ABSTRACT QUALITY & ACCURACY
   - states problem clearly?
   - states motivation?
   - outlines methodology (briefly)?
   - includes key findings/results?
   - matches what paper actually does?
   - avoids exaggerated claims or vague wording?
   - aligns fully with Introduction & Contributions?
   - Flag: contradictions, lacks results, oversells novelty, ambiguous/generic

2. PROBLEM DEFINITION CLARITY
   - clearly defines problem or research question?
   - explains why problem matters (impact)?
   - identifies target domain/context?
   - avoids vague, broad, or generic problem framing?
   - Flag: undefined/partial problem, too broad, doesn't match contributions

3. MOTIVATION & SIGNIFICANCE
   - provides real motivation?
   - clarifies need for solving problem?
   - avoids artificial or made-up motivations?
   - shows real-world or academic relevance?

4. CONTEXTUAL BACKGROUND QUALITY
   - technically correct?
   - introduces key concepts?
   - connects to problem?
   - missing necessary domain context?
   - Flag: incorrect technical background, missing foundational concepts, irrelevant descriptions

5. LOGICAL FLOW ACROSS SECTIONS
   Check alignment: Abstract → Introduction → Background → Contributions
   - consistency of problem statement?
   - consistency of objectives?
   - consistency of claimed solution?
   - contributions solve stated problem?
   - Flag contradictions

6. CONTRIBUTION VALIDITY & ALIGNMENT
   - contributions stated explicitly?
   - contributions specific or vague?
   - contributions solve defined problem?
   - contributions rely on background concepts?
   - contributions inflated or unrealistic?
   - Contribution types: methodological, experimental, theoretical, dataset, framework/tool, analysis, engineering, survey
   - Flag: unclear contributions, mismatch with problem, overclaiming, missing connection, redundancy

7. COHERENCE & INTEGRITY CHECK
   Detect:
   - contradictions between sections
   - missing justification for claims
   - circular reasoning
   - conceptual drift (problem shifts)
   - irrelevant background
   - abstract promising things not delivered

ISSUE GENERATION:
For each problem (use ONLY these types):
- "unclear_problem_statement", "weak_motivation", "missing_problem_definition"
- "misaligned_abstract", "unsupported_claim_in_abstract", "exaggerated_claim"
- "irrelevant_background", "incorrect_background", "missing_background"
- "unclear_contributions", "misaligned_contributions", "contribution_not_addressing_problem"
- "logical_inconsistency", "contradiction_between_sections", "shallow_introduction", "other_aibc_issue"

For each: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

SCORING (0-1 floats):
- abstract_quality
- abstract_accuracy
- problem_clarity
- motivation_strength
- background_quality
- section_alignment
- contribution_clarity
- contribution_alignment
- overall_AIBC_quality

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "AIBC-CoherenceAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "aibc_issues": [
    {
      "issue_id": "a1",
      "issue_type": "<allowed type>",
      "severity": "low|medium|high",
      "section": "<section>",
      "excerpt": "<text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "aibc_scores": {
    "abstract_quality": 0.0,
    "abstract_accuracy": 0.0,
    "problem_clarity": 0.0,
    "motivation_strength": 0.0,
    "background_quality": 0.0,
    "section_alignment": 0.0,
    "contribution_clarity": 0.0,
    "contribution_alignment": 0.0,
    "overall_AIBC_quality": 0.0
  },
  "aibc_summary": "<1-3 paragraphs>"
}

RULES:
- Do NOT evaluate related work, novelty, citations, datasets, methodology, or writing
- Do NOT invent content not present in structured_text
- ALL conclusions MUST come directly from structured_text
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<AIBCOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: AIBCOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        aibc_issues: llmResult.aibc_issues || [],
        aibc_scores: llmResult.aibc_scores || {
          abstract_quality: 0.5,
          abstract_accuracy: 0.5,
          problem_clarity: 0.5,
          motivation_strength: 0.5,
          background_quality: 0.5,
          section_alignment: 0.5,
          contribution_clarity: 0.5,
          contribution_alignment: 0.5,
          overall_AIBC_quality: 0.5,
        },
        aibc_summary: llmResult.aibc_summary || 'Analysis completed.',
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
      console.error(`Error in AIBC-CoherenceAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        aibc_issues: [],
        aibc_scores: {
          abstract_quality: 0,
          abstract_accuracy: 0,
          problem_clarity: 0,
          motivation_strength: 0,
          background_quality: 0,
          section_alignment: 0,
          contribution_clarity: 0,
          contribution_alignment: 0,
          overall_AIBC_quality: 0,
        },
        aibc_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

