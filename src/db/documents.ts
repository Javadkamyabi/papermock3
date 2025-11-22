/**
 * Persistent storage for documents and pages
 * Provides stable document_id and page_id for Module 4A and 4B
 */

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { randomUUID } from 'crypto';

const STORAGE_DIR = process.env.STORAGE_DIR || './data';
const DOCUMENTS_FILE = join(STORAGE_DIR, 'documents.json');
const PAGES_FILE = join(STORAGE_DIR, 'pages.json');
const DOCUMENTS_DIR = join(STORAGE_DIR, 'documents');
const PAGES_DIR = join(STORAGE_DIR, 'pages');

export interface DocumentRecord {
  document_id: string;
  user_id: string;
  original_filename: string;
  storage_path: string; // Path to the stored original PDF
  page_count: number;
  created_at: string;
  updated_at: string;
}

export interface PageRecord {
  page_id: string;
  document_id: string;
  page_number: number;
  page_pdf_path: string; // Path to the single-page PDF
  page_text: string; // Full text content
  char_count: number;
  section_hint: string | null;
  created_at: string;
  updated_at: string;
}

// Ensure storage directories exist
async function ensureStorageDirs(): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
  }
  if (!existsSync(DOCUMENTS_DIR)) {
    await mkdir(DOCUMENTS_DIR, { recursive: true });
  }
  if (!existsSync(PAGES_DIR)) {
    await mkdir(PAGES_DIR, { recursive: true });
  }
}

// Load all documents from file
async function loadDocuments(): Promise<DocumentRecord[]> {
  await ensureStorageDirs();
  
  if (!existsSync(DOCUMENTS_FILE)) {
    return [];
  }

  try {
    const data = await readFile(DOCUMENTS_FILE, 'utf-8');
    return JSON.parse(data) as DocumentRecord[];
  } catch (error) {
    console.error('Error loading documents:', error);
    return [];
  }
}

// Load all pages from file
async function loadPages(): Promise<PageRecord[]> {
  await ensureStorageDirs();
  
  if (!existsSync(PAGES_FILE)) {
    return [];
  }

  try {
    const data = await readFile(PAGES_FILE, 'utf-8');
    return JSON.parse(data) as PageRecord[];
  } catch (error) {
    console.error('Error loading pages:', error);
    return [];
  }
}

// Save all documents to file
async function saveDocuments(documents: DocumentRecord[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(DOCUMENTS_FILE, JSON.stringify(documents, null, 2), 'utf-8');
}

// Save all pages to file
async function savePages(pages: PageRecord[]): Promise<void> {
  await ensureStorageDirs();
  await writeFile(PAGES_FILE, JSON.stringify(pages, null, 2), 'utf-8');
}

/**
 * Store or update a document record
 */
export async function storeDocument(document: DocumentRecord): Promise<void> {
  const documents = await loadDocuments();
  const existingIndex = documents.findIndex(d => d.document_id === document.document_id);
  
  if (existingIndex >= 0) {
    documents[existingIndex] = document;
  } else {
    documents.push(document);
  }
  
  await saveDocuments(documents);
}

/**
 * Get a document by ID
 */
export async function getDocument(documentId: string): Promise<DocumentRecord | null> {
  const documents = await loadDocuments();
  return documents.find(d => d.document_id === documentId) || null;
}

/**
 * Get all documents for a user
 */
export async function getUserDocuments(userId: string): Promise<DocumentRecord[]> {
  const documents = await loadDocuments();
  return documents.filter(d => d.user_id === userId);
}

/**
 * Store or update a page record
 */
export async function storePage(page: PageRecord): Promise<void> {
  const pages = await loadPages();
  const existingIndex = pages.findIndex(
    p => p.page_id === page.page_id
  );
  
  if (existingIndex >= 0) {
    pages[existingIndex] = page;
  } else {
    pages.push(page);
  }
  
  await savePages(pages);
}

/**
 * Store multiple pages at once (more efficient)
 */
export async function storePages(pageList: PageRecord[]): Promise<void> {
  const pages = await loadPages();
  
  for (const page of pageList) {
    const existingIndex = pages.findIndex(p => p.page_id === page.page_id);
    if (existingIndex >= 0) {
      pages[existingIndex] = page;
    } else {
      pages.push(page);
    }
  }
  
  await savePages(pages);
}

/**
 * Get all pages for a document
 */
export async function getDocumentPages(documentId: string): Promise<PageRecord[]> {
  const pages = await loadPages();
  return pages
    .filter(p => p.document_id === documentId)
    .sort((a, b) => a.page_number - b.page_number);
}

/**
 * Get a page by ID
 */
export async function getPage(pageId: string): Promise<PageRecord | null> {
  const pages = await loadPages();
  return pages.find(p => p.page_id === pageId) || null;
}

/**
 * Delete all pages for a document (when re-processing)
 */
export async function deleteDocumentPages(documentId: string): Promise<void> {
  const pages = await loadPages();
  const filteredPages = pages.filter(p => p.document_id !== documentId);
  await savePages(filteredPages);
}

/**
 * Store the original PDF file persistently
 * Returns the storage path where the file was saved
 */
export async function storeOriginalPDF(
  sourcePath: string,
  documentId: string,
  originalFilename: string
): Promise<string> {
  await ensureStorageDirs();
  
  // Create document-specific directory
  const docDir = join(DOCUMENTS_DIR, documentId);
  if (!existsSync(docDir)) {
    await mkdir(docDir, { recursive: true });
  }
  
  // Store with a stable filename
  const storageFilename = `${documentId}_original.pdf`;
  const storagePath = join(docDir, storageFilename);
  
  // Copy the file to persistent storage
  await copyFile(sourcePath, storagePath);
  
  // Return relative path from storage root
  return join('documents', documentId, storageFilename);
}

/**
 * Store a single-page PDF persistently
 * Returns the storage path where the file was saved
 */
export async function storePagePDF(
  pagePdfBuffer: Buffer,
  documentId: string,
  pageNumber: number
): Promise<string> {
  await ensureStorageDirs();
  
  // Create document-specific pages directory
  const docPagesDir = join(PAGES_DIR, documentId);
  if (!existsSync(docPagesDir)) {
    await mkdir(docPagesDir, { recursive: true });
  }
  
  // Store with a stable filename
  const storageFilename = `page_${pageNumber}.pdf`;
  const storagePath = join(docPagesDir, storageFilename);
  
  // Write the file
  await writeFile(storagePath, pagePdfBuffer);
  
  // Return relative path from storage root
  return join('pages', documentId, storageFilename);
}

/**
 * Generate a new document ID
 */
export function generateDocumentId(): string {
  return randomUUID();
}

/**
 * Generate a new page ID
 */
export function generatePageId(): string {
  return randomUUID();
}

