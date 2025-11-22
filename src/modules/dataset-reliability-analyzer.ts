/**
 * Module 8: DatasetAndDataReliabilityAnalyzer
 * Provides deep, critical, comprehensive evaluation of ALL dataset-related aspects
 * Uses structured information from Module 2 (structure)
 * Does NOT analyze writing, structure, argumentation, methodology, or raw PDF pages
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import { extractTextFromPDF } from '../pdf/parser.js';
import type { ModuleConfig } from '../types/index.js';

interface StructuredText {
  [sectionName: string]: string;
}

interface Module8Input {
  document_id: string;
  structured_text: StructuredText;
}

interface Dataset {
  dataset_id: string;
  dataset_name: string | 'unknown';
  dataset_type: 'pre_existing' | 'custom_collected' | 'synthetic_generated' | 'augmented' | 'combined' | 'unknown';
  source: string | null;
  excerpt: string;
}

interface DatasetIssue {
  issue_id: string;
  dataset_id: string;
  issue_type: 'missing_justification' | 'sampling_bias' | 'inadequate_label_quality' | 'insufficient_dataset_description' | 'missing_preprocessing_details' | 'imbalance_not_handled' | 'inappropriate_balancing_method' | 'missing_metric_justification' | 'data_leakage_risk' | 'low_reliability' | 'poor_representativeness' | 'synthetic_data_risk' | 'other_dataset_issue';
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface DatasetScores {
  overall_dataset_quality: number;
  reliability: number;
  representativeness: number;
  bias_risk: number;
  preprocessing_quality: number;
  balancing_quality: number;
  metric_appropriateness: number;
  transparency_of_description: number;
}

interface DatasetScoresMap {
  [dataset_id: string]: DatasetScores;
}

interface DatasetOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  datasets: Dataset[];
  dataset_issues: DatasetIssue[];
  dataset_scores: DatasetScoresMap;
  dataset_summary: string;
  error?: string;
}

export class DatasetAndDataReliabilityAnalyzerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'DatasetAndDataReliabilityAnalyzer',
      description: 'Provides comprehensive evaluation of dataset-related aspects: source, validity, bias, preprocessing, balancing, limitations',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('DatasetAndDataReliabilityAnalyzer must be called with process() method, not assess()');
  }

  /**
   * Extract structured text from document focusing on dataset-related sections
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

      // Focus on dataset-related sections
      const datasetSections = [
        'abstract', 'introduction', 'methods', 'methodology', 
        'data', 'dataset', 'datasets', 'materials', 
        'experimental_setup', 'preprocessing', 'balancing', 
        'evaluation', 'results', 'discussion'
      ];

      const sections = structureInfo.sections || {};
      const dynamicHeadings = structureInfo.dynamic_headings || [];

      for (const sectionName of datasetSections) {
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
            // Include if it's dataset-relevant
            if (datasetSections.some(s => normalizedName.includes(s)) || 
                normalizedName.includes('data') || 
                normalizedName.includes('dataset') ||
                normalizedName.includes('preprocess') ||
                normalizedName.includes('balance') ||
                normalizedName.includes('evaluation') ||
                normalizedName.includes('metric')) {
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
        // Filter to dataset-relevant sections
        for (const [key, value] of Object.entries(heuristicSections)) {
          if (datasetSections.includes(key) || key.includes('data') || key.includes('method')) {
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
      { name: 'data', patterns: [/data\s+collection\s*[:\n]/i, /dataset\s*[:\n]/i, /data\s*[:\n]/i] },
      { name: 'methods', patterns: [/methods?\s*[:\n]/i, /methodology\s*[:\n]/i] },
      { name: 'preprocessing', patterns: [/preprocessing\s*[:\n]/i, /pre-process\s*[:\n]/i] },
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
      case 'data':
      case 'dataset':
      case 'datasets':
        patterns.push(/data\s+collection\s*[:\n]/i, /dataset\s*[:\n]/i, /data\s*[:\n]/i);
        break;
      case 'methods':
      case 'methodology':
        patterns.push(/methods?\s*[:\n]/i, /methodology\s*[:\n]/i);
        break;
      case 'preprocessing':
        patterns.push(/preprocessing\s*[:\n]/i, /pre-process\s*[:\n]/i);
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
        const nextSectionPattern = /(?:introduction|methods?|methodology|data|dataset|results?|discussion|conclusion|references?|bibliography)\s*[:\n]/i;
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
   * Process document and generate dataset reliability analysis
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
          datasets: [],
          dataset_issues: [],
          dataset_scores: {},
          dataset_summary: '',
          error: 'Document text required. Please provide paperPath parameter.',
        };
      }

      // Extract structured text (focusing on dataset-related sections)
      const structuredText = await this.extractStructuredText(documentText, searchId);

      // Check if we have any dataset-relevant content
      const hasDatasetContent = Object.keys(structuredText).some(key => 
        key.includes('data') || 
        key.includes('dataset') ||
        key.includes('method') ||
        key === 'abstract' ||
        key === 'introduction' ||
        key === 'evaluation' ||
        key === 'results'
      );

      if (!hasDatasetContent || Object.keys(structuredText).length === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          datasets: [],
          dataset_issues: [],
          dataset_scores: {},
          dataset_summary: '',
          error: 'No dataset information found in structured_text.',
        };
      }

      // Prepare input for LLM
      const input: Module8Input = {
        document_id: documentId,
        structured_text: structuredText,
      };

      // Call OpenAI to generate dataset analysis
      const systemPrompt = `You are Module 8: "DatasetAndDataReliabilityAnalyzer" for the PaperMock3 system. Your ONLY job is to provide deep, critical, comprehensive evaluation of ALL dataset-related aspects. You MUST NOT:
- Detect writing issues (Module 4 does this)
- Evaluate structure (Module 2 does this)
- Evaluate argumentation (Module 6 does this)
- Evaluate methodology as a whole (Module 7 does this)
- Parse raw PDF pages (use only structured_text provided)

You ONLY analyze datasets: their source, validity, bias, preprocessing, balancing, limitations, and appropriateness.`;

      const userPrompt = `Analyze the dataset-related aspects of this academic document using ONLY the structured section-level text provided.

INPUT DATA:
${JSON.stringify(input, null, 2)}

TASK:
1. IDENTIFICATION OF DATASETS
   For each dataset mentioned:
   - dataset_id, dataset_name, dataset_type (pre_existing|custom_collected|synthetic_generated|augmented|combined|unknown)
   - source, link/reference (if available), excerpt

2. DATASET PURPOSE & JUSTIFICATION
   For each dataset:
   - why chosen, suitability explanation, alternative datasets, size/diversity match, challenge/realism
   - Flag if authors don't discuss these

3. DATA QUALITY & RELIABILITY CHECKS
   Evaluate:
   - completeness, cleanliness, labeling quality, annotation methodology
   - domain coverage, representativeness, sampling strategy
   - potential sampling bias, shortcut learning risks, data leakage risks
   - temporal bias, cross-domain generalization concerns

4. DATA PREPROCESSING ANALYSIS
   Check:
   - feature extraction, normalization, encoding, standardization
   - filtering/data removal, justification of preprocessing choices

5. IMBALANCE ANALYSIS
   If imbalanced:
   - do they report/measure imbalance?
   - do they justify using it?
   - balancing techniques used (SMOTE, ADASYN, undersampling, oversampling, class-weighting)
   - For each technique: why this one? why not alternatives? risks? mitigation strategies?
   - Flag if no balancing for clearly imbalanced dataset

6. EVALUATION METRICS APPROPRIATENESS
   Check:
   - precision/recall/F1 for imbalanced data?
   - ROC AUC vs PR AUC?
   - accuracy misuse?
   - macro vs micro averaging?
   - cross-validation approach?
   - Flag misuse or missing metrics

7. DATASET LIMITATIONS & AUTHOR AWARENESS
   Check if authors mention:
   - small sample size, lack of diversity, labeling errors
   - unrealistic synthetic generation, out-of-domain generalization
   - sampling bias, class imbalance, demographic bias, missing modalities
   - Evaluate: acknowledgment, mitigation strategies, robustness testing, generalization warnings

8. PRODUCE DATASET SCORES (0-1 floats)
   For EACH dataset:
   - overall_dataset_quality, reliability, representativeness, bias_risk
   - preprocessing_quality, balancing_quality, metric_appropriateness, transparency_of_description

9. DATASET ISSUES
   For each problem (use ONLY these types):
   - "missing_justification", "sampling_bias", "inadequate_label_quality"
   - "insufficient_dataset_description", "missing_preprocessing_details"
   - "imbalance_not_handled", "inappropriate_balancing_method"
   - "missing_metric_justification", "data_leakage_risk"
   - "low_reliability", "poor_representativeness", "synthetic_data_risk", "other_dataset_issue"
   - For each: issue_id, dataset_id, issue_type, severity, section, excerpt, why_problematic, suggested_fix

10. GLOBAL DATASET SUMMARY
    - 1-3 paragraph narrative: strength of dataset choice, weaknesses, fit with research problem
    - balancing & preprocessing appropriateness, whether limitations undermine conclusions

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "DatasetAndDataReliabilityAnalyzer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "datasets": [
    {
      "dataset_id": "d1",
      "dataset_name": "<string or unknown>",
      "dataset_type": "pre_existing|custom_collected|synthetic_generated|augmented|combined|unknown",
      "source": "<string or null>",
      "excerpt": "<string>"
    }
  ],
  "dataset_issues": [
    {
      "issue_id": "ds1",
      "dataset_id": "d1",
      "issue_type": "<one of allowed types>",
      "severity": "low|medium|high",
      "section": "<section_name>",
      "excerpt": "<short text>",
      "why_problematic": "<string>",
      "suggested_fix": "<string>"
    }
  ],
  "dataset_scores": {
    "d1": {
      "overall_dataset_quality": 0.0,
      "reliability": 0.0,
      "representativeness": 0.0,
      "bias_risk": 0.0,
      "preprocessing_quality": 0.0,
      "balancing_quality": 0.0,
      "metric_appropriateness": 0.0,
      "transparency_of_description": 0.0
    }
  },
  "dataset_summary": "<1-3 paragraph narrative>"
}

RULES:
- Do NOT invent datasets not present in structured_text
- Do NOT evaluate writing style, structure, argumentation, or methodology
- Do NOT rewrite or edit content
- ALL conclusions MUST come directly from structured_text
- Always output deterministic, structured JSON
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      const llmResult = await callOpenAIJSON<DatasetOutput>(
        userPrompt,
        'gpt-4o-mini',
        systemPrompt
      );

      // Ensure output matches expected structure
      const output: DatasetOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        datasets: llmResult.datasets || [],
        dataset_issues: llmResult.dataset_issues || [],
        dataset_scores: llmResult.dataset_scores || {},
        dataset_summary: llmResult.dataset_summary || 'Analysis completed.',
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
      console.error(`Error in DatasetAndDataReliabilityAnalyzer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        datasets: [],
        dataset_issues: [],
        dataset_scores: {},
        dataset_summary: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

