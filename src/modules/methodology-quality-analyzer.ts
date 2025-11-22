/**
 * Module 7: MethodologyQualityAnalyzer
 * Evaluates the quality, rigor, clarity, and appropriateness of the methodology
 * Uses structured information from Module 2 (structure) and Module 6 (argumentation)
 * Does NOT analyze raw text, writing issues, citations, or argumentation logic
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import { extractTextFromPDF } from '../pdf/parser.js';
import { truncateStructuredText, estimateTokens } from '../utils/text-truncation.js';
import type { ModuleConfig } from '../types/index.js';

interface StructuredText {
  [sectionName: string]: string;
}

interface ArgumentationSummary {
  argumentation_summary?: string;
  claims?: Array<{
    claim_id: string;
    claim_type: string;
    section: string;
  }>;
}

interface Module7Input {
  document_id: string;
  structured_text: StructuredText;
  argumentation_summary?: ArgumentationSummary | null;
}

interface MethodologyElement {
  element_type: 'design' | 'data' | 'procedure' | 'algorithm' | 'metric' | 'tool' | 'variable' | 'evaluation' | 'other';
  section: string;
  excerpt: string;
}

interface MethodologyIssue {
  issue_id: string;
  issue_type: 'insufficient_detail' | 'weak_reproducibility' | 'inappropriate_method' | 'sampling_bias' | 'unclear_data_source' | 'measurement_issues' | 'confounding_factors' | 'overgeneralization_risk' | 'missing_baselines' | 'insufficient_experimental_control' | 'other_methodology_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface MethodologyScores {
  overall_methodology_quality: number;
  rigor: number;
  validity: number;
  reproducibility: number;
  appropriateness: number;
  completeness: number;
}

interface MethodologyOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  methodology_elements: MethodologyElement[];
  methodology_issues: MethodologyIssue[];
  methodology_scores: MethodologyScores;
  methodology_summary: string;
  error?: string;
}

export class MethodologyQualityAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'MethodologyQualityAnalyzer',
      description: 'Evaluates the quality, rigor, clarity, and appropriateness of the methodology',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('MethodologyQualityAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document based on Module 2 structure info
   * (Reusing logic from Module 6)
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

      // Focus on methodology-related sections
      const methodologySections = ['abstract', 'introduction', 'methods', 'methodology', 'experimental_setup', 'evaluation', 'data', 'participants', 'algorithms', 'procedures', 'results', 'discussion'];

      // Extract sections
      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of methodologySections) {
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
            // Include if it's methodology-relevant
            if (methodologySections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('method') || 
                normalizedName.includes('experiment') ||
                normalizedName.includes('data') ||
                normalizedName.includes('evaluation')) {
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
        // Filter to methodology-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (methodologySections.includes(key) || key.includes('method') || key.includes('experiment')) {
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
      { name: 'methods', patterns: [/methods?\s*[:\n]/i, /methodology\s*[:\n]/i] },
      { name: 'methodology', patterns: [/methodology\s*[:\n]/i] },
      { name: 'experimental_setup', patterns: [/experimental\s+setup\s*[:\n]/i, /experiment\s*[:\n]/i] },
      { name: 'data', patterns: [/data\s+collection\s*[:\n]/i, /dataset\s*[:\n]/i] },
      { name: 'evaluation', patterns: [/evaluation\s*[:\n]/i, /experiments?\s*[:\n]/i] },
      { name: 'results', patterns: [/results?\s*[:\n]/i, /findings\s*[:\n]/i] },
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
      case 'methods':
      case 'methodology':
        patterns.push(/methods?\s*[:\n]/i, /methodology\s*[:\n]/i);
        break;
      case 'experimental_setup':
        patterns.push(/experimental\s+setup\s*[:\n]/i, /experiment\s*[:\n]/i);
        break;
      case 'data':
        patterns.push(/data\s+collection\s*[:\n]/i, /dataset\s*[:\n]/i);
        break;
      case 'evaluation':
        patterns.push(/evaluation\s*[:\n]/i);
        break;
      case 'results':
        patterns.push(/results?\s*[:\n]/i);
        break;
      case 'discussion':
        patterns.push(/discussion\s*[:\n]/i);
        break;
    }

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match && match.index !== undefined) {
        const start = match.index + match[0].length;
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
   * Get argumentation summary from Module 6
   */
  async getArgumentationSummary(paperId: string): Promise<ArgumentationSummary | null> {
    try {
      const module6Assessment = await getLatestAssessment(paperId, 'ArgumentationAndClaimSupportAnalyzer');
      if (module6Assessment && module6Assessment.result) {
        const result = module6Assessment.result as any;
        return {
          argumentation_summary: result.argumentation_summary,
          claims: result.claims,
        };
      }
    } catch (error) {
      // Argumentation summary is optional
    }
    return null;
  }

  /**
   * Process document and generate methodology quality analysis
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
          methodology_elements: [],
          methodology_issues: [],
          methodology_scores: {
            overall_methodology_quality: 0,
            rigor: 0,
            validity: 0,
            reproducibility: 0,
            appropriateness: 0,
            completeness: 0,
          },
          methodology_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on methodology sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any methodology-relevant sections
      const hasMethodologyContent = Object.keys(structuredText).some(key => 
        key.includes('method') || 
        key.includes('experiment') || 
        key.includes('data') ||
        key.includes('evaluation') ||
        key === 'abstract' ||
        key === 'introduction'
      );

      if (!hasMethodologyContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          methodology_elements: [],
          methodology_issues: [],
          methodology_scores: {
            overall_methodology_quality: 0,
            rigor: 0,
            validity: 0,
            reproducibility: 0,
            appropriateness: 0,
            completeness: 0,
          },
          methodology_summary: '',
          error: 'Missing or invalid structured_text for methodology. No methodology-relevant sections found.',
        };
      }

      // Get argumentation summary (optional)
      const argumentationSummary = await this.getArgumentationSummary(searchId);

      // Truncate structured text if too large to prevent rate limits
      let processedStructuredText = structuredText;
      const estimatedTokens = estimateTokens(JSON.stringify(structuredText));
      
      if (estimatedTokens > 25000) {
        console.log(`  [Module 7] Input too large (${estimatedTokens} tokens), truncating...`);
        processedStructuredText = truncateStructuredText(structuredText, 4000, [
          'abstract', 'introduction', 'methodology', 'methods', 'experimental_setup', 'data', 'evaluation', 'results', 'conclusion', 'discussion'
        ]);
        const newTokens = estimateTokens(JSON.stringify(processedStructuredText));
        console.log(`  [Module 7] Truncated to ${newTokens} tokens`);
      }

      // Prepare input for LLM
      const input: Module7Input = {
        document_id: documentId,
        structured_text: processedStructuredText,
        argumentation_summary: argumentationSummary,
      };

      // Call OpenAI to generate methodology analysis
      const systemPrompt = `You are Module 7: "MethodologyQualityAnalyzer" for the PaperMock3 system. Your ONLY job is to evaluate the quality, rigor, clarity, and appropriateness of the methodology. You MUST NOT:
- Parse raw PDF pages (use only structured_text provided)
- Detect writing issues (Module 4 does this)
- Evaluate citations formatting/recency (Module 3 does this)
- Analyze argumentation logic (Module 6 does this)
- Detect structure (Module 2 does this)
- Rewrite text

You ONLY analyze the methodological soundness of the work.`;

      const userPrompt = `Analyze the methodology quality of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
1. IDENTIFY METHODOLOGY ELEMENTS
   Extract and categorize:
   - research design (experimental? survey? theoretical? simulation? case study?)
   - data sources / datasets / participants
   - procedures / protocols / workflow
   - variables, features, and measurements
   - tools / instruments / algorithms used
   - evaluation metrics
   - experimental conditions
   - reproducibility details (hyperparameters, settings, sample sizes, etc.)
   
   For each element: element_type, section, excerpt

2. ASSESS METHODOLOGICAL QUALITY
   Evaluate (0-1 scores):
   - clarity (is the method described enough to understand?)
   - rigor (is it thorough and systematic?)
   - validity (does the method actually test the research question?)
   - reproducibility (are steps detailed enough to replicate?)
   - appropriateness (is this method appropriate for this research type?)
   - completeness (are key methodological elements missing?)

3. DETECT METHODOLOGY ISSUES
   Look for (use ONLY these types):
   - "insufficient_detail" (missing steps or unclear procedure)
   - "weak_reproducibility" (hyperparameters, parameters missing)
   - "inappropriate_method" (method does not match research question)
   - "sampling_bias" (biased or unclear sampling)
   - "unclear_data_source" (dataset/participants not described)
   - "measurement_issues" (inadequate metrics or tools)
   - "confounding_factors" (lack of control variables)
   - "overgeneralization_risk" (method cannot generalize)
   - "missing_baselines" (no comparisons)
   - "insufficient_experimental_control"
   - "other_methodology_issue"
   
   For each issue: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

4. PRODUCE METHODOLOGY SCORES (0-1 floats)
   - overall_methodology_quality
   - rigor
   - validity
   - reproducibility
   - appropriateness
   - completeness

5. HIGH-LEVEL METHODOLOGY SUMMARY
   - 1-3 paragraph narrative summarizing strengths, weaknesses, appropriateness, major missing/weak components

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "MethodologyQualityAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "methodology_elements": [
    {
      "element_type": "design|data|procedure|algorithm|metric|tool|variable|evaluation|other",
      "section": "<section_name>",
      "excerpt": "<short text>"
    }
  ],
  "methodology_issues": [
    {
      "issue_id": "m1",
      "issue_type": "<one of allowed types>",
      "severity": "low|medium|high",
      "section": "<section_name>",
      "excerpt": "<short problematic text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "methodology_scores": {
    "overall_methodology_quality": 0.0,
    "rigor": 0.0,
    "validity": 0.0,
    "reproducibility": 0.0,
    "appropriateness": 0.0,
    "completeness": 0.0
  },
  "methodology_summary": "<1-3 paragraph narrative>"
}

RULES:
- Do NOT invent methods not present in structured_text
- Do NOT evaluate writing style
- Do NOT evaluate argumentation logic
- Do NOT rewrite or edit content
- ALL conclusions MUST come directly from structured_text
- Always output deterministic, structured JSON
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<MethodologyOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: MethodologyOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        methodology_elements: llmResult.methodology_elements || [],
        methodology_issues: llmResult.methodology_issues || [],
        methodology_scores: llmResult.methodology_scores || {
          overall_methodology_quality: 0.5,
          rigor: 0.5,
          validity: 0.5,
          reproducibility: 0.5,
          appropriateness: 0.5,
          completeness: 0.5,
        },
        methodology_summary: llmResult.methodology_summary || 'Analysis completed.',
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
      console.error(`Error in MethodologyQualityAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        methodology_elements: [],
        methodology_issues: [],
        methodology_scores: {
          overall_methodology_quality: 0,
          rigor: 0,
          validity: 0,
          reproducibility: 0,
          appropriateness: 0,
          completeness: 0,
        },
        methodology_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

