/**
 * Module3: CitationIntegrity (Revised v2.0.0)
 * Analyzes citation integrity (matching) and reference quality
 * NOTE: Does NOT repeat Module1 or Module2 tasks
 */

import { BaseAssessmentModule } from './base.js';
import { callOpenAIJSON } from '../openai/client.js';
import { getLatestAssessment } from '../db/storage.js';
import type { ModuleConfig } from '../types/index.js';

interface CitationInput {
  document_text: string;
  document_type: 'paper' | 'thesis' | 'report' | 'not_academic';
  document_subtype: string;
  structure_info: {
    references_section_exists: boolean;
  };
}

interface Problem {
  severity: 'low' | 'medium' | 'high';
  type: 'unmatched_in_text_citation' | 'uncited_reference' | 'outdated_sources' | 'inconsistent_style' | 'missing_references_section' | 'low_diversity' | 'low_recency' | 'low_venue_quality' | 'other';
  description: string;
}

interface CitationOutput {
  module: string;
  version: string;
  success: boolean;
  summary: {
    has_references_section: boolean;
    total_references_detected: number;
    total_in_text_citations_detected: number;
    citation_style: 'numeric' | 'author_year' | 'mixed' | 'unknown';
    citation_style_confidence: number;
    style_consistency_score: number;
  };
  matching: {
    matched_pairs_count: number;
    unmatched_in_text_citations_count: number;
    uncited_references_count: number;
    details: string[];
  };
  quality: {
    recency_analysis: {
      recent_0_5_years: number;
      years_5_10: number;
      older_10_years: number;
      recency_score: number;
      comment: string;
    };
    source_diversity: {
      diversity_score: number;
      comment: string;
    };
    venue_quality: {
      venue_quality_score: number;
      low_credibility_sources: string[];
      comment: string;
    };
    outdated_ratio: {
      ratio: number;
      comment: string;
    };
    citation_balance: {
      citation_balance_score: number;
      comment: string;
    };
    missing_key_references: string[];
  };
  problems: Problem[];
  notes: string;
}

