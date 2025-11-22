/**
 * Example script to run PipelineModule
 * 
 * Usage: npx tsx src/examples/run-pipeline.ts <pipeline_state_json_file>
 * 
 * This module orchestrates the execution of all modules in the PaperMock3 system.
 * It manages dependencies, tracks progress, handles retries, and reports blocking problems.
 * 
 * Example pipeline state JSON:
 * {
 *   "document_id": "doc-123",
 *   "paper_metadata": {
 *     "submission_id": "sub-123",
 *     "paper_title": "My Paper",
 *     "authors": ["Author 1"],
 *     "venue": null,
 *     "submission_date": "2025-01-01"
 *   },
 *   "paper_source": {
 *     "type": "pdf",
 *     "location": "/path/to/paper.pdf"
 *   },
 *   "modules_state": {
 *     "1": { "name": "Module1", "required": true, "status": "pending", "retries": 0, "last_error": null },
 *     ...
 *   },
 *   "max_retries_per_module": 2
 * }
 */

import 'dotenv/config';
import { PipelineModule } from '../modules/pipeline-module.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npx tsx src/examples/run-pipeline.ts <pipeline_state_json_file>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/examples/run-pipeline.ts pipeline-state.json');
    console.error('');
    console.error('Or provide pipeline state as JSON string:');
    console.error('  npx tsx src/examples/run-pipeline.ts \'{"document_id":"doc-123",...}\'');
    process.exit(1);
  }

  const inputArg = args[0];
  let pipelineState: any;

  try {
    // Try to parse as JSON string first
    if (inputArg.startsWith('{')) {
      pipelineState = JSON.parse(inputArg);
    } else {
      // Treat as file path
      const filePath = resolve(inputArg);
      const fileContent = await readFile(filePath, 'utf-8');
      pipelineState = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error reading or parsing pipeline state:', error);
    process.exit(1);
  }

  console.log('PaperMock3 - PipelineModule');
  console.log('============================');
  console.log('');
  console.log('Document ID:', pipelineState.document_id);
  console.log('Paper Title:', pipelineState.paper_metadata?.paper_title || 'N/A');
  console.log('');

  const module = new PipelineModule();

  try {
    console.log('Processing pipeline state...');
    console.log('');

    const result = await module.process(pipelineState);

    if (!result.success) {
      console.error('❌ PipelineModule failed:', result.error);
      process.exit(1);
    }

    console.log('Pipeline Orchestration Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('✓ Pipeline orchestration complete!');
    console.log('');
    console.log('Summary:');
    console.log(`  Pipeline Status: ${result.pipeline_status.toUpperCase()}`);
    console.log(`  Progress: ${result.progress.completed_required_modules}/${result.progress.total_required_modules} (${(result.progress.fraction * 100).toFixed(1)}%)`);
    console.log(`  Next Actions: ${result.next_actions.length}`);
    result.next_actions.forEach((action, idx) => {
      console.log(`    ${idx + 1}. ${action.action} on ${action.target_module || 'N/A'}: ${action.reason}`);
    });
    if (result.blocking_problems.length > 0) {
      console.log(`  Blocking Problems: ${result.blocking_problems.length}`);
      result.blocking_problems.forEach((problem, idx) => {
        console.log(`    ${idx + 1}. ${problem.module}: ${problem.reason}`);
      });
    }

  } catch (error) {
    console.error('Error running PipelineModule:', error);
    process.exit(1);
  }
}

main().catch(console.error);

