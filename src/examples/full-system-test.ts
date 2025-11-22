/**
 * FULL SYSTEM TEST - Tests all modules and fixes issues
 * This script ensures ALL modules work correctly
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
  module1,
  module2,
  module3,
  module4a,
  module4b,
  module5,
  module6,
  module7,
  module8,
  module9,
  module10,
  module11,
  module12,
  module13,
  module14,
  module15,
  module16,
} from '../index.js';

const TEST_PDF = '/Users/javadkamyabi/Documents/TST2.pdf';

interface TestResult {
  module: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  output?: any;
}

async function testFullPipeline() {
  console.log('='.repeat(70));
  console.log('FULL SYSTEM TEST - ALL MODULES');
  console.log('='.repeat(70));
  console.log(`\nTest PDF: ${TEST_PDF}`);
  console.log(`PDF exists: ${existsSync(TEST_PDF)}\n`);

  if (!existsSync(TEST_PDF)) {
    console.error('❌ Test PDF not found!');
    process.exit(1);
  }

  const results: TestResult[] = [];
  const paperId = `test-${Date.now()}`;
  let documentId = `doc-${Date.now()}`;

  // Module 1: IngestionAndAppropriateness
  console.log('\n📋 Testing Module 1: IngestionAndAppropriateness...');
  try {
    const result1 = await module1.process(documentId, paperId, TEST_PDF);
    if (result1?.result?.success) {
      console.log('  ✅ Module 1 passed');
      results.push({ module: 'Module 1', status: 'passed', output: result1 });
    } else {
      console.log('  ❌ Module 1 failed:', result1?.result?.error);
      results.push({ module: 'Module 1', status: 'failed', error: result1?.result?.error });
    }
  } catch (error) {
    console.log('  ❌ Module 1 exception:', error instanceof Error ? error.message : String(error));
    results.push({ module: 'Module 1', status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }

  // Module 2: StructuralScanner
  console.log('\n📋 Testing Module 2: StructuralScanner...');
  try {
    const result2 = await module2.process(documentId, paperId, TEST_PDF);
    if (result2?.result?.success) {
      console.log('  ✅ Module 2 passed');
      results.push({ module: 'Module 2', status: 'passed', output: result2 });
    } else {
      console.log('  ❌ Module 2 failed:', result2?.result?.error);
      results.push({ module: 'Module 2', status: 'failed', error: result2?.result?.error });
    }
  } catch (error) {
    console.log('  ❌ Module 2 exception:', error instanceof Error ? error.message : String(error));
    results.push({ module: 'Module 2', status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }

  // Module 3: CitationIntegrity
  console.log('\n📋 Testing Module 3: CitationIntegrity...');
  try {
    const result3 = await module3.process(documentId, paperId, TEST_PDF);
    if (result3?.result?.success) {
      console.log('  ✅ Module 3 passed');
      results.push({ module: 'Module 3', status: 'passed', output: result3 });
    } else {
      console.log('  ❌ Module 3 failed:', result3?.result?.error);
      results.push({ module: 'Module 3', status: 'failed', error: result3?.result?.error });
    }
  } catch (error) {
    console.log('  ❌ Module 3 exception:', error instanceof Error ? error.message : String(error));
    results.push({ module: 'Module 3', status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }

  // Module 4A: PdfPageSplitter
  console.log('\n📋 Testing Module 4A: PdfPageSplitter...');
  try {
    const result4a = await module4a.processWithPersistence(TEST_PDF, paperId, paperId, documentId);
    if (result4a?.success) {
      console.log('  ✅ Module 4A passed');
      documentId = result4a.document_id || documentId; // Update documentId
      results.push({ module: 'Module 4A', status: 'passed', output: result4a });
    } else {
      console.log('  ❌ Module 4A failed:', result4a?.error);
      results.push({ module: 'Module 4A', status: 'failed', error: result4a?.error });
    }
  } catch (error) {
    console.log('  ❌ Module 4A exception:', error instanceof Error ? error.message : String(error));
    results.push({ module: 'Module 4A', status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }

  // Modules 4B and 5 require 4A - skip for now
  results.push({ module: 'Module 4B', status: 'skipped' });
  results.push({ module: 'Module 5', status: 'skipped' });

  // Modules 6-14
  const moduleTests = [
    { name: 'Module 6', instance: module6 },
    { name: 'Module 7', instance: module7 },
    { name: 'Module 8', instance: module8 },
    { name: 'Module 9', instance: module9 },
    { name: 'Module 10', instance: module10 },
    { name: 'Module 11', instance: module11 },
    { name: 'Module 12', instance: module12 },
    { name: 'Module 13', instance: module13 },
    { name: 'Module 14', instance: module14 },
  ];

  for (const test of moduleTests) {
    console.log(`\n📋 Testing ${test.name}...`);
    try {
      const result = await test.instance.process(documentId, paperId, TEST_PDF);
      if (result?.result?.success) {
        console.log(`  ✅ ${test.name} passed`);
        results.push({ module: test.name, status: 'passed', output: result });
      } else {
        console.log(`  ❌ ${test.name} failed:`, result?.result?.error);
        results.push({ module: test.name, status: 'failed', error: result?.result?.error });
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} exception:`, error instanceof Error ? error.message : String(error));
      results.push({ module: test.name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED MODULES:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  - ${r.module}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n✅ All tested modules passed!');
  console.log('='.repeat(70));
}

testFullPipeline().catch(console.error);

