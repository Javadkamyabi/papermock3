/**
 * Example script to run Module 4B: WritingIssueScanner
 * 
 * Usage: npx tsx src/examples/run-module4b.ts <document-id> <page-number>
 * 
 * This script retrieves page data from Module 4A's persistent storage
 * and analyzes it for writing quality issues.
 */

import 'dotenv/config';
import { WritingIssueScannerModule } from '../modules/writing-issue-scanner.js';
import { getDocumentPages, getPage } from '../db/documents.js';

async function runModule4B() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx src/examples/run-module4b.ts <document-id> <page-number>');
    console.error('Example: npx tsx src/examples/run-module4b.ts 1e1a66e0-512d-464a-b37d-62459ad75143 1');
    process.exit(1);
  }

  const documentId = args[0];
  const pageNumber = parseInt(args[1], 10);

  if (isNaN(pageNumber) || pageNumber < 1) {
    console.error('Error: page-number must be a positive integer');
    process.exit(1);
  }

  console.log('PaperMock3 - Module 4B: WritingIssueScanner');
  console.log('============================================\n');
  console.log(`Document ID: ${documentId}`);
  console.log(`Page Number: ${pageNumber}\n`);
  console.log('Note: This module analyzes writing quality on a single page.\n');

  try {
    // Get all pages for the document
    const pages = await getDocumentPages(documentId);
    
    if (pages.length === 0) {
      console.error(`Error: No pages found for document ${documentId}`);
      console.error('Make sure Module 4A has been run on this document first.');
      process.exit(1);
    }

    // Find the requested page
    const page = pages.find(p => p.page_number === pageNumber);
    
    if (!page) {
      console.error(`Error: Page ${pageNumber} not found for document ${documentId}`);
      console.error(`Available pages: ${pages.map(p => p.page_number).join(', ')}`);
      process.exit(1);
    }

    console.log(`Found page ${pageNumber} (${page.char_count} characters)\n`);
    console.log('Analyzing writing quality...\n');

    // Create module and scan the page
    const module = new WritingIssueScannerModule();
    
    const input = {
      document_id: page.document_id,
      page_id: page.page_id,
      page_number: page.page_number,
      page_text: page.page_text,
      section_hint: page.section_hint,
    };

    const result = await module.scanPage(input);
    
    console.log('Writing Issue Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`\n✓ Analysis complete!`);
      console.log(`✓ Found ${result.issues.length} writing issue(s)`);
      if (result.issues.length > 0) {
        const highSeverity = result.issues.filter(i => i.severity === 'high').length;
        const mediumSeverity = result.issues.filter(i => i.severity === 'medium').length;
        const lowSeverity = result.issues.filter(i => i.severity === 'low').length;
        console.log(`  - High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);
      }
    } else {
      console.error(`\n✗ Error: ${result.page_summary}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error processing page:', error);
    process.exit(1);
  }
}

runModule4B().catch(console.error);

