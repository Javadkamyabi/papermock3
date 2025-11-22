/**
 * Base module class that all assessment modules should extend
 */

import type { BaseModule, ModuleConfig, AssessmentResult } from '../types/index.js';
import { extractTextFromPDF } from '../pdf/parser.js';
import { storeAssessment } from '../db/storage.js';
import { randomUUID } from 'crypto';

export abstract class BaseAssessmentModule implements BaseModule {
  config: ModuleConfig;

  constructor(config: ModuleConfig) {
    this.config = config;
  }

  /**
   * Process a PDF paper and return assessment result
   * This method should be implemented by each module
   */
  abstract assess(paperText: string, paperId: string): Promise<Record<string, any>>;

  /**
   * Main process method that handles PDF extraction and storage
   */
  async process(paperPath: string, paperId: string): Promise<AssessmentResult> {
    // Extract text from PDF
    const parsedPDF = await extractTextFromPDF(paperPath);
    
    // Perform assessment (implemented by child class)
    const assessmentResult = await this.assess(parsedPDF.text, paperId);

    // Create assessment result
    const result: AssessmentResult = {
      paperId,
      moduleName: this.config.name,
      assessmentDate: new Date().toISOString(),
      result: assessmentResult,
    };

    // Store in DynamoDB
    await storeAssessment(result);

    return result;
  }

  /**
   * Generate a unique paper ID if not provided
   */
  static generatePaperId(): string {
    return randomUUID();
  }
}

