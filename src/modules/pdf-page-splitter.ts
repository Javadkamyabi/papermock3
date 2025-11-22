/**
 * Module 4A: PdfPageSplitter (v1.1.0)
 * Splits PDF into individual pages and extracts text from each page
 * Pure structural/mechanical operation - no LLM calls or quality analysis
 * 
 * Now includes persistent storage with stable document_id and page_id
 */

import { BaseAssessmentModule } from './base.js';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import type { ModuleConfig } from '../types/index.js';
import { getLatestAssessment } from '../db/storage.js';
import {
  storeDocument,
  storePages,
  storeOriginalPDF,
  storePagePDF,
  getDocument,
  deleteDocumentPages,
  generateDocumentId,
  generatePageId,
  type DocumentRecord,
  type PageRecord,
} from '../db/documents.js';

interface PageInfo {
  page_id: string;
  page_number: number;
  page_pdf_path: string;
  page_text: string;
  char_count: number;
  section_hint: string | null;
}

interface PdfPageSplitterOutput {
  module: string;
  version: string;
  success: boolean;
  document?: {
    document_id: string;
    user_id: string;
    original_filename: string;
    storage_path: string;
    page_count: number;
  };
  pages?: PageInfo[];
  error?: string;
}

export class PdfPageSplitterModule extends BaseAssessmentModule {
  constructor() {
    const config: ModuleConfig = {
      name: 'PdfPageSplitter',
      description: 'Splits PDF into individual pages and extracts text from each page',
      version: '1.1.0',
    };
    super(config);
  }

  /**
   * Get section hints from Module 2 if available
   * Maps page numbers to section names based on headings detected
   */
  private async getSectionHints(paperId: string, totalPages: number): Promise<Map<number, string>> {
    const sectionMap = new Map<number, string>();
    
    try {
      const module2Assessment = await getLatestAssessment(paperId, 'StructuralScanner');
      if (module2Assessment?.result?.dynamic_headings) {
        const headings = module2Assessment.result.dynamic_headings;
        
        // Simple heuristic: if we have headings with start_index, we can approximate page numbers
        // This is a rough mapping - actual page numbers would require more sophisticated analysis
        // For now, we'll use a simple distribution based on headings
        if (headings && headings.length > 0) {
          // If headings have start_index, we could use that to estimate pages
          // But since we don't have exact page mapping, we'll leave section_hint as null
          // The orchestrator can provide better mapping if needed
        }
      }
    } catch (error) {
      // Silently fail - section hints are optional
    }
    
    return sectionMap;
  }

  /**
   * Extract text from a specific page of a PDF
   */
  private async extractPageText(pdfBuffer: Buffer | Uint8Array, pageNumber: number, totalPages: number): Promise<string> {
    try {
      // pdf-parse doesn't support page-by-page extraction directly
      // We'll need to split the PDF first, then extract text from the single page
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      
      if (pageNumber < 1 || pageNumber > pages.length) {
        return '';
      }

      // Create a new PDF with just this page
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNumber - 1]);
      singlePageDoc.addPage(copiedPage);
      
      const singlePageBytes = await singlePageDoc.save();
      
