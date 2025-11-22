/**
 * Module 13: RobustnessAndGeneralizationAnalyzer
 * Analyzes how well the proposed method/model/system generalizes and how robust it is
 * Uses structured information from Module 2 (structure) and Module 6 (claims)
 * Does NOT analyze datasets, methodology, novelty, literature review, abstract/intro, results quality, statistical correctness, citations, structure, or writing
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import { extractTextFromPDF } from '../pdf/parser.js';
import type { ModuleConfig } from '../types/index.js';

interface StructuredText {
  [sectionName: string]: string;
}

interface Claim {
  claim_id: string;
  claim_type: string;
  section: string;
  excerpt: string;
}

interface Module13Input {
  document_id: string;
  structured_text: StructuredText;
  claims?: Claim[] | null;
}

interface RobustnessIssue {
  issue_id: string;
  issue_type: 'missing_cross_domain_tests' | 'unsupported_generalization_claim' | 'no_seed_stability' | 'high_variance_across_seeds' | 'missing_ablation' | 'incomplete_ablation' | 'missing_hyperparameter_sensitivity' | 'hyperparameter_fragility' | 'missing_noise_tests' | 'missing_failure_mode_analysis' | 'overgeneralization' | 'fragile_model_behavior' | 'other_robustness_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface RobustnessScores {
  cross_domain_generalization: number;
  seed_stability: number;
  ablation_quality: number;
  hyperparameter_sensitivity_analysis: number;
  noise_robustness: number;
  failure_mode_analysis_quality: number;
  generalization_claim_validity: number;
  overall_robustness_quality: number;
}

interface RobustnessOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  robustness_issues: RobustnessIssue[];
  robustness_scores: RobustnessScores;
  robustness_summary: string;
  error?: string;
}

export class RobustnessAndGeneralizationAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'RobustnessAndGeneralizationAnalyzer',
      description: 'Analyzes robustness and generalization: cross-domain, seed stability, ablation, hyperparameter sensitivity, noise robustness, failure modes',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('RobustnessAndGeneralizationAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on robustness-related sections
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

      // Focus on robustness-related sections
      const robustnessSections = [
        'results', 'evaluation', 'experiments', 'experimental_results',
        'discussion', 'ablation', 'robustness', 'generalization',
        'sensitivity', 'stability'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of robustnessSections) {
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
            // Include if it's robustness-relevant
            if (robustnessSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('result') || 
                normalizedName.includes('experiment') ||
                normalizedName.includes('evaluation') ||
                normalizedName.includes('ablation') ||
                normalizedName.includes('robust') ||
                normalizedName.includes('generaliz') ||
                normalizedName.includes('sensitivity') ||
                normalizedName.includes('stability')) {
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
        // Filter to robustness-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (robustnessSections.includes(key) || key.includes('result') || key.includes('experiment')) {
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
      { name: 'results', patterns: [/results?\s*[:\n]/i, /findings\s*[:\n]/i] },
      { name: 'evaluation', patterns: [/evaluation\s*[:\n]/i, /experiments?\s*[:\n]/i] },
      { name: 'ablation', patterns: [/ablation\s*[:\n]/i] },
      { name: 'discussion', patterns: [/discussion\s*[:\n]/i] },
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
          const nextSectionPattern = /(?:conclusion|references?|bibliography|appendix)\s*[:\n]/i;
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
      case 'results':
        patterns.push(/results?\s*[:\n]/i, /findings\s*[:\n]/i);
        break;
      case 'evaluation':
      case 'experiments':
        patterns.push(/evaluation\s*[:\n]/i, /experiments?\s*[:\n]/i);
        break;
      case 'ablation':
        patterns.push(/ablation\s*[:\n]/i);
        break;
      case 'discussion':
        patterns.push(/discussion\s*[:\n]/i);
        break;
    }

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match.index !== undefined) {
        const start = match.index + match[0].length;
        const nextSectionPattern = /(?:discussion|conclusion|references?|bibliography|appendix)\s*[:\n]/i;
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
   * Process document and generate robustness and generalization analysis
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
          robustness_issues: [],
          robustness_scores: {
            cross_domain_generalization: 0,
            seed_stability: 0,
            ablation_quality: 0,
            hyperparameter_sensitivity_analysis: 0,
            noise_robustness: 0,
            failure_mode_analysis_quality: 0,
            generalization_claim_validity: 0,
            overall_robustness_quality: 0,
          },
          robustness_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on robustness-related sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any robustness-relevant content
      const hasRobustnessContent = Object.keys(structuredText).some(key => 
        key.includes('result') || 
        key.includes('experiment') ||
        key.includes('evaluation') ||
        key.includes('ablation') ||
        key.includes('robust') ||
        key.includes('generaliz') ||
        key.includes('sensitivity') ||
        key.includes('stability')
      );

      if (!hasRobustnessContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          robustness_issues: [],
          robustness_scores: {
            cross_domain_generalization: 0,
            seed_stability: 0,
            ablation_quality: 0,
            hyperparameter_sensitivity_analysis: 0,
            noise_robustness: 0,
            failure_mode_analysis_quality: 0,
            generalization_claim_validity: 0,
            overall_robustness_quality: 0,
          },
          robustness_summary: '',
          error: 'No robustness or generalization-relevant content found in structured_text.',
        };
      }

      // Get optional claims
      const claims = await this.getClaims(searchId);

      // Prepare input for LLM
      const input: Module13Input = {
        document_id: documentId,
        structured_text: structuredText,
        claims: claims,
      };

      // Call OpenAI to generate robustness analysis
      const systemPrompt = `You are Module 13: "RobustnessAndGeneralizationAnalyzer" for the PaperMock3 system. Your ONLY job is to analyze how well the proposed method/model/system generalizes and how robust it is. You MUST NOT:
- Evaluate dataset quality (Module 8 does this)
- Evaluate methodology design (Module 7 does this)
- Evaluate novelty (Module 9 does this)
- Evaluate literature review (Module 10 does this)
- Evaluate abstract/intro (Module 11 does this)
- Evaluate results quality itself (Module 12 does this)
- Evaluate statistical correctness (Module 12 does this)
- Analyze citations (Module 3 does this)
- Detect structure (Module 2 does this)
- Parse PDFs or text outside structured_text
- Analyze writing/grammar (Module 4 does this)

You ONLY analyze robustness and generalization based on the content available in structured_text.`;

      const userPrompt = `Analyze the robustness and generalization of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
Evaluate robustness & generalization across SEVEN dimensions:

1. CROSS-DOMAIN GENERALIZATION
   - tested multiple datasets or domains?
   - justified generalization claims?
   - results consistent across domains?
   - If only ONE dataset is used → flag unsupported generalization claims

2. RANDOMNESS / SEED STABILITY
   - performance reported across multiple seeds?
   - variation reasonable?
   - results fluctuate heavily?
   - generalization claims stable across seeds?
   - Do NOT judge statistical correctness (Module 12 handles that)

3. ABLATION STUDIES & COMPONENT SENSITIVITY
   - components tested individually?
   - ablation results show consistent behavior?
   - signs of fragile dependence on single component?

4. HYPERPARAMETER SENSITIVITY
   - different hyperparameter ranges tested?
   - results highly sensitive to small changes?
   - If sensitivity unknown → flag as missing robustness evaluation

5. NOISE / PERTURBATION ROBUSTNESS
   - tested robustness to noise, perturbations, adversarial variations, corruption, missing values, or distribution drift (if relevant)?
   - If domain typically requires noise testing (e.g., IDS, image classification, NLP adversarial) → missing noise tests = robustness gap

6. FAILURE MODE ANALYSIS
   - identified when/why model fails?
   - discuss limitations honestly?
   - failure mode analysis missing entirely?

7. OVERGENERALIZATION DETECTION
   - make broad claims unsupported by actual robustness tests?
   - imply real-world robustness without evidence?
   - claim "state-of-the-art across all scenarios" with narrow testing?

ISSUE GENERATION:
For each problem (use ONLY these types):
- "missing_cross_domain_tests", "unsupported_generalization_claim"
- "no_seed_stability", "high_variance_across_seeds"
- "missing_ablation", "incomplete_ablation"
- "missing_hyperparameter_sensitivity", "hyperparameter_fragility"
- "missing_noise_tests", "missing_failure_mode_analysis"
- "overgeneralization", "fragile_model_behavior", "other_robustness_issue"

For each: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

ROBUSTNESS & GENERALIZATION SCORES (0-1 floats):
- cross_domain_generalization
- seed_stability
- ablation_quality
- hyperparameter_sensitivity_analysis
- noise_robustness
- failure_mode_analysis_quality
- generalization_claim_validity
- overall_robustness_quality

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "RobustnessAndGeneralizationAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "robustness_issues": [
    {
      "issue_id": "rg1",
      "issue_type": "<allowed type>",
      "severity": "low|medium|high",
      "section": "<section>",
      "excerpt": "<text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "robustness_scores": {
    "cross_domain_generalization": 0.0,
    "seed_stability": 0.0,
    "ablation_quality": 0.0,
    "hyperparameter_sensitivity_analysis": 0.0,
    "noise_robustness": 0.0,
    "failure_mode_analysis_quality": 0.0,
    "generalization_claim_validity": 0.0,
    "overall_robustness_quality": 0.0
  },
  "robustness_summary": "<1-3 paragraphs>"
}

RULES:
- Do NOT evaluate datasets, methodology, novelty, literature review, abstract/intro, results quality, statistical correctness, citations, structure, or writing
- Do NOT invent experiments or datasets
- Only evaluate what is present in structured_text
- ALL conclusions MUST come directly from structured_text
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<RobustnessOutput>(
        userPrompt,
        'gpt-4o-mini',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: RobustnessOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        robustness_issues: llmResult.robustness_issues || [],
        robustness_scores: llmResult.robustness_scores || {
          cross_domain_generalization: 0.5,
          seed_stability: 0.5,
          ablation_quality: 0.5,
          hyperparameter_sensitivity_analysis: 0.5,
          noise_robustness: 0.5,
          failure_mode_analysis_quality: 0.5,
          generalization_claim_validity: 0.5,
          overall_robustness_quality: 0.5,
        },
        robustness_summary: llmResult.robustness_summary || 'Analysis completed.',
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
      console.error(`Error in RobustnessAndGeneralizationAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        robustness_issues: [],
        robustness_scores: {
          cross_domain_generalization: 0,
          seed_stability: 0,
          ablation_quality: 0,
          hyperparameter_sensitivity_analysis: 0,
          noise_robustness: 0,
          failure_mode_analysis_quality: 0,
          generalization_claim_validity: 0,
          overall_robustness_quality: 0,
        },
        robustness_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

