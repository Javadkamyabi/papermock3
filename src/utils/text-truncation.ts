/**
 * Text truncation utilities for handling large inputs
 * Prevents rate limit errors by intelligently truncating text
 */

/**
 * Truncate structured text to fit within token limits
 * Preserves important sections and truncates less critical ones
 */
export function truncateStructuredText(
  structuredText: Record<string, string>,
  maxCharsPerSection: number = 5000,
  prioritySections: string[] = ['abstract', 'introduction', 'methodology', 'results', 'conclusion']
): Record<string, string> {
  const truncated: Record<string, string> = {};
  
  for (const [section, content] of Object.entries(structuredText)) {
    const sectionLower = section.toLowerCase();
    const isPriority = prioritySections.some(ps => sectionLower.includes(ps));
    
    if (content.length <= maxCharsPerSection) {
      truncated[section] = content;
    } else {
      // For priority sections, keep more content
      const limit = isPriority ? maxCharsPerSection * 1.5 : maxCharsPerSection;
      truncated[section] = content.substring(0, limit) + '... [truncated]';
    }
  }
  
  return truncated;
}

/**
 * Truncate a single text string intelligently
 */
export function truncateText(text: string, maxChars: number = 10000): string {
  if (text.length <= maxChars) {
    return text;
  }
  
  // Try to truncate at sentence boundary
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);
  
  if (cutPoint > maxChars * 0.8) {
    return truncated.substring(0, cutPoint + 1) + '... [truncated]';
  }
  
  return truncated + '... [truncated]';
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate to fit within token budget
 */
export function truncateToTokenBudget(text: string, maxTokens: number = 20000): string {
  const maxChars = maxTokens * 4;
  return truncateText(text, maxChars);
}

