#!/usr/bin/env node
// @ts-check
/**
 * generate-docx.mjs: standalone CLI for the CV-to-Word engine.
 *
 * Usage:
 *   node bin/generate-docx.mjs <input.md> <output.docx> [--format=letter|a4]
 *
 * Reads a Markdown CV (cv.md-style) and writes a clean, ATS-friendly .docx.
 * The plugin's export hook (index.mjs) shares the same engine (lib/cv-docx.mjs);
 * this CLI exists so the exporter is usable directly, outside the plugin engine.
 */

import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildCvDocxBuffer, FORMATS } from '../lib/cv-docx.mjs';

async function main() {
  const args = process.argv.slice(2);
  let inputPath;
  let outputPath;
  let format = 'a4';

  for (const arg of args) {
    if (arg.startsWith('--format=')) format = arg.split('=')[1].toLowerCase();
    else if (!inputPath) inputPath = arg;
    else if (!outputPath) outputPath = arg;
  }

  if (!inputPath || !outputPath) {
    console.error(
      'Usage: node bin/generate-docx.mjs <input.md> <output.docx> [--format=letter|a4]',
    );
    process.exit(1);
  }

  if (!FORMATS.includes(format)) {
    console.error(`Invalid format "${format}". Use: ${FORMATS.join(', ')}`);
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);

  // Path-traversal guard: keep the .docx write inside the working directory so a
  // crafted output argument (e.g. "../../etc/cron.d/x") cannot escape it.
  const relOut = relative(process.cwd(), outputPath);
  if (relOut === '' || relOut.startsWith('..') || isAbsolute(relOut)) {
    console.error(`Refusing to write the .docx outside the working directory: ${outputPath}`);
    process.exit(1);
  }

  const markdown = readFileSync(inputPath, 'utf-8');
  const buffer = buildCvDocxBuffer(markdown, { format });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);

  console.log(
    `DOCX generated: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB, ${format.toUpperCase()})`,
  );
}

main().catch((err) => {
  console.error('DOCX generation failed:', err.message);
  process.exit(1);
});
