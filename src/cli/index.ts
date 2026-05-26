#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { TestFile, RunResult } from '../schema';
import { executeTestFile, ExecutorOptions } from '../engine';

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`
testflow - JSON-driven test runner

Usage:
  testflow run <file.testflow.json> [options]
  testflow init [name]
  testflow serve

Commands:
  run     Execute a test file
  init    Create a new test file
  serve   Start the visual editor

Options (run):
  --headless        Run in headless mode (default: true)
  --headed          Run with visible browser
  --base-url <url>  Base URL for navigation
  --output <dir>    Output directory for results
  --reporter <type> Reporter: console, json, junit (default: console)
`);
}

async function run(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  if (command === 'init') {
    const name = args[1] || 'my-test';
    const file: TestFile = {
      version: '1.0',
      name,
      tests: [{
        id: 'test-1',
        name: 'First Test',
        steps: [
          { id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } },
          { id: 'step-2', type: 'assert_title', params: { expected: 'Example' } },
        ],
      }],
    };
    const path = `${name}.testflow.json`;
    writeFileSync(path, JSON.stringify(file, null, 2));
    console.log(`Created ${path}`);
    return;
  }

  if (command === 'serve') {
    console.log('Run "npm run dev" to start the visual editor');
    return;
  }

  if (command === 'run') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: No test file specified');
      process.exit(1);
    }

    const fullPath = resolve(filePath);
    if (!existsSync(fullPath)) {
      console.error(`Error: File not found: ${fullPath}`);
      process.exit(1);
    }

    const testFile: TestFile = JSON.parse(readFileSync(fullPath, 'utf-8'));
    const headed = args.includes('--headed');
    const baseUrlIdx = args.indexOf('--base-url');
    const reporterIdx = args.indexOf('--reporter');
    const outputIdx = args.indexOf('--output');

    const options: ExecutorOptions = {
      headless: !headed,
      baseUrl: baseUrlIdx > -1 ? args[baseUrlIdx + 1] : undefined,
    };

    console.log(`\n  Running: ${testFile.name}\n`);
    const result = await executeTestFile(testFile, options);

    const reporter = reporterIdx > -1 ? args[reporterIdx + 1] : 'console';
    const outputDir = outputIdx > -1 ? args[outputIdx + 1] : 'testflow-results';

    if (reporter === 'console') {
      printConsoleReport(result);
    } else if (reporter === 'json') {
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(`${outputDir}/results.json`, JSON.stringify(result, null, 2));
      console.log(`Results written to ${outputDir}/results.json`);
    } else if (reporter === 'junit') {
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(`${outputDir}/results.xml`, toJUnit(result));
      console.log(`JUnit XML written to ${outputDir}/results.xml`);
    }

    printConsoleReport(result);
    process.exit(result.summary.failed > 0 ? 1 : 0);
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

function printConsoleReport(result: RunResult): void {
  for (const test of result.results) {
    const icon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○';
    console.log(`  ${icon} ${test.testName} (${test.duration}ms)`);
    if (test.error) console.log(`    Error: ${test.error}`);
  }
  console.log(`\n  Summary: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped (${result.summary.duration}ms)\n`);
}

function toJUnit(result: RunResult): string {
  const tests = result.results.map(t => {
    if (t.status === 'failed') {
      return `    <testcase name="${t.testName}" time="${t.duration / 1000}"><failure message="${t.error || 'Test failed'}"/></testcase>`;
    }
    if (t.status === 'skipped') {
      return `    <testcase name="${t.testName}" time="0"><skipped/></testcase>`;
    }
    return `    <testcase name="${t.testName}" time="${t.duration / 1000}"/>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${result.file}" tests="${result.summary.total}" failures="${result.summary.failed}" skipped="${result.summary.skipped}" time="${result.summary.duration / 1000}">
${tests}
  </testsuite>
</testsuites>`;
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
