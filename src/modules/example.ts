/**
 * Example module template
 * This demonstrates how to create a new assessment module
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import type { ModuleConfig } from '../types/index.js';

export class ExampleModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'example',
      description: 'Example assessment module',
      version: '1.0.0',
    };
    super(config);
  }

  /**
   * Implement the assess method with your specific assessment logic
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    // Truncate text if too long (OpenAI has token limits)
    const maxLength = 100000; // Adjust based on your needs
    const truncatedText = paperText.length > maxLength 
      ? paperText.substring(0, maxLength) + '... [truncated]'
      : paperText;

    const prompt = `Please assess the following academic paper and provide your analysis in JSON format.

Paper Text:
${truncatedText}

Provide your assessment as a JSON object.`;

    const systemPrompt = `You are an expert academic paper reviewer. Analyze the paper and provide structured feedback in JSON format.`;

    try {
      const result = await callOpenAIJSON(prompt, 'gpt-4', systemPrompt);
      return result;
    } catch (error) {
      console.error(`Error in ${this.config.name} module:`, error);
      throw error;
    }
  }
}

