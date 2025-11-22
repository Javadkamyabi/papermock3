/**
 * Module 15: FinalReportComposer
 * Integrates outputs of ALL previous modules (1-14) into a single coherent, structured report
 * Does NOT invent new issues, modify module outputs, or redo analyses
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getPaperAssessments } from '../db/storage.js';
import { getDocument } from '../db/documents.js';
import type { ModuleConfig, AssessmentResult } from '../types/index.js';

interface ModuleOutputs {
  [moduleName: string]: any;
}

interface Module15Input {
  document_id: string;
  modules: ModuleOutputs;
}

interface PriorityIssue {
  module: string;
  issue_id: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high';
  section: string;
  excerpt: string;
  why_problematic: string;
  suggested_fix: string;
}

interface PriorityFixList {
  high: PriorityIssue[];
  medium: PriorityIssue[];
  low: PriorityIssue[];
}

interface FinalReportOutput {
  module: string;
  version: string;
  success: boolean;
  document_id: string;
  paper_summary: string;
  strengths: string[];
  weaknesses: string[];
  detailed_sections: Record<string, any>;
  priority_fix_list: PriorityFixList;
  final_verdict: 'strong_accept' | 'weak_accept' | 'borderline' | 'weak_reject' | 'reject';
  error?: string;
}

export class FinalReportComposerModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'FinalReportComposer',
      description: 'Integrates outputs of all previous modules into a single coherent final report',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Main assessment method - not used by this module
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('FinalReportComposer must be called with process() method, not assess()');
  }

  /**
   * Collect all module outputs for a document
   */
  async collectModuleOutputs(documentId: string, paperId: string): Promise<ModuleOutputs> {
    // Try multiple strategies to find module outputs
    const { getAllAssessments } = await import('../db/storage.js');
    const allAssessments = await getAllAssessments();
    
    // Strategy 1: Get assessments by paperId
    let assessments = await getPaperAssessments(paperId);
    console.log(`  [Module 15] Found ${assessments.length} assessments by paperId: ${paperId}`);
    
    // Strategy 2: If no assessments found, try by documentId
    if (assessments.length === 0) {
      assessments = allAssessments.filter(a => {
        // Check if result has matching document_id
        return a.result?.document_id === documentId;
      });
      console.log(`  [Module 15] Found ${assessments.length} assessments by documentId: ${documentId}`);
    }
    
    // Strategy 3: Try to find by both paperId and documentId (union)
    if (assessments.length === 0) {
      const byPaperId = allAssessments.filter(a => a.paperId === paperId);
      const byDocId = allAssessments.filter(a => a.result?.document_id === documentId);
      // Combine both sets
      const combined = [...byPaperId, ...byDocId];
      // Remove duplicates
      const unique = combined.filter((a, index, self) => 
        index === self.findIndex(b => 
          b.paperId === a.paperId && 
          b.moduleName === a.moduleName && 
          b.assessmentDate === a.assessmentDate
        )
      );
      assessments = unique;
      console.log(`  [Module 15] Found ${assessments.length} assessments by combining paperId and documentId`);
    }
    
    // Strategy 4: If still no assessments, try to find by recent assessments (within last 2 hours)
    if (assessments.length === 0) {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const recentAssessments = allAssessments.filter(a => {
        const assessmentTime = new Date(a.assessmentDate).getTime();
        return assessmentTime > twoHoursAgo;
      });
      // If we have recent assessments, use them (they're likely from the same run)
      if (recentAssessments.length > 0) {
        assessments = recentAssessments;
        console.log(`  [Module 15] Found ${assessments.length} recent assessments (last 2 hours)`);
      }
    }

    const moduleOutputs: ModuleOutputs = {};

    // Map of module names
    const moduleNames = [
      'IngestionAndAppropriateness',
      'StructuralScanner',
      'CitationIntegrity',
      'PdfPageSplitter',
      'WritingIssueScanner',
      'WritingQualitySummary',
      'ArgumentationAndClaimSupportAnalyzer',
      'MethodologyQualityAnalyzer',
      'DatasetAndDataReliabilityAnalyzer',
      'NoveltyAndContributionAnalyzer',
      'LiteratureReviewAnalyzer',
      'AIBC-CoherenceAnalyzer',
      'ResultsAndStatisticalSoundnessAnalyzer',
      'RobustnessAndGeneralizationAnalyzer',
      'EthicsReproducibilityTransparencyAnalyzer',
    ];

    for (const moduleName of moduleNames) {
      const moduleAssessments = assessments.filter(a => a.moduleName === moduleName);
      if (moduleAssessments.length > 0) {
        // Get the latest assessment for this module
        const latest = moduleAssessments.sort(
          (a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
        )[0];
        moduleOutputs[moduleName] = latest.result;
      }
    }

    return moduleOutputs;
  }

  /**
   * Generate fallback report when LLM fails
   */
  private generateFallbackReport(moduleOutputs: ModuleOutputs, documentId: string, allIssues: PriorityIssue[]): FinalReportOutput {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const detailedSections: Record<string, any> = {};

    // Extract content from each module
    for (const [moduleName, output] of Object.entries(moduleOutputs)) {
      if (!output || typeof output !== 'object') continue;

      detailedSections[moduleName] = {
        summary: output.summary || output.notes || 'Analysis completed',
        scores: this.extractScores(output),
        issues: this.extractModuleIssues(moduleName, output),
      };

      // Try to extract strengths and weaknesses from module outputs
      if (output.strengths && Array.isArray(output.strengths)) {
        strengths.push(...output.strengths);
      }
      if (output.weaknesses && Array.isArray(output.weaknesses)) {
        weaknesses.push(...output.weaknesses);
      }
    }

    // Generate paper summary from available data
    const paperSummary = this.generatePaperSummary(moduleOutputs);

    // Sort issues by priority
    const priorityFixList = {
      high: allIssues.filter(i => i.severity === 'high'),
      medium: allIssues.filter(i => i.severity === 'medium'),
      low: allIssues.filter(i => i.severity === 'low'),
    };

    // Determine verdict based on scores
    const verdict = this.determineVerdict(moduleOutputs);

    return {
      module: this.config.name,
      version: this.config.version,
      success: true,
      document_id: documentId,
      paper_summary: paperSummary,
      strengths: strengths.length > 0 ? strengths : ['Analysis completed for all modules'],
      weaknesses: weaknesses.length > 0 ? weaknesses : allIssues.slice(0, 5).map(i => i.why_problematic || i.excerpt),
      detailed_sections: detailedSections,
      priority_fix_list: priorityFixList,
      final_verdict: verdict,
    };
  }

  private extractScores(output: any): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(output)) {
      if (key.includes('score') || key.includes('Score') || key.includes('quality') || key.includes('Quality')) {
        if (typeof value === 'number') {
          scores[key] = value;
        } else if (typeof value === 'object' && value !== null) {
          Object.assign(scores, value);
        }
      }
    }
    return scores;
  }

  private extractModuleIssues(moduleName: string, output: any): any[] {
    const issues: any[] = [];
    
    // Try different issue field names
    const issueFields = ['issues', 'problems', 'ert_issues', 'argumentation_issues', 'methodology_issues', 
                         'dataset_issues', 'novelty_issues', 'lit_review_issues', 'aibc_issues', 
                         'results_issues', 'robustness_issues'];
    
    for (const field of issueFields) {
      if (Array.isArray(output[field])) {
        issues.push(...output[field]);
        break;
      }
    }
    
    return issues;
  }

  private generatePaperSummary(moduleOutputs: ModuleOutputs): string {
    const summaries: string[] = [];
    
    for (const [moduleName, output] of Object.entries(moduleOutputs)) {
      if (output?.summary) {
        summaries.push(output.summary);
      } else if (output?.notes) {
        summaries.push(output.notes);
      }
    }
    
    if (summaries.length > 0) {
      return summaries.slice(0, 3).join(' ');
    }
    
    return 'This document has been analyzed across multiple dimensions including structure, writing quality, methodology, dataset reliability, novelty, literature review, argumentation, results, robustness, and ethics.';
  }

  private determineVerdict(moduleOutputs: ModuleOutputs): string {
    // Simple heuristic based on available scores
    let totalScore = 0;
    let scoreCount = 0;
    
    for (const output of Object.values(moduleOutputs)) {
      if (output && typeof output === 'object') {
        const scores = this.extractScores(output);
        for (const score of Object.values(scores)) {
          if (typeof score === 'number') {
            totalScore += score;
            scoreCount++;
          }
        }
      }
    }
    
    if (scoreCount === 0) return 'borderline';
    
    const avgScore = totalScore / scoreCount;
    if (avgScore >= 0.8) return 'strong_accept';
    if (avgScore >= 0.65) return 'weak_accept';
    if (avgScore >= 0.5) return 'borderline';
    if (avgScore >= 0.35) return 'weak_reject';
    return 'reject';
  }

  /**
   * Extract all issues from all modules
   */
  private extractAllIssues(moduleOutputs: ModuleOutputs): PriorityIssue[] {
    const allIssues: PriorityIssue[] = [];

    for (const [moduleName, output] of Object.entries(moduleOutputs)) {
      if (!output || typeof output !== 'object') continue;

      // Different modules have different issue structures
      let issues: any[] = [];

      // Module 4B: WritingIssueScanner
      if (moduleName === 'WritingIssueScanner' && Array.isArray(output.issues)) {
        issues = output.issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 5: WritingQualitySummary
      else if (moduleName === 'WritingQualitySummary' && Array.isArray(output.themes)) {
        // Themes are not issues, but we can extract from prioritized_actions
        if (Array.isArray(output.prioritized_actions)) {
          output.prioritized_actions.forEach((action: any, idx: number) => {
            allIssues.push({
              module: moduleName,
              issue_id: `${moduleName}-action-${idx + 1}`,
              issue_type: 'writing_quality_issue',
              severity: action.priority === 1 ? 'high' : action.priority === 2 ? 'medium' : 'low',
              section: action.area || 'unknown',
              excerpt: action.description || '',
              why_problematic: action.description || '',
              suggested_fix: action.recommended_action || '',
            });
          });
        }
      }
      // Module 6: ArgumentationAndClaimSupportAnalyzer
      else if (moduleName === 'ArgumentationAndClaimSupportAnalyzer' && Array.isArray(output.argumentation_issues)) {
        issues = output.argumentation_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 7: MethodologyQualityAnalyzer
      else if (moduleName === 'MethodologyQualityAnalyzer' && Array.isArray(output.methodology_issues)) {
        issues = output.methodology_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 8: DatasetAndDataReliabilityAnalyzer
      else if (moduleName === 'DatasetAndDataReliabilityAnalyzer' && Array.isArray(output.dataset_issues)) {
        issues = output.dataset_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 9: NoveltyAndContributionAnalyzer
      else if (moduleName === 'NoveltyAndContributionAnalyzer' && Array.isArray(output.novelty_issues)) {
        issues = output.novelty_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 10: LiteratureReviewAnalyzer
      else if (moduleName === 'LiteratureReviewAnalyzer' && Array.isArray(output.lit_review_issues)) {
        issues = output.lit_review_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 11: AIBC-CoherenceAnalyzer
      else if (moduleName === 'AIBC-CoherenceAnalyzer' && Array.isArray(output.aibc_issues)) {
        issues = output.aibc_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 12: ResultsAndStatisticalSoundnessAnalyzer
      else if (moduleName === 'ResultsAndStatisticalSoundnessAnalyzer' && Array.isArray(output.results_issues)) {
        issues = output.results_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 13: RobustnessAndGeneralizationAnalyzer
      else if (moduleName === 'RobustnessAndGeneralizationAnalyzer' && Array.isArray(output.robustness_issues)) {
        issues = output.robustness_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 14: EthicsReproducibilityTransparencyAnalyzer
      else if (moduleName === 'EthicsReproducibilityTransparencyAnalyzer' && Array.isArray(output.ert_issues)) {
        issues = output.ert_issues.map((issue: any) => ({
          ...issue,
          module: moduleName,
        }));
      }
      // Module 3: CitationIntegrity
      else if (moduleName === 'CitationIntegrity' && Array.isArray(output.problems)) {
        issues = output.problems.map((problem: any, idx: number) => ({
          module: moduleName,
          issue_id: `${moduleName}-problem-${idx + 1}`,
          issue_type: problem.type || 'citation_issue',
          severity: problem.severity || 'medium',
          section: 'citations',
          excerpt: problem.description || '',
          why_problematic: problem.description || '',
          suggested_fix: 'Address citation issues as described',
        }));
      }

      allIssues.push(...issues);
    }

    return allIssues;
  }

  /**
   * Process document and generate final comprehensive report
   */
  async process(documentId: string, paperId?: string): Promise<any> {
    try {
      const searchId = paperId || documentId;

      // Collect all module outputs
      const moduleOutputs = await this.collectModuleOutputs(documentId, searchId);

      // Check if we have at least some module outputs
      const moduleCount = Object.keys(moduleOutputs).length;
      if (moduleCount === 0) {
        return {
          module: this.config.name,
          version: this.config.version,
          success: false,
          document_id: documentId,
          paper_summary: '',
          strengths: [],
          weaknesses: [],
          detailed_sections: {},
          priority_fix_list: { high: [], medium: [], low: [] },
          final_verdict: 'borderline',
          error: 'No module outputs found. Please run at least some assessment modules first.',
        };
      }

      // Get document metadata
      const document = await getDocument(documentId);

      // Prepare input for LLM
      const input: Module15Input = {
        document_id: documentId,
        modules: moduleOutputs,
      };

      // Extract all issues for priority sorting
      const allIssues = this.extractAllIssues(moduleOutputs);

      // Call OpenAI to generate final report
      const systemPrompt = `You are Module 15: "FinalReportComposer" for the PaperMock3 system. Your ONLY job is to integrate outputs from ALL previous modules (1-14) into a single coherent, structured report. You MUST NOT:
- Invent new issues
- Invent content not present in modules
- Modify the meaning of issues
- Create new criticisms or praise
- Reinterpret or second-guess module outputs
- Redo analyses (all analyses are final)
- Generate PDF formatting

You MUST:
- Merge module outputs
- Summarize findings
- Unify terminology
- Resolve conflicts between module outputs when necessary
- Produce a clean, consistent final report`;

      // Truncate input if too large to prevent issues
      const inputStr = JSON.stringify(input, null, 2);
      const estimatedTokens = Math.ceil(inputStr.length / 4);
      
      let processedInput = input;
      if (estimatedTokens > 20000) {
        console.log(`  [Module 15] Input too large (${estimatedTokens} tokens), truncating module outputs...`);
        // Truncate each module's output
        const truncatedModules: Record<string, any> = {};
        for (const [moduleName, output] of Object.entries(moduleOutputs)) {
          if (output && typeof output === 'object') {
            const outputStr = JSON.stringify(output);
            if (outputStr.length > 5000) {
              truncatedModules[moduleName] = {
                ...output,
                summary: typeof output.summary === 'string' ? output.summary.substring(0, 2000) + '... [truncated]' : output.summary,
              };
            } else {
              truncatedModules[moduleName] = output;
            }
          }
        }
        processedInput = { ...input, modules: truncatedModules };
        const newTokens = Math.ceil(JSON.stringify(processedInput).length / 4);
        console.log(`  [Module 15] Truncated to ${newTokens} tokens`);
      }

      const userPrompt = `Integrate the outputs from ALL previous modules into a single coherent final report.

INPUT DATA:
${JSON.stringify(processedInput, null, 2)}

TASK:
Produce the following major sections:

1. PAPER SUMMARY
   - Concise, factual summary of paper's topic and goal
   - Use ONLY content from structured_text provided across modules

2. STRENGTHS
   - Aggregate strengths mentioned across all modules
   - Group by category: novelty, methodology, dataset, clarity, results, robustness, ethics, writing, structure

3. WEAKNESSES
   - Aggregate weaknesses (issues) from all modules
   - Group by: structural issues, writing issues, methodology issues, dataset issues, result/statistics issues, robustness issues, ethics/reproducibility issues, literature review issues, novelty issues, argumentation issues

4. DETAILED MODULE-BY-MODULE REPORT
   - For each module (1-14): include its summary, issues, score block
   - No modifications, no additions

5. PRIORITY FIX LIST
   - Sort all issues into HIGH (must fix), MEDIUM (important), LOW (optional)
   - HIGH = severe issues with methodology, dataset, results, ethics, or argumentation
   - MEDIUM = moderate issues that reduce clarity or scientific quality
   - LOW = minor stylistic or formatting issues

6. FINAL VERDICT (Mock Review Decision)
   - Based on aggregated scores: strong_accept, weak_accept, borderline, weak_reject, reject
   - This is NOT a scientific judgment; it is synthetic output based on modules' combined scores

ALL ISSUES TO INCLUDE:
${JSON.stringify(allIssues, null, 2)}

OUTPUT FORMAT:
Return EXACTLY this JSON structure (no markdown, no extra text):
{
  "module": "FinalReportComposer",
  "version": "1.0.0",
  "success": true,
  "document_id": "${documentId}",
  "paper_summary": "<text>",
  "strengths": ["<text>", ...],
  "weaknesses": ["<text>", ...],
  "detailed_sections": {
    "module1": { ... },
    "module2": { ... },
    ...
    "module14": { ... }
  },
  "priority_fix_list": {
    "high": [
      {
        "module": "<module_name>",
        "issue_id": "<id>",
        "issue_type": "<type>",
        "severity": "high",
        "section": "<section>",
        "excerpt": "<text>",
        "why_problematic": "<string>",
        "suggested_fix": "<string>"
      }
    ],
    "medium": [ ... ],
    "low": [ ... ]
  },
  "final_verdict": "strong_accept|weak_accept|borderline|weak_reject|reject"
}

RULES:
- Do NOT invent new issues or content
- Do NOT modify module outputs
- Use ONLY information from provided modules
- Keep all output deterministic and JSON-only
- Return ONLY valid JSON, no markdown code blocks, no explanations outside JSON
- Ensure all strings are properly escaped
- Use double quotes for all JSON keys and string values`;

      // Try with retry logic for JSON parsing issues
      let llmResult: FinalReportOutput;
      let retries = 3;
      while (retries > 0) {
        try {
          console.log(`  [Module 15] Calling LLM (attempt ${4 - retries}/3)...`);
          llmResult = await callOpenAIJSON<FinalReportOutput>(
            userPrompt,
            'gpt-4o', // Upgraded to gpt-4o for better quality
            systemPrompt
          );
          
          // Validate that we got actual content
          if (!llmResult.paper_summary || llmResult.paper_summary.trim().length === 0) {
            if (retries > 1) {
              console.warn(`  [Module 15] LLM returned empty content, retrying... (${retries - 1} attempts left)`);
              retries--;
              await new Promise(resolve => setTimeout(resolve, 3000));
              continue;
            } else {
              console.warn(`  [Module 15] LLM returned empty content after retries. Using fallback.`);
              // Fallback: generate minimal content from module outputs
              llmResult = this.generateFallbackReport(moduleOutputs, documentId, allIssues);
            }
          }
          break; // Success, exit retry loop
        } catch (error) {
          retries--;
          if (retries === 0) {
            // Last attempt failed, use fallback
            console.warn(`  [Module 15] All retries failed, using fallback report generation.`);
            llmResult = this.generateFallbackReport(moduleOutputs, documentId, allIssues);
            break;
          }
          console.warn(`  [Module 15] JSON parsing failed, retrying... (${retries} attempts left)`);
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Ensure output matches expected structure
      const output: FinalReportOutput = {
        module: this.config.name,
        version: this.config.version,
        success: llmResult.success !== undefined ? llmResult.success : true,
        document_id: llmResult.document_id || documentId,
        paper_summary: llmResult.paper_summary || '',
        strengths: llmResult.strengths || [],
        weaknesses: llmResult.weaknesses || [],
        detailed_sections: llmResult.detailed_sections || {},
        priority_fix_list: llmResult.priority_fix_list || { high: [], medium: [], low: [] },
        final_verdict: llmResult.final_verdict || 'borderline',
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
      console.error(`Error in FinalReportComposer module:`, error);
      return {
        module: this.config.name,
        version: this.config.version,
        success: false,
        document_id: documentId,
        paper_summary: '',
        strengths: [],
        weaknesses: [],
        detailed_sections: {},
        priority_fix_list: { high: [], medium: [], low: [] },
        final_verdict: 'borderline',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

