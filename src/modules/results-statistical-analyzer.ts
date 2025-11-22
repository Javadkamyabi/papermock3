/**
 * Module 12: ResultsAndStatisticalSoundnessAnalyzer
 * Performs comprehensive, rigorous evaluation of the Results section
 * Uses structured information from Module 2 (structure) and Module 6 (claims)
 * Does NOT analyze datasets, methodology, novelty, literature review, abstract/intro, argument logic, writing, structure, or citations
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

interface Module12Input {
  document_id: string;
  structured_text: StructuredText;
  claims?: Claim[] | null;
  metrics_used?: string[] | null;
}

interface ResultsIssue {
  issue_id: string;
  issue_type: 'missing_metric_variance' | 'missing_metrics' | 'inappropriate_metric_choice' | 'weak_baselines' | 'no_baseline_comparison' | 'unfair_comparison' | 'numerical_inconsistency' | 'unsupported_statistical_claim' | 'no_significance_testing' | 'overinterpretation' | 'contradiction_with_results' | 'irrelevant_results' | 'missing_ablation' | 'missing_result_details' | 'incomplete_results' | 'table_figure_inconsistency' | 'unclear_visualization' | 'other_results_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface ResultsScores {
  metric_completeness: number;
  statistical_validity: number;
  baseline_quality: number;
  numerical_consistency: number;
  interpretation_quality: number;
  visualization_quality: number;
  result_claim_alignment: number;
  overall_results_quality: number;
}

interface ResultsOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  results_issues: ResultsIssue[];
  results_scores: ResultsScores;
  results_summary: string;
  error?: string;
}

export class ResultsAndStatisticalSoundnessAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'ResultsAndStatisticalSoundnessAnalyzer',
      description: 'Performs comprehensive evaluation of Results section: metrics, statistical validity, baselines, numerical consistency, interpretation',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('ResultsAndStatisticalSoundnessAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on results sections
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

      // Focus on results-related sections
      const resultsSections = [
        'results', 'evaluation', 'experiments', 'experimental_results',
        'discussion', 'findings', 'performance'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of resultsSections) {
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
            // Include if it's results-relevant
            if (resultsSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('result') || 
                normalizedName.includes('experiment') ||
                normalizedName.includes('evaluation') ||
                normalizedName.includes('performance') ||
                normalizedName.includes('finding')) {
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
        // Filter to results-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (resultsSections.includes(key) || key.includes('result') || key.includes('experiment')) {
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
   * Process document and generate results analysis
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
          results_issues: [],
          results_scores: {
            metric_completeness: 0,
            statistical_validity: 0,
            baseline_quality: 0,
            numerical_consistency: 0,
            interpretation_quality: 0,
            visualization_quality: 0,
            result_claim_alignment: 0,
            overall_results_quality: 0,
          },
          results_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on results sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any results content
      const hasResultsContent = Object.keys(structuredText).some(key => 
        key.includes('result') || 
        key.includes('experiment') ||
        key.includes('evaluation') ||
        key.includes('performance') ||
        key.includes('finding')
      );

      if (!hasResultsContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          results_issues: [],
          results_scores: {
            metric_completeness: 0,
            statistical_validity: 0,
            baseline_quality: 0,
            numerical_consistency: 0,
            interpretation_quality: 0,
            visualization_quality: 0,
            result_claim_alignment: 0,
            overall_results_quality: 0,
          },
          results_summary: '',
          error: 'No results or evaluation section found in structured_text.',
        };
      }

      // Get optional claims
      const claims = await this.getClaims(searchId);

      // Prepare input for LLM
      const input: Module12Input = {
        document_id: documentId,
        structured_text: structuredText,
        claims: claims,
        metrics_used: null, // Could be extracted from structured text if needed
      };

      // Call OpenAI to generate results analysis
      const systemPrompt = `You are Module 12: "ResultsAndStatisticalSoundnessAnalyzer" for the PaperMock3 system. Your ONLY job is to perform comprehensive, rigorous evaluation of the Results section. You MUST NOT:
- Evaluate dataset quality (Module 8 does this)
- Evaluate methodology soundness or experiment design (Module 7 does this)
- Evaluate novelty or contributions (Module 9 does this)
- Evaluate literature review (Module 10 does this)
- Evaluate abstract/intro/background (Module 11 does this)
- Evaluate argument logic (Module 6 does this)
- Evaluate writing grammar or style (Module 4 does this)
- Parse PDF pages (use only structured_text provided)
- Re-evaluate structure or paper type (Module 2 does this)
- Re-check citations (Module 3 does this)

You ONLY evaluate the results themselves and their statistical correctness.`;

      const userPrompt = `Analyze the Results section of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
Perform EIGHT critical evaluations:

1. METRIC REPORTING COMPLETENESS
   - full set of metrics reported (precision/recall/F1, AUC, MSE, etc.)?
   - number of runs or seeds (if applicable)?
   - variance, standard deviation, or confidence intervals?
   - meaningful statistical indicators?
   - Flag: missing variance, missing metric explanation, use of accuracy on imbalanced datasets

2. BASELINES & COMPARISON QUALITY
   - strong baselines included?
   - baselines appropriate to claimed problem?
   - comparisons fair and consistent?
   - Flag: weak/outdated baselines, no baselines, cherry-picked comparisons, missing SOTA comparison

3. CONSISTENCY OF NUMERICAL RESULTS
   - consistency across figures/tables/text?
   - contradictions between text and table values?
   - suspiciously perfect numbers?

4. STATISTICAL VALIDITY
   - claims like "significant improvement" supported by stats?
   - proper statistical tests used (if claimed)?
   - improvements fall within expected variance?
   - error bars or CIs reported when needed?
   - Do NOT design experiments; only evaluate what is reported

5. RESULT INTERPRETATION QUALITY
   - interpretation follows logically from reported numbers?
   - authors overinterpret small improvements?
   - ignore worse results in some settings?
   - generalize beyond what results allow?

6. ALIGNMENT WITH CLAIMS
   - results support all performance claims?
   - any claims unsupported or exaggerated?
   - Results section contradict contributions or claims?
   - Do NOT judge contributions themselves—only whether results support them

7. VISUAL / TABLE VALIDITY
   - tables/figures readable and consistent?
   - axis labels, units, metric names correct?
   - figure captions matching content?
   - missing legend, missing axis, unclear labels?

8. RESULT COVERAGE & COMPLETENESS
   - ablation studies reported (if appropriate)?
   - negative results omitted intentionally?
   - hyperparameter sensitivities or edge-case results discussed?
   - Evaluate coverage, NOT methodology

ISSUE GENERATION:
For each problem (use ONLY these types):
- "missing_metric_variance", "missing_metrics", "inappropriate_metric_choice"
- "weak_baselines", "no_baseline_comparison", "unfair_comparison"
- "numerical_inconsistency", "unsupported_statistical_claim", "no_significance_testing"
- "overinterpretation", "contradiction_with_results", "irrelevant_results"
- "missing_ablation", "missing_result_details", "incomplete_results"
- "table_figure_inconsistency", "unclear_visualization", "other_results_issue"

For each: issue_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

SCORING (0-1 floats):
- metric_completeness
- statistical_validity
- baseline_quality
- numerical_consistency
- interpretation_quality
- visualization_quality
- result_claim_alignment
- overall_results_quality

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "ResultsAndStatisticalSoundnessAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "results_issues": [
    {
      "issue_id": "rs1",
      "issue_type": "<allowed type>",
      "severity": "low|medium|high",
      "section": "<section>",
      "excerpt": "<text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "results_scores": {
    "metric_completeness": 0.0,
    "statistical_validity": 0.0,
    "baseline_quality": 0.0,
    "numerical_consistency": 0.0,
    "interpretation_quality": 0.0,
    "visualization_quality": 0.0,
    "result_claim_alignment": 0.0,
    "overall_results_quality": 0.0
  },
  "results_summary": "<1-3 paragraphs>"
}

RULES:
- Do NOT evaluate datasets, methodology, novelty, literature review, abstract/intro, argument logic, writing, structure, or citations
- Do NOT design experiments or infer experiments/datasets outside text
- ALL conclusions MUST come directly from structured_text
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<ResultsOutput>(
        userPrompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: ResultsOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        results_issues: llmResult.results_issues || [],
        results_scores: llmResult.results_scores || {
          metric_completeness: 0.5,
          statistical_validity: 0.5,
          baseline_quality: 0.5,
          numerical_consistency: 0.5,
          interpretation_quality: 0.5,
          visualization_quality: 0.5,
          result_claim_alignment: 0.5,
          overall_results_quality: 0.5,
        },
        results_summary: llmResult.results_summary || 'Analysis completed.',
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
      console.error(`Error in ResultsAndStatisticalSoundnessAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        results_issues: [],
        results_scores: {
          metric_completeness: 0,
          statistical_validity: 0,
          baseline_quality: 0,
          numerical_consistency: 0,
          interpretation_quality: 0,
          visualization_quality: 0,
          result_claim_alignment: 0,
          overall_results_quality: 0,
        },
        results_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

