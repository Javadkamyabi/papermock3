/**
 * Model configuration for OpenAI API calls
 * Set OPENAI_MODEL environment variable to override defaults
 * Options: 'gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'
 */

// Default models - can be overridden via environment variable
export const MODEL_CONFIG = {
  // For testing/development, use cheaper models
  // For production, use more capable models
  default: process.env.OPENAI_MODEL || 'gpt-4o',
  test: process.env.OPENAI_MODEL_TEST || 'gpt-4o-mini', // Much cheaper for testing
  
  // Per-module overrides (if needed)
  module1: process.env.OPENAI_MODEL_M1 || process.env.OPENAI_MODEL || 'gpt-4o',
  module2: process.env.OPENAI_MODEL_M2 || process.env.OPENAI_MODEL || 'gpt-4o',
  module3: process.env.OPENAI_MODEL_M3 || process.env.OPENAI_MODEL || 'gpt-4o',
  module4b: process.env.OPENAI_MODEL_M4B || process.env.OPENAI_MODEL || 'gpt-4o',
  module5: process.env.OPENAI_MODEL_M5 || process.env.OPENAI_MODEL || 'gpt-4o',
  module6: process.env.OPENAI_MODEL_M6 || process.env.OPENAI_MODEL || 'gpt-4o',
  module7: process.env.OPENAI_MODEL_M7 || process.env.OPENAI_MODEL || 'gpt-4o',
  module8: process.env.OPENAI_MODEL_M8 || process.env.OPENAI_MODEL || 'gpt-4o',
  module9: process.env.OPENAI_MODEL_M9 || process.env.OPENAI_MODEL || 'gpt-4o',
  module10: process.env.OPENAI_MODEL_M10 || process.env.OPENAI_MODEL || 'gpt-4o',
  module11: process.env.OPENAI_MODEL_M11 || process.env.OPENAI_MODEL || 'gpt-4o',
  module12: process.env.OPENAI_MODEL_M12 || process.env.OPENAI_MODEL || 'gpt-4o',
  module13: process.env.OPENAI_MODEL_M13 || process.env.OPENAI_MODEL || 'gpt-4o',
  module14: process.env.OPENAI_MODEL_M14 || process.env.OPENAI_MODEL || 'gpt-4o',
  module15: process.env.OPENAI_MODEL_M15 || process.env.OPENAI_MODEL || 'gpt-4o',
  module16: process.env.OPENAI_MODEL_M16 || process.env.OPENAI_MODEL || 'gpt-4o',
};

/**
 * Get model for a specific module
 */
export function getModelForModule(moduleName: string): string {
  // Check if we're in test mode
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.OPENAI_USE_TEST_MODEL === 'true';
  
  if (isTestMode) {
    return MODEL_CONFIG.test;
  }
  
  // Map module names to config keys
  const moduleMap: Record<string, keyof typeof MODEL_CONFIG> = {
    'IngestionAndAppropriateness': 'module1',
    'StructuralScanner': 'module2',
    'CitationIntegrity': 'module3',
    'WritingIssueScanner': 'module4b',
    'WritingQualitySummary': 'module5',
    'ArgumentationAndClaimSupportAnalyzer': 'module6',
    'MethodologyQualityAnalyzer': 'module7',
    'DatasetAndDataReliabilityAnalyzer': 'module8',
    'NoveltyAndContributionAnalyzer': 'module9',
    'LiteratureReviewAnalyzer': 'module10',
    'AIBC-CoherenceAnalyzer': 'module11',
    'ResultsAndStatisticalSoundnessAnalyzer': 'module12',
    'RobustnessAndGeneralizationAnalyzer': 'module13',
    'EthicsReproducibilityTransparencyAnalyzer': 'module14',
    'FinalReportComposer': 'module15',
    'PDFReportLayoutGenerator': 'module16',
  };
  
  const configKey = moduleMap[moduleName] || 'default';
  return MODEL_CONFIG[configKey];
}