      // Extract text from the single-page PDF
      const pageData = await pdfParse(Buffer.from(singlePageBytes));
      return pageData.text || '';
    } catch (error) {
      console.warn(`Failed to extract text from page ${pageNumber}:`, error);
      return '';
    }
  }

  /**
   * Create a single-page PDF buffer
   */
  private async createSinglePagePDFBuffer(
    pdfBuffer: Buffer | Uint8Array,
    pageNumber: number
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      
      if (pageNumber < 1 || pageNumber > pages.length) {
        throw new Error(`Page number ${pageNumber} is out of range`);
      }

      // Create a new PDF with just this page
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNumber - 1]);
      singlePageDoc.addPage(copiedPage);
      
      const singlePageBytes = await singlePageDoc.save();
      
      return Buffer.from(singlePageBytes);
    } catch (error) {
      throw new Error(`Failed to create single-page PDF for page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main assessment method - not used by this module
   * Required by BaseAssessmentModule interface but we override process() instead
   */
  async assess(paperText: string, paperId: string): Promise<Record<string, any>> {
    throw new Error('PdfPageSplitter must be called with process() method, not assess()');
  }

  /**
   * Process PDF with persistent storage (new signature)
   * 
   * @param paperPath - Path to the source PDF file
   * @param paperId - Legacy paper ID (for backward compatibility)
   * @param userId - User ID who owns the document (required for persistence)
   * @param documentId - Optional document ID (if re-processing existing document)
   */
  async processWithPersistence(
    paperPath: string,
    paperId: string,
    userId?: string,
    documentId?: string
  ): Promise<PdfPageSplitterOutput> {
    try {
      // Read the PDF file
      const pdfBuffer = await readFile(paperPath);
      
      // Load PDF to get page count
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();
      
      // Generate or use provided document ID
      const finalDocumentId = documentId || generateDocumentId();
      
      // Use paperId as userId if userId not provided (backward compatibility)
      const finalUserId = userId || paperId;
      
      // Extract original filename
      const originalFilename = basename(paperPath);
      
      // Store original PDF persistently
      const storagePath = await storeOriginalPDF(paperPath, finalDocumentId, originalFilename);
      
      // Check if document already exists (re-processing)
      const existingDocument = await getDocument(finalDocumentId);
      const now = new Date().toISOString();
      
      // Create or update document record
      const documentRecord: DocumentRecord = {
        document_id: finalDocumentId,
        user_id: finalUserId,
        original_filename: originalFilename,
        storage_path: storagePath,
        page_count: totalPages,
        created_at: existingDocument?.created_at || now,
        updated_at: now,
      };
      
      await storeDocument(documentRecord);
      
      // If re-processing, delete old pages first
      if (existingDocument) {
        await deleteDocumentPages(finalDocumentId);
      }
      
      // Get section hints from Module 2 (optional)
      const sectionHints = await this.getSectionHints(paperId, totalPages);
      
      // Process each page
      const pageRecords: PageRecord[] = [];
      const pageInfos: PageInfo[] = [];
      
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        // Generate stable page ID
        const pageId = generatePageId();
        
        // Extract text from this page
        const pageText = await this.extractPageText(pdfBuffer, pageNum, totalPages);
        
        // Create single-page PDF buffer
        const pagePdfBuffer = await this.createSinglePagePDFBuffer(pdfBuffer, pageNum);
        
        // Store single-page PDF persistently
        const pagePdfPath = await storePagePDF(pagePdfBuffer, finalDocumentId, pageNum);
        
        // Get section hint if available
        const sectionHint = sectionHints.get(pageNum) || null;
        
        // Create page record for persistence
        const pageRecord: PageRecord = {
          page_id: pageId,
          document_id: finalDocumentId,
          page_number: pageNum,
          page_pdf_path: pagePdfPath,
          page_text: pageText,
          char_count: pageText.length,
          section_hint: sectionHint,
          created_at: now,
          updated_at: now,
        };
        
        pageRecords.push(pageRecord);
        
        // Create page info for output
        const pageInfo: PageInfo = {
          page_id: pageId,
          page_number: pageNum,
          page_pdf_path: pagePdfPath,
          page_text: pageText,
          char_count: pageText.length,
          section_hint: sectionHint,
        };
        
        pageInfos.push(pageInfo);
      }
      
      // Store all pages in database
      await storePages(pageRecords);
      
      // Create output in new PdfPageSplitterOutput format
      const output: PdfPageSplitterOutput = {
        module: 'PdfPageSplitter',
        version: '1.1.0',
        success: true,
        document: {
          document_id: finalDocumentId,
          user_id: finalUserId,
          original_filename: originalFilename,
          storage_path: storagePath,
          page_count: totalPages,
        },
        pages: pageInfos,
      };
      
      // Also store in standard AssessmentResult format for backward compatibility
      const { storeAssessment } = await import('../db/storage.js');
      const assessmentResult = {
        paperId,
        moduleName: this.config.name,
        assessmentDate: now,
        result: output,
      };
      await storeAssessment(assessmentResult);
      
      // Return the PdfPageSplitterOutput format (for Module 4B)
      return output;
    } catch (error) {
      // Return error output
      const errorOutput: PdfPageSplitterOutput = {
        module: 'PdfPageSplitter',
        version: '1.1.0',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      
      return errorOutput;
    }
  }

  /**
   * Override process method for backward compatibility
   * Wraps the new persistent storage logic
   */
  async process(paperPath: string, paperId: string): Promise<any> {
    // Use paperId as userId for backward compatibility
    const result = await this.processWithPersistence(paperPath, paperId, paperId);
    
    // Return in AssessmentResult format for base class compatibility
    return {
      paperId,
      moduleName: this.config.name,
      assessmentDate: new Date().toISOString(),
      result: result,
    };
  }
}

