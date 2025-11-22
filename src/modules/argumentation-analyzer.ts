/**
 * Module 6: ArgumentationAndClaimSupportAnalyzer
 * Analyzes logical structure, claim-evidence alignment, and argumentation quality
 * Uses structured information from Module 2 (structure) and Module 3 (citations)
 * Does NOT analyze raw text, writing issues, citation formatting, or rewrite text
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
    has_references_section?: boolean;
    total_references_detected?: number;
    unmatched_in_text_citations_count?: number;
    uncited_references_count?: number;
  };
  problems?: Array<{
    severity: 'low' | 'medium' | 'high';
    type: string;
    description: string;
  }>;
}

interface Module6Input {
  document_id: string;
  structured_text: StructuredText;
  citation_analysis?: CitationAnalysis | null;
}

interface Claim {
  claim_id: string;
  claim_type: 'research_question' | 'contribution' | 'empirical_result' | 'theoretical_claim' | 'conclusion_claim' | 'assumption';
  section: string;
  excerpt: string;
}

interface ClaimEvidenceAlignment {
  claim_id: string;
  evidence_strength: 'strong' | 'moderate' | 'weak' | 'missing';
  evidence_location: string | null;
  explanation: string;
}

interface ArgumentationIssue {
  issue_id: string;
  issue_type: 'unsupported_claim' | 'overstated_conclusion' | 'problem-method_mismatch' | 'method-result_mismatch' | 'conclusion-mismatch' | 'ambiguous_or_hidden_assumption' | 'misinterpretation_of_results' | 'inconsistent_positioning_with_related_work' | 'lack_of_limitations_acknowledgment' | 'other_argumentation_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  claim_ids: string[];
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface ArgumentationScores {
  overall_argument_quality: number;
  claim_support: number;
  logical_consistency: number;
  alignment_with_problem: number;
  interpretation_faithfulness: number;
  novelty_positioning: number;
}

interface ArgumentationOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  claims: Claim[];
  claim_evidence_alignment: ClaimEvidenceAlignment[];
  argumentation_issues: ArgumentationIssue[];
  argumentation_scores: ArgumentationScores;
  argumentation_summary: string;
  error?: string;
}

export class ArgumentationAndClaimSupportAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'ArgumentationAndClaimSupportAnalyzer',
      description: 'Analyzes logical structure, claim-evidence alignment, and argumentation quality',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('ArgumentationAndClaimSupportAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document based on Module 2 structure info
   */
  async extractStructuredText(documentText: string, paperId: string): Promise<StructuredText> {
    try {
      // Get Module 2 structure information
      const module2Assessment = await getLatestAssessment(paperId, 'StructuralScanner');
      if (!module2Assessment || !module2Assessment.result) {
        // If no structure info, try to extract sections heuristically
        return this.extractSectionsHeuristically(documentText);
      }

      const structureInfo = module2Assessment.result as any;
      const structuredText: StructuredText = {};

      // Extract sections based on detected structure
      // We'll use section boundaries detected by Module 2
      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      // For now, use a simple approach: extract text between section markers
      // In a more sophisticated implementation, we'd use the start_index from dynamic_headings
      const sectionNames = ['abstract', 'introduction', 'literature_review', 'methodology', 'methods', 'results', 'discussion', 'conclusion'];

      for (const sectionName of sectionNames) {
        const sectionInfo = sections[sectionName];
        if (sectionInfo && sectionInfo.exists) {
          // Try to extract section text using heuristics
          const sectionText = this.extractSectionText(documentText, sectionName);
          if (sectionText) {
            structuredText[sectionName] = sectionText;
          }
        }
      }

      // If we have dynamic headings, use them to extract more precise sections
      if (dynamicHeadings.length > 0) {
        // Sort by start_index
        const sortedHeadings = [...dynamicHeadings].sort((a, b) => a.start_index - b.start_index);
        
        for (let i = 0; i < sortedHeadings.length; i++) {
          const heading = sortedHeadings[i];
          const nextHeading = sortedHeadings[i + 1];
          const start = heading.start_index;
          const end = nextHeading ? nextHeading.start_index : documentText.length;
          const sectionText = documentText.substring(start, end).trim();
          
          if (sectionText.length > 100) { // Only include substantial sections
            const normalizedName = heading.normalized_title.toLowerCase().replace(/\s+/g, '_');
            if (!structuredText[normalizedName] || structuredText[normalizedName].length < sectionText.length) {
              structuredText[normalizedName] = sectionText;
            }
          }
        }
      }

      // If we still don't have enough structured text, use heuristics
      if (Object.keys(structuredText).length < 2) {
        const heuristicSections = this.extractSectionsHeuristically(documentText);
        Object.assign(structuredText, heuristicSections);
      }

      return structuredText;
    } catch (error) {
      console.error('Error extracting structured text:', error);
      // Fallback to heuristic extraction
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
      { name: 'literature_review', patterns: [/literature\s+review\s*[:\n]/i, /related\s+work\s*[:\n]/i, /background\s*[:\n]/i] },
      { name: 'methodology', patterns: [/methodology\s*[:\n]/i, /methods?\s*[:\n]/i, /method\s*[:\n]/i] },
      { name: 'results', patterns: [/results?\s*[:\n]/i, /findings\s*[:\n]/i] },
      { name: 'discussion', patterns: [/discussion\s*[:\n]/i] },
      { name: 'conclusion', patterns: [/conclusion\s*[:\n]/i, /conclusions?\s*[:\n]/i] },
    ];

    for (const { name, patterns } of sectionPatterns) {
      for (const pattern of patterns) {
        const match = documentText.match(pattern);
        if (match && match.index !== undefined) {
          const start = match.index + match[0].length;
          // Find the next section or end of document
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
          if (sectionText.length > 200) { // Only include substantial sections
            structuredText[name] = sectionText;
            break; // Use first match
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
      case 'literature_review':
        patterns.push(/literature\s+review\s*[:\n]/i, /related\s+work\s*[:\n]/i);
        break;
      case 'methodology':
      case 'methods':
        patterns.push(/methodology\s*[:\n]/i, /methods?\s*[:\n]/i);
        break;
      case 'results':
        patterns.push(/results?\s*[:\n]/i);
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
        // Find next major section
        const nextSectionPattern = /(?:introduction|methods?|methodology|results?|discussion|conclusion|references?|bibliography)\s*[:\n]/i;
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
   * Process document and generate argumentation analysis
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
        // Try to get text from Module 1 assessment
        const module1Assessment = await getLatestAssessment(searchId, 'IngestionAndAppropriateness');
        if (!module1Assessment) {
          return {
            module: this.config.name,
            version: this.config.version,
            success: false,
            document_id: documentId,
            claims: [],
            claim_evidence_alignment: [],
            argumentation_issues: [],
            argumentation_scores: {
              overall_argument_quality: 0,
              claim_support: 0,
              logical_consistency: 0,
              alignment_with_problem: 0,
              interpretation_faithfulness: 0,
              novelty_positioning: 0,
            },
            argumentation_summary: '',
            error: 'Document text not available. Please provide paperPath or ensure Module 1 has been run.',
          };
        }
        // Note: Module 1 doesn't store full text, so we'd need paperPath
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          claims: [],
          claim_evidence_alignment: [],
          argumentation_issues: [],
          argumentation_scores: {
            overall_argument_quality: 0,
            claim_support: 0,
            logical_consistency: 0,
            alignment_with_problem: 0,
            interpretation_faithfulness: 0,
            novelty_positioning: 0,
          },
          argumentation_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text
      const structuredText = await this.extractStructuredText(documentText, searchId);

      if (Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          claims: [],
          claim_evidence_alignment: [],
          argumentation_issues: [],
          argumentation_scores: {
            overall_argument_quality: 0,
            claim_support: 0,
            logical_consistency: 0,
            alignment_with_problem: 0,
            interpretation_faithfulness: 0,
            novelty_positioning: 0,
          },
          argumentation_summary: '',
          error: 'Could not extract structured text from document. Sections may not be clearly defined.',
        };
      }

      // Get citation analysis
      const citationAnalysis = await this.getCitationAnalysis(searchId);

      // Prepare input for LLM
      const input: Module6Input = {
        document_id: documentId,
        structured_text: structuredText,
        citation_analysis: citationAnalysis,
      };

      // Call OpenAI to generate argumentation analysis
      const systemPrompt = `You are Module 6: "ArgumentationAndClaimSupportAnalyzer" for the PaperMock3 system. Your ONLY job is to analyze logical structure, claim-evidence alignment, and argumentation quality. You MUST NOT:
- Analyze raw PDF text (use only structured_text provided)
- Detect sentence-level writing issues (Module 4B does this)
- Evaluate citation formatting or quality (Module 3 does this)
- Perform safety/content moderation (Module 1 does this)
- Detect structure/sections (Module 2 does this)
- Rewrite text

You ONLY interpret logical relationships between claims, evidence, and argument flow.`;

      const userPrompt = `Analyze the argumentation quality of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
1. IDENTIFY MAIN CLAIMS AND CONTRIBUTIONS
   - Extract research questions/hypotheses
   - Identify claims of novelty or contribution
   - Find major empirical claims
   - Identify major conclusions
   - For each claim: assign claim_id, claim_type, section, excerpt

2. ANALYZE CLAIM ↔ EVIDENCE ALIGNMENT
   - For each important claim, check if supporting evidence is provided
   - Rate evidence_strength: "strong", "moderate", "weak", or "missing"
   - Note evidence_location (section name)
   - Provide short explanation

3. DETECT ARGUMENTATION ISSUES
   - unsupported_claim
   - overstated_conclusion
   - problem-method_mismatch
   - method-result_mismatch
   - conclusion-mismatch
   - ambiguous_or_hidden_assumption
   - misinterpretation_of_results
   - inconsistent_positioning_with_related_work
   - lack_of_limitations_acknowledgment
   - other_argumentation_issue
   - For each issue: issue_id, type, severity, section, claim_ids, excerpt, why_problematic, suggested_fix

4. EVALUATE OVERALL ARGUMENT QUALITY
   - Calculate scores (0.0-1.0) for:
     * overall_argument_quality
     * claim_support
     * logical_consistency
     * alignment_with_problem
     * interpretation_faithfulness
     * novelty_positioning

5. PROVIDE GLOBAL ARGUMENTATION SUMMARY
   - 1-3 paragraph narrative explaining strengths, weaknesses, where argument is strong, where it breaks

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "ArgumentationAndClaimSupportAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "claims": [
    {
      "claim_id": "c1",
      "claim_type": "research_question|contribution|empirical_result|theoretical_claim|conclusion_claim|assumption",
      "section": "<section_name>",
      "excerpt": "<short excerpt>"
    }
  ],
  "claim_evidence_alignment": [
    {
      "claim_id": "c1",
      "evidence_strength": "strong|moderate|weak|missing",
      "evidence_location": "<section_name or null>",
      "explanation": "<string>"
    }
  ],
  "argumentation_issues": [
    {
      "issue_id": "arg1",
      "issue_type": "<issue_type>",
      "severity": "low|medium|high",
      "section": "<section_name>",
      "claim_ids": ["c1"],
      "excerpt": "<problematic part>",
      "why_problematic": "<short explanation>",
      "suggested_fix": "<high-level suggestion>"
    }
  ],
  "argumentation_scores": {
    "overall_argument_quality": 0.0,
    "claim_support": 0.0,
    "logical_consistency": 0.0,
    "alignment_with_problem": 0.0,
    "interpretation_faithfulness": 0.0,
    "novelty_positioning": 0.0
  },
  "argumentation_summary": "<1-3 paragraph narrative>"
}

RULES:
- DO NOT invent content not present in structured_text
- DO NOT detect grammar or writing issues
- DO NOT evaluate citation formatting
- KEEP analysis strictly conceptual and logical
- Reference structured_text excerpts only
- Never output anything outside the JSON`;

      const llmResult = await callOpenAIJSON<ArgumentationOutput>(
        userPrompt,
        'gpt-4o-mini',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: ArgumentationOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        claims: llmResult.claims || [],
        claim_evidence_alignment: llmResult.claim_evidence_alignment || [],
        argumentation_issues: llmResult.argumentation_issues || [],
        argumentation_scores: llmResult.argumentation_scores || {
          overall_argument_quality: 0.5,
          claim_support: 0.5,
          logical_consistency: 0.5,
          alignment_with_problem: 0.5,
          interpretation_faithfulness: 0.5,
          novelty_positioning: 0.5,
        },
        argumentation_summary: llmResult.argumentation_summary || 'Analysis completed.',
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
      console.error(`Error in ArgumentationAndClaimSupportAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        claims: [],
        claim_evidence_alignment: [],
        argumentation_issues: [],
        argumentation_scores: {
          overall_argument_quality: 0,
          claim_support: 0,
          logical_consistency: 0,
          alignment_with_problem: 0,
          interpretation_faithfulness: 0,
          novelty_positioning: 0,
        },
        argumentation_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

