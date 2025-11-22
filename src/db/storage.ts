/**
 * Local JSON file storage for assessment results
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { AssessmentResult } from '../types/index.js';

const STORAGE_DIR = process.env.STORAGE_DIR || './data';
const ASSESSMENTS_FILE = join(STORAGE_DIR, 'assessments.json');

// Ensure storage directory exists
async function ensureStorageDir(): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
  }
}

// Load all assessments from file
async function loadAssessments(): Promise<AssessmentResult[]> {
  await ensureStorageDir();
  
  if (!existsSync(ASSESSMENTS_FILE)) {
    return [];
  }

  try {
    const data = await readFile(ASSESSMENTS_FILE, 'utf-8');
    return JSON.parse(data) as AssessmentResult[];
  } catch (error) {
    console.error('Error loading assessments:', error);
    // If JSON is corrupted, try to backup and start fresh
    if (error instanceof SyntaxError) {
      console.warn('Corrupted assessments.json detected. Creating backup and starting fresh...');
      const { copyFile } = await import('fs/promises');
      const backupPath = `${ASSESSMENTS_FILE}.backup.${Date.now()}`;
      try {
        await copyFile(ASSESSMENTS_FILE, backupPath);
        console.log(`Backup created: ${backupPath}`);
        // Write empty array to start fresh
        await writeFile(ASSESSMENTS_FILE, '[]', 'utf-8');
      } catch (backupError) {
        console.warn('Could not create backup:', backupError);
      }
    }
    return [];
  }
}

// Save all assessments to file
async function saveAssessments(assessments: AssessmentResult[]): Promise<void> {
  await ensureStorageDir();
  await writeFile(ASSESSMENTS_FILE, JSON.stringify(assessments, null, 2), 'utf-8');
}

/**
 * Store an assessment result
 */
export async function storeAssessment(result: AssessmentResult): Promise<void> {
  const assessments = await loadAssessments();
  
  // Check if this exact assessment already exists (same paperId, moduleName, assessmentDate)
  const existingIndex = assessments.findIndex(
    (a) =>
      a.paperId === result.paperId &&
      a.moduleName === result.moduleName &&
      a.assessmentDate === result.assessmentDate
  );

  if (existingIndex >= 0) {
    // Update existing assessment
    assessments[existingIndex] = result;
  } else {
    // Add new assessment
    assessments.push(result);
  }

  await saveAssessments(assessments);
}

/**
 * Get all assessments for a specific paper
 */
export async function getPaperAssessments(paperId: string): Promise<AssessmentResult[]> {
  const assessments = await loadAssessments();
  return assessments.filter((a) => a.paperId === paperId);
}

/**
 * Get all assessments from a specific module
 */
export async function getModuleAssessments(moduleName: string): Promise<AssessmentResult[]> {
  const assessments = await loadAssessments();
  return assessments.filter((a) => a.moduleName === moduleName);
}

/**
 * Get all assessments (for report generation)
 */
export async function getAllAssessments(): Promise<AssessmentResult[]> {
  return await loadAssessments();
}

/**
 * Get the latest assessment for a paper from a specific module
 */
export async function getLatestAssessment(
  paperId: string,
  moduleName: string
): Promise<AssessmentResult | null> {
  const assessments = await getPaperAssessments(paperId);
  const moduleAssessments = assessments.filter((a) => a.moduleName === moduleName);
  
  if (moduleAssessments.length === 0) {
    return null;
  }

  // Sort by date and return the latest
  return moduleAssessments.sort(
    (a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
  )[0];
}

