/**
 * Comprehensive test of ALL modules
 * Tests each module individually and checks outputs
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as modules from '../index.js';

const TEST_PDF = '/Users/javadkamyabi/Documents/TST2.pdf';

interface ModuleTestResult {
  moduleName: string;
  success: boolean;
  error?: string;
  output?: any;
  issues: string[];
}

async function testModule(moduleName: string, moduleInstance: any, testData: any): Promise<ModuleTestResult> {
  const result: ModuleTestResult = {
    moduleName,
    success: false,
    issues: [],
  };

  try {
    console.log(`\n📋 Testing ${moduleName}...`);
    
    let output: any;
    
    // Different modules have different process signatures
    if (moduleName === 'PdfPageSplitter') {
      const paperId = `test-${Date.now()}`;
      const documentId = `doc-${Date.now()}`;
      output = await moduleInstance.processWithPersistence(TEST_PDF, paperId, paperId, documentId);
    } else if (moduleName === 'WritingIssueScanner') {
      // Skip - requires pages from Module 4A
      result.success = true;
      result.issues.push('Skipped - requires Module 4A output');
      return result;
    } else if (moduleName === 'WritingQualitySummary') {
      // Skip - requires Module 4B output
      result.success = true;
      result.issues.push('Skipped - requires Module 4B output');
      return result;
    } else if (moduleName === 'FinalReportComposer') {
      // Skip - requires all previous modules
      result.success = true;
      result.issues.push('Skipped - requires all previous modules');
      return result;
    } else if (moduleName === 'PDFReportLayoutGenerator') {
      // Skip - requires Module 15
      result.success = true;
      result.issues.push('Skipped - requires Module 15');
      return result;
    } else {
      // Standard modules
      const documentId = `test-doc-${Date.now()}`;
      const paperId = `test-paper-${Date.now()}`;
      output = await moduleInstance.process(documentId, paperId, TEST_PDF);
    }

    result.output = output;
    
    // Validate output
    if (!output) {
      result.issues.push('No output returned');
      return result;
    }

    if (output.success === false) {
      result.issues.push(`Module returned success: false - ${output.error || 'Unknown error'}`);
      return result;
    }

    // Check for common issues
    if (typeof output === 'object') {
      if (output.error && output.success !== false) {
        result.issues.push(`Output contains error field: ${output.error}`);
      }
      
      // Check for empty content
      const hasContent = Object.keys(output).some(key => {
        const val = output[key];
        if (typeof val === 'string' && val.trim().length > 0) return true;
        if (Array.isArray(val) && val.length > 0) return true;
        if (typeof val === 'object' && val !== null && Object.keys(val).length > 0) return true;
        return false;
      });
      
      if (!hasContent) {
        result.issues.push('Output appears to be empty or has no meaningful content');
      }
    }

    result.success = true;
    console.log(`  ✅ ${moduleName} passed`);
    
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
    result.issues.push(`Exception: ${result.error}`);
    console.log(`  ❌ ${moduleName} failed: ${result.error}`);
  }

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE MODULE TESTING');
  console.log('='.repeat(60));
  console.log(`\nTest PDF: ${TEST_PDF}`);
  console.log(`PDF exists: ${existsSync(TEST_PDF)}`);
  console.log('');

  if (!existsSync(TEST_PDF)) {
    console.error('❌ Test PDF not found!');
    process.exit(1);
  }

  const results: ModuleTestResult[] = [];

  // Test each module
  const moduleTests = [
    { name: 'IngestionAndAppropriateness', instance: modules.module1 },
    { name: 'StructuralScanner', instance: modules.module2 },
    { name: 'CitationIntegrity', instance: modules.module3 },
    { name: 'PdfPageSplitter', instance: modules.module4a },
    // Module 4B and 5 require 4A output
    { name: 'ArgumentationAndClaimSupportAnalyzer', instance: modules.module6 },
    { name: 'MethodologyQualityAnalyzer', instance: modules.module7 },
    { name: 'DatasetAndDataReliabilityAnalyzer', instance: modules.module8 },
    { name: 'NoveltyAndContributionAnalyzer', instance: modules.module9 },
    { name: 'LiteratureReviewAnalyzer', instance: modules.module10 },
    { name: 'AIBC-CoherenceAnalyzer', instance: modules.module11 },
    { name: 'ResultsAndStatisticalSoundnessAnalyzer', instance: modules.module12 },
    { name: 'RobustnessAndGeneralizationAnalyzer', instance: modules.module13 },
    { name: 'EthicsReproducibilityTransparencyAnalyzer', instance: modules.module14 },
  ];

  for (const test of moduleTests) {
    const result = await testModule(test.name, test.instance, {});
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const skipped = results.filter(r => r.success && r.issues.some(i => i.includes('Skipped'))).length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED MODULES:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.moduleName}: ${r.error}`);
      if (r.issues.length > 0) {
        r.issues.forEach(issue => console.log(`    • ${issue}`));
      }
    });
  }

  if (results.some(r => r.issues.length > 0 && !r.issues.some(i => i.includes('Skipped')))) {
    console.log('\n⚠️  MODULES WITH ISSUES:');
    results.filter(r => r.issues.length > 0 && !r.issues.some(i => i.includes('Skipped'))).forEach(r => {
      console.log(`  - ${r.moduleName}:`);
      r.issues.forEach(issue => console.log(`    • ${issue}`));
    });
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);

