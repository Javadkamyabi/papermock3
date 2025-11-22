/**
 * Core type definitions for PaperMock3
 */

export interface PaperMetadata {
  paperId: string;
  fileName: string;
  uploadDate: string;
  fileSize?: number;
}

export interface AssessmentResult {
  paperId: string;
  moduleName: string;
  assessmentDate: string;
  result: Record<string, any>; // Flexible JSON structure for different modules
}

export interface ModuleConfig {
  name: string;
  description: string;
  version: string;
}

export interface BaseModule {
  config: ModuleConfig;
  process(paperPath: string, paperId: string): Promise<AssessmentResult>;
}

