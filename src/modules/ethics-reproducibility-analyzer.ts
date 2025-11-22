/**
import { truncateStructuredText, estimateTokens } from '../utils/text-truncation.js'; * Module 14: EthicsReproducibilityTransparencyAnalyzer
 * Evaluates ethical responsibility, reproducibility quality, and transparency
 * Uses structured information from Module 2 (structure) and Module 6 (claims)
 * Does NOT analyze datasets, methodology, statistical validity, novelty, robustness, literature review, writing, argument, abstract/intro, or structure
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

interface Module14Input {
  document_id: string;
  structured_text: StructuredText;
  claims?: Claim[] | null;
}

interface ERTIssue {
  issue_id: string;
  issue_type: 'missing_ethics_discussion' | 'incomplete_ethics_analysis' | 'misuse_risk_unaddressed' | 'privacy_risk' | 'sensitive_data_not_protected' | 'bias_risk_unaddressed' | 'missing_limitations' | 'hidden_weaknesses' | 'exaggerated_claim' | 'insufficient_reproducibility' | 'missing_hyperparameters' | 'missing_training_details' | 'missing_seed_or_env_details' | 'missing_dataset_access_info' | 'lack_of_transparency' | 'missing_IRB_or_approval' | 'missing_fairness_discussion' | 'other_ethics_reproducibility_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface ERTScores {
  ethics_completeness: number;
  risk_awareness: number;
  transparency_level: number;
  limitation_quality: number;
  reproducibility_completeness: number;
  responsible_research_quality: number;
  overall_ethics_reproducibility_quality: number;
}

interface ERTOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  ert_issues: ERTIssue[];
  ert_scores: ERTScores;
  ert_summary: string;
  error?: string;
}

export class EthicsReproducibilityTransparencyAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'EthicsReproducibilityTransparencyAnalyzer',
      description: 'Evaluates ethical responsibility, reproducibility quality, and transparency: ethics, risk analysis, limitations, reproducibility details',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('EthicsReproducibilityTransparencyAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on ethics/reproducibility sections
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

      // Focus on ethics/reproducibility-related sections
      const ertSections = [
        'ethics', 'limitations', 'reproducibility', 'discussion',
        'evaluation', 'methodology', 'experiments', 'data',
        'risk_analysis', 'ethical_considerations', 'conclusion'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of ertSections) {
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
            // Include if it's ERT-relevant
            if (ertSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('ethic') || 
                normalizedName.includes('limitation') ||
                normalizedName.includes('reproducib') ||
                normalizedName.includes('risk') ||
                normalizedName.includes('discussion') ||
                normalizedName.includes('conclusion') ||
                normalizedName.includes('method') ||
                normalizedName.includes('experiment')) {
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
        // Include all heuristic sections as they may contain relevant info
        Object.assign(structuredText, heuristicSections);
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
      { name: 'ethics', patterns: [/ethic\s*[:\n]/i, /ethical\s+consideration\s*[:\n]/i] },
      { name: 'limitations', patterns: [/limitation\s*[:\n]/i, /limitations\s*[:\n]/i] },
      { name: 'reproducibility', patterns: [/reproducib\s*[:\n]/i] },
      { name: 'discussion', patterns: [/discussion\s*[:\n]/i] },
      { name: 'conclusion', patterns: [/conclusion\s*[:\n]/i, /conclusions?\s*[:\n]/i] },
      { name: 'methods', patterns: [/methods?\s*[:\n]/i, /methodology\s*[:\n]/i] },
      { name: 'experiments', patterns: [/experiments?\s*[:\n]/i, /evaluation\s*[:\n]/i] },
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
          const nextSectionPattern = /(?:references?|bibliography|appendix)\s*[:\n]/i;
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
      case 'ethics':
        patterns.push(/ethic\s*[:\n]/i, /ethical\s+consideration\s*[:\n]/i);
        break;
      case 'limitations':
        patterns.push(/limitation\s*[:\n]/i, /limitations\s*[:\n]/i);
        break;
      case 'reproducibility':
        patterns.push(/reproducib\s*[:\n]/i);
        break;
      case 'discussion':
        patterns.push(/discussion\s*[:\n]/i);
        break;
      case 'conclusion':
        patterns.push(/conclusion\s*[:\n]/i);
        break;
      case 'methods':
      case 'methodology':
        patterns.push(/methods?\s*[:\n]/i, /methodology\s*[:\n]/i);
        break;
      case 'experiments':
      case 'evaluation':
        patterns.push(/experiments?\s*[:\n]/i, /evaluation\s*[:\n]/i);
        break;
    }

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match.index !== undefined) {
        const start = match.index + match[0].length;
        const nextSectionPattern = /(?:limitation|reproducib|discussion|conclusion|references?|bibliography|appendix)\s*[:\n]/i;
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
   * Process document and generate ethics/reproducibility/transparency analysis
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
          ert_issues: [],
          ert_scores: {
            ethics_completeness: 0,
            risk_awareness: 0,
            transparency_level: 0,
            limitation_quality: 0,
            reproducibility_completeness: 0,
            responsible_research_quality: 0,
            overall_ethics_reproducibility_quality: 0,
          },
          ert_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on ERT-related sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any ERT-relevant content
      const hasERTContent = Object.keys(structuredText).some(key => 
        key.includes('ethic') || 
        key.includes('limitation') ||
        key.includes('reproducib') ||
        key.includes('discussion') ||
        key.includes('conclusion') ||
        key.includes('method') ||
        key.includes('experiment') ||
        key.includes('risk')
      );

      if (!hasERTContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          ert_issues: [],
          ert_scores: {
            ethics_completeness: 0,
            risk_awareness: 0,
            transparency_level: 0,
            limitation_quality: 0,
            reproducibility_completeness: 0,
            responsible_research_quality: 0,
            overall_ethics_reproducibility_quality: 0,
          },
          ert_summary: '',
          error: 'No ethics, reproducibility, or limitations content found in structured_text.',
        };
      }

      // Get optional claims
      const claims = await this.getClaims(searchId);

      // Prepare input for LLM
      const input: Module14Input = {
        document_id: documentId,
        structured_text: structuredText,
        claims: claims,
      };

      // Call OpenAI to generate ERT analysis
      const systemPrompt = `You are Module 14: "EthicsReproducibilityTransparencyAnalyzer" for the PaperMock3 system. Your ONLY job is to evaluate ethical responsibility, reproducibility quality, and transparency. You MUST NOT:
${getAccuracyRulesSystemAddition()}
- Evaluate dataset quality or balance (Module 8 does this)
- Evaluate methodology soundness (Module 7 does this)
- Evaluate statistical validity (Module 12 does this)
- Evaluate novelty/contributions (Module 9 does this)
- Evaluate robustness/generalization (Module 13 does this)
- Evaluate literature review (Module 10 does this)
- Evaluate writing grammar or style (Module 4 does this)
- Evaluate argument coherence (Module 6 does this)
- Check abstract/intro/background (Module 11 does this)
- Parse PDFs or detect structure (Module 2 does this)

You ONLY use the provided structured_text to analyze ethics, reproducibility, and transparency.`;

      const userPrompt = `Analyze the ethics, reproducibility, and transparency of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
Evaluate across FOUR core categories:

1. ETHICS & RISK ANALYSIS
   - acknowledges possible ethical issues?
   - addresses potential misuse?
   - mentions harm risks?
   - data contains sensitive information?
   - privacy-preserving measures described?
   - Risk of: discrimination, bias amplification, security issues, misuse in adversarial settings?
   - Flag: missing ethics discussion, incomplete risk discussion, failure to consider misuse, ethical risks unaddressed

2. TRANSPARENCY & HONESTY OF REPORTING
   - explicitly state limitations?
   - weaknesses honestly acknowledged?
   - reveal assumptions?
   - hide negative results?
   - overstate impact or scope?
   - Flag: no limitation section, unrealistic/exaggerated claims, omission of known weaknesses, misleading/incomplete disclosure

3. REPRODUCIBILITY QUALITY
   - enough detail to reproduce experiments?
   - code availability (if mentioned)?
   - hyperparameters, configs, training details?
   - environment versions (frameworks, hardware)?
   - seeds and randomness controls?
   - access to dataset or instructions to obtain it?
   - description of preprocessing steps?
   - Flag: insufficient detail, missing hyperparameters, vague/incomplete experimental description, missing training details, missing dataset access info

4. RESPONSIBLE RESEARCH PRACTICES
   - ethical approvals required (e.g., human data)? If yes, is it mentioned?
   - acknowledge societal impact?
   - discuss fairness considerations?
   - avoid overstating generality of results?
   - specify safe usage guidelines (if relevant)?
   - Flag: missing IRB/ethics approval (when required), ignoring environmental/social impact, ignoring fairness concerns, failure to contextualize potential harm

ISSUE GENERATION:
For each problem (use ONLY these types):
- "missing_ethics_discussion", "incomplete_ethics_analysis", "misuse_risk_unaddressed"
- "privacy_risk", "sensitive_data_not_protected", "bias_risk_unaddressed"
- "missing_limitations", "hidden_weaknesses", "exaggerated_claim"
- "insufficient_reproducibility", "missing_hyperparameters", "missing_training_details"
- "missing_seed_or_env_details", "missing_dataset_access_info", "lack_of_transparency"
- "missing_IRB_or_approval", "missing_fairness_discussion", "other_ethics_reproducibility_issue"

For each: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

SCORING (0-1 floats):
- ethics_completeness
- risk_awareness
- transparency_level
- limitation_quality
- reproducibility_completeness
- responsible_research_quality
- overall_ethics_reproducibility_quality

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "EthicsReproducibilityTransparencyAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "ert_issues": [
    {
      "issue_id": "ert1",
      "issue_type": "<allowed type>",
      "severity": "low|medium|high",
      "section": "<section>",
      "excerpt": "<text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "ert_scores": {
    "ethics_completeness": 0.0,
    "risk_awareness": 0.0,
    "transparency_level": 0.0,
    "limitation_quality": 0.0,
    "reproducibility_completeness": 0.0,
    "responsible_research_quality": 0.0,
    "overall_ethics_reproducibility_quality": 0.0
  },
  "ert_summary": "<1-3 paragraphs>"
}

RULES:
- Do NOT evaluate datasets, methodology, statistical validity, novelty, robustness, literature review, writing, argument, abstract/intro, or structure
- Do NOT infer missing sections
- Use ONLY provided structured_text
- ALL conclusions MUST come directly from structured_text
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<ERTOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: ERTOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        ert_issues: llmResult.ert_issues || [],
        ert_scores: llmResult.ert_scores || {
          ethics_completeness: 0.5,
          risk_awareness: 0.5,
          transparency_level: 0.5,
          limitation_quality: 0.5,
          reproducibility_completeness: 0.5,
          responsible_research_quality: 0.5,
          overall_ethics_reproducibility_quality: 0.5,
        },
        ert_summary: llmResult.ert_summary || 'Analysis completed.',
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
      console.error(`Error in EthicsReproducibilityTransparencyAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        ert_issues: [],
        ert_scores: {
          ethics_completeness: 0,
          risk_awareness: 0,
          transparency_level: 0,
          limitation_quality: 0,
          reproducibility_completeness: 0,
          responsible_research_quality: 0,
          overall_ethics_reproducibility_quality: 0,
        },
        ert_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