export class CitationIntegrityModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'CitationIntegrity',
      description: 'Analyzes citation integrity (matching) and reference quality',
      version: '2.0.0',
    };
    super(config);
  }

  /**
   * Get document type, subtype, and structure info from previous modules
   */
  private async getPreviousModuleData(paperId: string): Promise<{
    document_type: 'paper' | 'thesis' | 'report' | 'not_academic';
    document_subtype: string;
    references_section_exists: boolean;
  }> {
    let documentType: 'paper' | 'thesis' | 'report' | 'not_academic' = 'paper';
    let documentSubtype = 'unknown';
    let referencesSectionExists = false;

    try {
      // Get Module1 data
      const module1Assessment = await getLatestAssessment(paperId, 'IngestionAndAppropriateness');
      if (module1Assessment?.result?.document_type?.doc_type) {
        documentType = module1Assessment.result.document_type.doc_type as 'paper' | 'thesis' | 'report' | 'not_academic';
      }

      // Get Module2 data
      const module2Assessment = await getLatestAssessment(paperId, 'StructuralScanner');
      if (module2Assessment?.result) {
        if (module2Assessment.result.document_subtype?.subtype) {
          documentSubtype = module2Assessment.result.document_subtype.subtype;
        }
        if (module2Assessment.result.sections?.references) {
          referencesSectionExists = module2Assessment.result.sections.references.exists;
        }
      }
    } catch (error) {
      console.warn('Could not retrieve previous module assessments, using defaults');
    }

    return {
      document_type: documentType,
      document_subtype: documentSubtype,
      references_section_exists: referencesSectionExists,
    };
  }

  /**
   * Extract references section from document text
   * Returns mainText (without references) and referencesSection separately
   * Uses multiple strategies to find the boundary
   */
  private extractReferencesSection(paperText: string): { referencesSection: string; mainText: string } {
    const refKeywords = ['references', 'bibliography', 'works cited', 'reference list', 'bibliographie'];
    let bestSplitIndex = -1;
    const lowerText = paperText.toLowerCase();
    
    // Strategy 1: Find "references" keyword near the end
    for (const keyword of refKeywords) {
      const idx = lowerText.lastIndexOf(keyword);
      if (idx > paperText.length * 0.6 && idx > bestSplitIndex) {
        bestSplitIndex = idx;
      }
    }
    
    // Strategy 2: Look for where numbered reference list starts
    // References typically start with [1] or 1. on a new line
    // Find the first occurrence of multiple consecutive numbered entries near the end
    const lines = paperText.split('\n');
    let refListStart = -1;
    let consecutiveRefs = 0;
    
    for (let i = Math.floor(lines.length * 0.7); i < lines.length; i++) {
      const line = lines[i].trim();
      // Check if line starts with a reference number pattern
      if (/^\[?\d+\]?\.?\s+/.test(line) && line.length > 20) {
        consecutiveRefs++;
        if (consecutiveRefs >= 3 && refListStart === -1) {
          // Found start of reference list (3+ consecutive references)
          refListStart = i - 2; // Go back a couple lines to include the header
        }
      } else if (consecutiveRefs > 0 && line.length > 5) {
        // Reset if we hit a non-reference line
        consecutiveRefs = 0;
      }
    }
    
    // Use the earlier of the two strategies (to be safe)
    let splitIndex = bestSplitIndex;
    if (refListStart > 0) {
      const refListCharIndex = paperText.indexOf(lines[refListStart]);
      if (refListCharIndex > 0 && (splitIndex === -1 || refListCharIndex < splitIndex)) {
        splitIndex = refListCharIndex;
      }
    }
    
    if (splitIndex > paperText.length * 0.6) {
      // Found a good split point
      // Find the actual start of references (skip past keyword/header)
      let refStart = splitIndex;
      
      // Skip past the keyword and any following whitespace/headers
      const afterKeyword = lowerText.indexOf('references', splitIndex);
      if (afterKeyword > 0) {
        refStart = afterKeyword + 'references'.length;
        // Skip whitespace, colons, newlines
        while (refStart < paperText.length && /[\s\n:]/.test(paperText[refStart])) {
          refStart++;
        }
      }
      
      const referencesSection = paperText.substring(refStart);
      let mainText = paperText.substring(0, splitIndex);
      
      // Final aggressive cleanup: remove any reference-like patterns from end of mainText
      const mainLines = mainText.split('\n');
      let cleanEnd = mainLines.length;
      let refPatternStreak = 0;
      
      // Look backwards from the end for reference patterns
      // If we find 10+ consecutive reference-like lines, that's the references section
      for (let i = mainLines.length - 1; i >= Math.max(0, mainLines.length - 200); i--) {
        const line = mainLines[i].trim();
        
        // Check if line looks like a reference entry
        const isRefLine = /^\[?\d+\]?\.?\s+/.test(line) && 
                         line.length > 15 && 
                         (/\b(19|20)\d{2}\b/.test(line) || /[A-Z][a-z]+/.test(line));
        
        if (isRefLine) {
          refPatternStreak++;
          if (refPatternStreak >= 10) {
            // Found references section, mark for removal
            cleanEnd = i;
            break;
          }
        } else if (line.toLowerCase().includes('references') || line.toLowerCase().includes('bibliography')) {
          // Found references header, remove from here
          cleanEnd = i;
          break;
        } else if (refPatternStreak > 0 && line.length > 10) {
          // Reset streak if we hit non-reference content
          refPatternStreak = 0;
        }
      }
      
      if (cleanEnd < mainLines.length) {
        mainText = mainLines.slice(0, cleanEnd).join('\n');
      }
      
      return { referencesSection, mainText };
    }
    
    // No clear references section found
    return { referencesSection: '', mainText: paperText };
  }

  /**
   * More lenient reference counting for edge cases
   */
  private countReferencesLenient(referencesSection: string): number {
    if (!referencesSection) return 0;
    
    const lines = referencesSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const seenNumbers = new Set<number>();
    
    for (const line of lines) {
      // Try multiple patterns
      const patterns = [
        /^\[(\d+)\]/,
        /^(\d+)\.\s+/,
        /^(\d+)\s+/,
        /\((\d+)\)/,
      ];
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const num = parseInt(match[1]);
          if (num > 0 && num <= 2000) {
            seenNumbers.add(num);
          }
        }
      }
      
      // Also check for author-year patterns that might indicate a reference
      if (/^[A-Z][a-z]+/.test(line) && /\b(19|20)\d{2}\b/.test(line) && line.length > 30) {
        // Could be an unnumbered reference, count it
        seenNumbers.add(seenNumbers.size + 1);
      }
    }
    
    return seenNumbers.size;
  }

  /**
   * Alternative extraction method if primary method fails
   */
  private extractReferencesSectionAlternative(paperText: string): { referencesSection: string; mainText: string } {
    // Look for where numbered reference list starts (more aggressive)
    const lines = paperText.split('\n');
    let refStart = -1;
    let consecutiveRefs = 0;
    
    // Scan from 60% through end looking for reference list pattern
    for (let i = Math.floor(lines.length * 0.6); i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^\[?\d+\]?\.?\s+/.test(line) && line.length > 15) {
        consecutiveRefs++;
        if (consecutiveRefs >= 5 && refStart === -1) {
          refStart = Math.max(0, i - 3); // Include a few lines before
        }
      } else if (consecutiveRefs > 0 && line.length > 10) {
        consecutiveRefs = 0;
      }
    }
    
    if (refStart > 0) {
      const refCharIndex = paperText.indexOf(lines[refStart]);
      return {
        referencesSection: paperText.substring(refCharIndex),
        mainText: paperText.substring(0, refCharIndex)
      };
    }
    
    return { referencesSection: '', mainText: paperText };
  }

  /**
   * Count references in the references section - handles all formats
   * This function counts by finding the highest reference number
   */
  private countReferences(referencesSection: string): number {
    if (!referencesSection || referencesSection.length < 100) return 0;
    
    const lines = referencesSection.split('\n');
    let maxRefNum = 0;
    const seenNumbers = new Set<number>();
    
    // Look for numbered references at the start of lines
    // Pattern: [N] or N. followed by text that looks like a reference (has author, year, etc.)
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 10) continue;
      
      // Match patterns like [1], [2], 1., 2. at start of line
      const match = trimmed.match(/^\[?(\d+)\]?\.?\s+/);
      if (match) {
        const num = parseInt(match[1]);
        
        // Sanity check: reference numbers should be reasonable
        if (num > 0 && num <= 10000) {
          // Additional validation: the line should contain reference-like content
          // (author names, years, or common reference words)
          const hasAuthorPattern = /[A-Z][a-z]+\s+[A-Z]/.test(trimmed) || 
                                   /[A-Z][a-z]+,\s+[A-Z]/.test(trimmed);
          const hasYear = /\b(19|20)\d{2}\b/.test(trimmed);
          const hasRefKeywords = /journal|conference|proceedings|book|article|paper/i.test(trimmed);
          
          // Only count if it looks like a real reference
          if ((hasAuthorPattern || hasYear || hasRefKeywords) && !seenNumbers.has(num)) {
            seenNumbers.add(num);
            if (num > maxRefNum) {
              maxRefNum = num;
            }
          }
        }
      }
    }
    
    // If we found numbered references, return the max
    if (maxRefNum > 0) {
      return maxRefNum;
    }
    
    // Fallback: count distinct reference entries by looking for author+year patterns
    // This is less reliable but works for unnumbered references
    let refCount = 0;
    let lastHadYear = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        lastHadYear = false;
        continue;
      }
      
      const hasYear = /\b(19|20)\d{2}\b/.test(trimmed);
      const hasAuthor = /^[A-Z][a-z]+/.test(trimmed) || /,\s*[A-Z][a-z]+/.test(trimmed);
      
      // Count as new reference if it has year and author, and previous line didn't have year
      if (hasYear && hasAuthor && !lastHadYear && trimmed.length > 20) {
        refCount++;
      }
      
      lastHadYear = hasYear;
    }
    
    return Math.max(maxRefNum, refCount);
  }

  /**
   * Extract all citations from the full text (before truncation)
   * This ensures we don't miss citations due to truncation
   * Uses comprehensive regex to catch ALL numeric citation formats
   */
  private extractAllCitations(text: string): Array<{ citation: string; position: number; isNumeric: boolean }> {
    const citations: Array<{ citation: string; position: number; isNumeric: boolean }> = [];
    const citationNumbers = new Set<number>();
    
    // Comprehensive pattern: catches [N], [N,M], [N-M], [N, M, K], [ N ], [N-M, K], etc.
    // This single pattern handles all spacing variations
    const comprehensivePattern = /\[\s*(\d+(?:\s*[,\-]\s*\d+)*)\s*\]/g;
    let match;
    
    while ((match = comprehensivePattern.exec(text)) !== null) {
      const citationContent = match[1].trim();
      if (!citationContent) continue;
      
      // Extract all numbers from the citation
      const numbers: number[] = [];
      
      // Split by comma or dash (with optional spaces)
      const parts = citationContent.split(/[,\-]/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          const num = parseInt(trimmed);
          if (!isNaN(num) && num > 0 && num <= 1000) {
            numbers.push(num);
          }
        }
      }
      
      // If we have a range pattern (e.g., [1-5] or [10-15]), expand it
      if (citationContent.includes('-') && numbers.length >= 2) {
        // Sort to get min and max
        const sorted = [...numbers].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        
        // Only expand if it's a reasonable contiguous range
        // Check if numbers form a range (e.g., [1, 2, 3, 4, 5] or [10-15])
        const isRange = sorted.every((n, i) => i === 0 || n === sorted[i-1] + 1);
        
        if (isRange && max - min <= 100 && max - min > 0) {
          // Expand the range
          numbers.length = 0;
          for (let n = min; n <= max; n++) {
            numbers.push(n);
          }
        }
      }
      
      // Add all numbers as individual citations
      for (const num of numbers) {
        if (!citationNumbers.has(num)) {
          citationNumbers.add(num);
          citations.push({
            citation: `[${num}]`,
            position: match.index,
            isNumeric: true
          });
        }
      }
    }
    
    // Also catch author-year citations - COMPREHENSIVE PATTERNS
    // Pattern 1: (Author, Year) or (Author et al., Year) or (Author1 & Author2, Year)
    // This catches: (Greshake et al., 2023), (Smith, 2020), (Smith & Jones, 2021)
    // More flexible: allows for various author name formats
    const authorYearInParens = /\(([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?(?:\s*,\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)*(?:\s*[&\s]+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)*,?\s+(?:19|20)\d{2})\)/g;
    
    // Pattern 2: Author (Year) or Author et al. (Year)
    // This catches: Smith (2020), Greshake et al. (2023)
    const authorYearNoParens = /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?\s+\((?:19|20)\d{2}\))/g;
    
    // Pattern 3: Author, Year (without parentheses, less common but exists)
    // This catches: Smith, 2020; Greshake et al., 2023
    // But be careful - only match if it's clearly a citation (not part of a sentence)
    // Skip this pattern as it's too prone to false positives - rely on parentheses patterns
    // const authorYearComma = /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?,?\s+(?:19|20)\d{2})(?![()\w])/g;
    
    // Pattern 4: Author and Author, Year
    // This catches: Smith and Jones, 2020
    const authorAndAuthor = /([A-Z][a-zA-Z]+\s+and\s+[A-Z][a-zA-Z]+(?:,\s+[A-Z][a-zA-Z]+)*,?\s+(?:19|20)\d{2})/g;
    
    const authorYearPatterns = [
      authorYearInParens,
      authorYearNoParens,
      // authorYearComma, // Too prone to false positives
      authorAndAuthor
    ];
    
    const seenAuthorYearCitations = new Set<string>();
    const seenPositions = new Set<number>(); // Track positions to avoid duplicates at same location
    
    for (const pattern of authorYearPatterns) {
      // Reset regex lastIndex to avoid issues
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const citationText = match[0].trim();
        const position = match.index;
        
        // Skip if we've already seen a citation at this position (overlapping patterns)
        if (seenPositions.has(position)) continue;
        
        // Normalize to avoid duplicates (e.g., "(Smith, 2020)" vs "Smith, 2020")
        // Extract just the author and year for normalization
        const authorYearMatch = citationText.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?).*?((?:19|20)\d{2})/);
        if (authorYearMatch) {
          const normalized = `${authorYearMatch[1].toLowerCase().trim()}_${authorYearMatch[2]}`;
          
          // Only add if we haven't seen this exact citation before
          if (!seenAuthorYearCitations.has(normalized)) {
          seenAuthorYearCitations.add(normalized);
          seenPositions.add(position);
          citations.push({
            citation: citationText,
            position: position,
            isNumeric: false
          });
          }
        }
      }
    }
    
    // Sort by position
    citations.sort((a, b) => a.position - b.position);
    
    return citations;
  }

  /**
   * Strict reference counting - finds the highest valid reference number
   */
  private countReferencesStrict(referencesSection: string): number {
    if (!referencesSection || referencesSection.length < 100) return 0;
    
    const lines = referencesSection.split('\n');
    const candidateNumbers: Array<{ num: number; line: string; context: string }> = [];
    
    // Find all potential reference numbers with their context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 10) continue;
      
      // Look for [N] or N. at start of line
      const match = line.match(/^\[(\d+)\]|^(\d+)\.\s+/);
      if (match) {
        const num = parseInt(match[1] || match[2] || '0');
        
        if (num > 0 && num <= 500) {
          // Get context (current line + next 2 lines)
          const context = [line];
          for (let j = 1; j <= 2 && i + j < lines.length; j++) {
            context.push(lines[i + j].trim());
          }
          const contextText = context.join(' ').toLowerCase();
          
          // Validate: must have at least one strong indicator
          const hasYear = /\b(19|20)\d{2}\b/.test(contextText);
          const hasAuthorPattern = /[a-z]+\s+[a-z]+,\s+[a-z]/.test(contextText) || 
                                   /^[A-Z][a-z]+\s+[A-Z]/.test(line);
          const hasRefKeywords = /journal|conference|proceedings|book|article|publisher|press|university|springer|ieee|acm|vol|pp|pages/i.test(contextText);
          const isSubstantial = contextText.length > 30;
          
          // Must have year OR (author pattern AND keywords) AND be substantial
          if ((hasYear || (hasAuthorPattern && hasRefKeywords)) && isSubstantial) {
            candidateNumbers.push({ num, line, context: contextText });
          }
        }
      }
    }
    
    if (candidateNumbers.length === 0) return 0;
    
    // Find the maximum number from valid candidates
    const maxNum = Math.max(...candidateNumbers.map(c => c.num));
    
    // Additional validation: check if numbers form a reasonable sequence
    // If we have many candidates and they're mostly sequential, it's likely correct
    const uniqueNums = new Set(candidateNumbers.map(c => c.num));
    if (uniqueNums.size >= 10 && maxNum <= 500) {
      // Check if numbers are mostly in sequence (not random)
      const sortedNums = Array.from(uniqueNums).sort((a, b) => a - b);
      let sequentialCount = 0;
      for (let i = 1; i < sortedNums.length; i++) {
        if (sortedNums[i] === sortedNums[i-1] + 1) {
          sequentialCount++;
        }
      }
      // If at least 30% are sequential, it's likely a reference list
      if (sequentialCount / sortedNums.length >= 0.3) {
        return maxNum;
      }
    }
    
    // Fallback: if we have reasonable candidates, return max
    if (maxNum > 0 && maxNum <= 500 && candidateNumbers.length >= 5) {
      return maxNum;
    }
    
    return 0;
  }

  /**
   * Assess citation integrity and quality, return structured analysis
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    // Get document type, subtype, and structure info from previous modules
    const previousData = await this.getPreviousModuleData(paperId);

    // Extract references section separately
    const { referencesSection, mainText } = this.extractReferencesSection(paperText);
    
    // Remove debug logs for production
    
    // Count all references (even if section is very long)
    let totalReferencesCount = this.countReferences(referencesSection);
    
    // If count seems unreasonable (too high), try a more conservative approach
    if (totalReferencesCount > 500) {
      // Re-count with stricter validation
      totalReferencesCount = this.countReferencesStrict(referencesSection);
    }
    
    // For analysis, we'll use a smart approach:
    // 1. Use full references section if it fits (up to ~15k chars)
    // 2. If too long, use beginning + end samples for quality analysis
    // 3. But always report the full count
    
    let referencesForAnalysis = referencesSection;
    const maxRefLength = 15000;
    
    if (referencesSection.length > maxRefLength) {
      // Take beginning and end samples
      const sampleSize = Math.floor(maxRefLength / 2);
      referencesForAnalysis = referencesSection.substring(0, sampleSize) + 
                              '\n\n... [middle references truncated for analysis - but all ' + totalReferencesCount + ' references were counted] ...\n\n' +
                              referencesSection.substring(referencesSection.length - sampleSize);
    }
    
    // Extract citations from FULL main text before truncation
    // CRITICAL: Only extract from actual body text, NOT from references section
    // Use multiple strategies to ensure clean separation
    
    // Strategy 1: Remove references section markers from mainText
    let cleanMainText = mainText;
    const mainLower = cleanMainText.toLowerCase();
    
    // Find and remove any "references" section that leaked into mainText
    const refMarkers = ['references', 'bibliography', 'works cited', 'reference list'];
    for (const marker of refMarkers) {
      const idx = mainLower.lastIndexOf(marker);
      if (idx > cleanMainText.length * 0.7) {
        // Found marker near end, remove everything from there
        cleanMainText = cleanMainText.substring(0, idx);
        break;
      }
    }
    
    // Strategy 2: Scan backwards to find where reference list pattern starts
    // Reference lists have distinctive patterns: many consecutive lines with [N] or N. at start
    const mainLines = cleanMainText.split('\n');
    let bodyTextEnd = mainLines.length;
    let consecutiveRefPatterns = 0;
    let highestRefNum = 0;
    
    // Scan last 300 lines backwards
    for (let i = mainLines.length - 1; i >= Math.max(0, mainLines.length - 300); i--) {
      const line = mainLines[i].trim();
      if (!line || line.length < 5) continue;
      
      // Check if line starts with reference number pattern
      const refNumMatch = line.match(/^\[?(\d+)\]?\.?\s+/);
      if (refNumMatch) {
        const refNum = parseInt(refNumMatch[1]);
        // Validate: line should look like a reference entry
        const hasYear = /\b(19|20)\d{2}\b/.test(line);
        const hasAuthor = /[A-Z][a-z]+/.test(line);
        const isSubstantial = line.length > 15;
        
        if ((hasYear || hasAuthor) && isSubstantial && refNum > 0 && refNum <= 1000) {
          consecutiveRefPatterns++;
          if (refNum > highestRefNum) {
            highestRefNum = refNum;
          }
        } else {
          // Reset if pattern doesn't look like a real reference
          if (consecutiveRefPatterns > 0) {
            consecutiveRefPatterns = 0;
            highestRefNum = 0;
          }
        }
      } else if (consecutiveRefPatterns > 0) {
        // Hit a non-reference line, check if we had enough to be a reference list
        if (consecutiveRefPatterns >= 5 || highestRefNum > 20) {
          // Found start of references section
          bodyTextEnd = i + consecutiveRefPatterns + 1;
          break;
        }
        consecutiveRefPatterns = 0;
        highestRefNum = 0;
      }
    }
    
    // Truncate if we found references section
    if (bodyTextEnd < mainLines.length) {
      cleanMainText = mainLines.slice(0, bodyTextEnd).join('\n');
    }
    
    // Strategy 3: Final safety check - remove any remaining reference-like content
    // Look for patterns that indicate we're still in references section
    const last500Chars = cleanMainText.substring(Math.max(0, cleanMainText.length - 500));
    const refPatternDensity = (last500Chars.match(/\[?\d+\]?\.?\s+/g) || []).length;
    if (refPatternDensity > 10) {
      // Too many reference patterns near end, likely still in references section
      // Find where they start
      const lines = cleanMainText.split('\n');
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 100); i--) {
        if (/^\[?\d+\]?\.?\s+/.test(lines[i].trim()) && lines[i].length > 20) {
          cleanMainText = lines.slice(0, i).join('\n');
          break;
        }
      }
    }
    
    // Extract citations from the cleaned main text only
    const allCitations = this.extractAllCitations(cleanMainText);
    
    // Count citations - handle BOTH numeric AND author-year citations
    const uniqueNums = new Set<number>();
    const allCitationNumbers = new Set<number>();
    const authorYearCitations = new Set<string>();
    
    for (const cit of allCitations) {
      // Use the isNumeric flag from extraction
      if (cit.isNumeric) {
        // Extract number from numeric citation
        const numMatch = cit.citation.match(/(\d+)/);
        if (numMatch) {
          const num = parseInt(numMatch[1]);
          if (num > 0 && num <= 2000) {
            allCitationNumbers.add(num);
            if (num <= totalReferencesCount || totalReferencesCount === 0) {
              uniqueNums.add(num);
            }
          }
        }
      } else {
        // Author-year citation - extract author and year for normalization
        const authorYearMatch = cit.citation.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?).*?((?:19|20)\d{2})/);
        if (authorYearMatch) {
          // Normalize: author name (lowercase, no spaces) + year
          const author = authorYearMatch[1].toLowerCase().replace(/\s+/g, '').replace(/et\s*al\.?/g, 'etal');
          const year = authorYearMatch[2];
          const normalized = `${author}_${year}`;
          
          // Only add if it's a valid citation (has author and year)
          if (author.length > 2 && year) {
            authorYearCitations.add(normalized);
          }
        } else {
          // Fallback: use full citation text (normalized)
          const normalized = cit.citation.toLowerCase().replace(/[()]/g, '').trim();
          if (normalized.length > 8 && /\b(19|20)\d{2}\b/.test(normalized)) {
            authorYearCitations.add(normalized);
          }
        }
      }
    }
    
    // Total citations = numeric citations + author-year citations
    const numericCitationCount = uniqueNums.size > 0 ? uniqueNums.size : allCitationNumbers.size;
    const authorYearCount = authorYearCitations.size;
    const totalInTextCitations = numericCitationCount + authorYearCount;
    
    // For analysis, use a larger sample of CLEAN main text to capture citations
    // Take samples from beginning, middle, and end to capture citations throughout
    const maxMainTextLength = 15000; // Increased significantly
    let truncatedMainText = cleanMainText;
    
    if (cleanMainText.length > maxMainTextLength) {
      // Take samples from beginning, middle, and end
      const sampleSize = Math.floor(maxMainTextLength / 3);
      const middleStart = Math.floor(cleanMainText.length / 2) - Math.floor(sampleSize / 2);
      truncatedMainText = cleanMainText.substring(0, sampleSize) + 
                         '\n\n... [middle section 1 truncated] ...\n\n' +
                         cleanMainText.substring(middleStart, middleStart + sampleSize) +
                         '\n\n... [middle section 2 truncated] ...\n\n' +
                         cleanMainText.substring(cleanMainText.length - sampleSize);
    }
    
    // Combine for analysis
    const textForAnalysis = truncatedMainText + '\n\n--- REFERENCES SECTION ---\n\n' + referencesForAnalysis;

    const input: CitationInput = {
      document_text: textForAnalysis,
      document_type: previousData.document_type,
      document_subtype: previousData.document_subtype,
      structure_info: {
        references_section_exists: previousData.references_section_exists,
      },
    };

    // Escape any special characters in the text for the prompt
    const safeTextForAnalysis = textForAnalysis.replace(/`/g, "'").substring(0, 18000);
    
    // Determine citation style based on what we detected
    const hasNumericCitations = numericCitationCount > 0;
    const hasAuthorYearCitations = authorYearCount > 0;
    let detectedStyle = 'unknown';
    if (hasNumericCitations && hasAuthorYearCitations) {
      detectedStyle = 'mixed';
    } else if (hasAuthorYearCitations) {
      detectedStyle = 'author_year';
    } else if (hasNumericCitations) {
      detectedStyle = 'numeric';
    }
    
    const prompt = `Module3: CitationIntegrity. Analyze citations and reference quality.

Tasks: Match citations to references. Evaluate quality (recency, diversity, venue quality, outdated ratio, balance, missing key refs).

IMPORTANT: 
- The document has ${totalReferencesCount} total references (counted from full references section).
- Found ${totalInTextCitations} unique in-text citations in the document (extracted from full text).
  * Numeric citations: ${numericCitationCount}
  * Author-year citations: ${authorYearCount}
- Detected citation style: ${detectedStyle}
- Use these accurate counts in your analysis.

DO NOT: Redo Module1/Module2 tasks or judge scientific correctness.

Document type: ${input.document_type}, Subtype: ${input.document_subtype}, Has references: ${input.structure_info.references_section_exists}

Document text (analyze citations and references - note: main text is sampled, but citations were counted from full text):
${safeTextForAnalysis}

Detect: Citation style (numeric/author_year/mixed/unknown), consistency, matching, quality metrics.

Return JSON with this structure (fill in values):

{"module":"CitationIntegrity","version":"2.0.0","success":true,"summary":{"has_references_section":true,"total_references_detected":0,"total_in_text_citations_detected":0,"citation_style":"numeric","citation_style_confidence":0.0,"style_consistency_score":0.0},"matching":{"matched_pairs_count":0,"unmatched_in_text_citations_count":0,"uncited_references_count":0,"details":[]},"quality":{"recency_analysis":{"recent_0_5_years":0,"years_5_10":0,"older_10_years":0,"recency_score":0.0,"comment":""},"source_diversity":{"diversity_score":0.0,"comment":""},"venue_quality":{"venue_quality_score":0.0,"low_credibility_sources":[],"comment":""},"outdated_ratio":{"ratio":0.0,"comment":""},"citation_balance":{"citation_balance_score":0.0,"comment":""},"missing_key_references":[]},"problems":[],"notes":""}

RULES:
------
- ALWAYS produce valid JSON.
- NEVER output explanations outside the JSON.
- ALWAYS be honest about uncertainty.
- DO NOT attempt perfect matching; approximate but consistent analysis is acceptable.
- Use structural cues + soft reasoning for missing_key_references.
- If references_section_exists = false, set all integrity fields to zero and add a high-severity problem.
- Return ONLY the JSON object, no markdown, no code blocks, no explanations.`;

    const systemPrompt = `You are a specialized citation integrity and quality analyzer. Your task is to analyze citation matching and reference quality. Always return valid JSON only, with no additional commentary or markdown formatting. Focus ONLY on citations and references, not on content quality, structure, or scientific correctness.`;

    try {
      const result = await callOpenAIJSON<CitationOutput>(
        prompt,
        'gpt-4o',
        systemPrompt
      );

      // Ensure the result has the correct structure with defaults
      // Override total_references_detected with our accurate count
      const output: CitationOutput = {
        module: result.module || 'CitationIntegrity',
        version: result.version || '2.0.0',
        success: result.success !== undefined ? result.success : true,
        summary: {
          has_references_section: result.summary?.has_references_section ?? previousData.references_section_exists,
          total_references_detected: totalReferencesCount > 0 ? totalReferencesCount : (result.summary?.total_references_detected || 0),
          total_in_text_citations_detected: totalInTextCitations > 0 ? totalInTextCitations : (result.summary?.total_in_text_citations_detected || 0),
          citation_style: result.summary?.citation_style || 'unknown',
          citation_style_confidence: result.summary?.citation_style_confidence || 0.0,
          style_consistency_score: result.summary?.style_consistency_score || 0.0,
        },
        matching: {
          matched_pairs_count: result.matching?.matched_pairs_count || 0,
          unmatched_in_text_citations_count: Math.max(0, totalInTextCitations - (result.matching?.matched_pairs_count || 0)),
          uncited_references_count: totalReferencesCount > 0 
            ? Math.max(0, totalReferencesCount - (result.matching?.matched_pairs_count || 0))
            : (result.matching?.uncited_references_count || 0),
          details: result.matching?.details || [],
        },
        quality: {
          recency_analysis: {
            recent_0_5_years: result.quality?.recency_analysis?.recent_0_5_years || 0,
            years_5_10: result.quality?.recency_analysis?.years_5_10 || 0,
            older_10_years: result.quality?.recency_analysis?.older_10_years || 0,
            recency_score: result.quality?.recency_analysis?.recency_score || 0.0,
            comment: result.quality?.recency_analysis?.comment || '',
          },
          source_diversity: {
            diversity_score: result.quality?.source_diversity?.diversity_score || 0.0,
            comment: result.quality?.source_diversity?.comment || '',
          },
          venue_quality: {
            venue_quality_score: result.quality?.venue_quality?.venue_quality_score || 0.0,
            low_credibility_sources: result.quality?.venue_quality?.low_credibility_sources || [],
            comment: result.quality?.venue_quality?.comment || '',
          },
          outdated_ratio: {
            ratio: result.quality?.outdated_ratio?.ratio || 0.0,
            comment: result.quality?.outdated_ratio?.comment || '',
          },
          citation_balance: {
            citation_balance_score: result.quality?.citation_balance?.citation_balance_score || 0.0,
            comment: result.quality?.citation_balance?.comment || '',
          },
          missing_key_references: result.quality?.missing_key_references || [],
        },
        problems: result.problems || [],
        notes: result.notes || 'Citation analysis completed',
      };

      // If no references section, add high-severity problem
      if (!previousData.references_section_exists && output.problems.length === 0) {
        output.problems.push({
          severity: 'high',
          type: 'missing_references_section',
          description: 'No references section detected in the document',
        });
      }

      return output;
    } catch (error) {
      console.error(`Error in ${this.config.name} module:`, error);
      
      // Return a safe default structure on error
      return {
        module: 'CitationIntegrity',
        version: '2.0.0',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: {
          has_references_section: previousData.references_section_exists,
          total_references_detected: 0,
          total_in_text_citations_detected: 0,
          citation_style: 'unknown',
          citation_style_confidence: 0.0,
          style_consistency_score: 0.0,
        },
        matching: {
          matched_pairs_count: 0,
          unmatched_in_text_citations_count: 0,
          uncited_references_count: 0,
          details: [],
        },
        quality: {
          recency_analysis: {
            recent_0_5_years: 0,
            years_5_10: 0,
            older_10_years: 0,
            recency_score: 0.0,
            comment: 'Unable to analyze recency due to error',
          },
          source_diversity: {
            diversity_score: 0.0,
            comment: 'Unable to analyze diversity due to error',
          },
          venue_quality: {
            venue_quality_score: 0.0,
            low_credibility_sources: [],
            comment: 'Unable to analyze venue quality due to error',
          },
          outdated_ratio: {
            ratio: 0.0,
            comment: 'Unable to analyze outdated ratio due to error',
          },
          citation_balance: {
            citation_balance_score: 0.0,
            comment: 'Unable to analyze citation balance due to error',
          },
          missing_key_references: [],
        },
        problems: [
          {
            severity: 'high',
            type: 'other',
            description: 'Error during citation analysis',
          },
        ],
        notes: 'Error during citation analysis',
      };
    }
  }
}
