// Zero-network smoke test. Verifies the manifest/index hook contract, the CV
// Markdown hierarchy parsing (including #### nested sub-roles), and that the
// engine emits a valid .docx (ZIP/OOXML) buffer. Run by CI and by
// `plugins.mjs add` at install time. Uses only allowlisted node: builtins.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { parseCvMarkdown, buildCvDocxBuffer } from '../lib/cv-docx.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const KINDS = ['provider', 'ingest', 'search', 'notify', 'export'];

// --- Manifest ↔ index hook contract (the template's baseline check) ---------
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const mod = await import(path.join(root, manifest.entry || 'index.mjs'));
const hooks = mod.default;

assert(hooks && typeof hooks === 'object', 'default export must be an object of hooks');
const keys = Object.keys(hooks);
assert(keys.length > 0, 'declare at least one hook');
for (const k of keys) assert(KINDS.includes(k), `unknown hook "${k}"`);
for (const h of manifest.hooks)
  assert(keys.includes(h), `manifest declares hook "${h}" but index.mjs does not export it`);
assert(typeof hooks.export === 'function', 'export hook must be a function');
assert(manifest.humanInTheLoop === true, 'humanInTheLoop must be true');

// --- Hierarchy parsing on the bundled non-personal fixture ------------------
const md = readFileSync(path.join(root, 'examples', 'cv-fractional-example.md'), 'utf8');
const cv = parseCvMarkdown(md);

assert.equal(cv.name, 'Jordan Vale', 'H1 should parse to the name (label stripped)');
const titles = cv.sections.map((s) => s.title);
for (const t of [
  'Professional Summary',
  'Experience',
  'Selected Projects',
  'Education',
  'Skills',
]) {
  assert(titles.includes(t), `missing section "${t}"`);
}

const exp = cv.sections.find((s) => s.title === 'Experience');
const umbrella = exp.blocks.find((b) => b.type === 'entry' && /Vale Advisory/.test(b.company));
assert(umbrella, 'umbrella entry not found');
assert.equal(umbrella.subroles.length, 3, 'umbrella should hold 3 nested #### sub-roles');
assert(/NorthStar Analytics/.test(umbrella.subroles[0].title), 'first sub-role title wrong');
assert.equal(umbrella.subroles[0].date, '2023-2024', 'sub-role date wrong');
assert.equal(umbrella.subroles[0].bullets.length, 3, 'sub-role should keep its own bullets');

const standard = exp.blocks.find((b) => b.type === 'entry' && /Brightpath/.test(b.company));
assert(standard, 'standard entry not found');
assert.equal(standard.subroles.length, 0, 'a ### with no #### should have no sub-roles');
assert(
  standard.role && standard.date && standard.bullets.length === 3,
  'standard role should keep role/date/bullets',
);

// --- Output validity: a real .docx (ZIP/OOXML) buffer -----------------------
const buffer = buildCvDocxBuffer(md, { format: 'letter' });
assert(Buffer.isBuffer(buffer) && buffer.length > 2000, 'output should be a non-trivial buffer');
assert(buffer[0] === 0x50 && buffer[1] === 0x4b, 'output should start with the ZIP magic (PK)');

// Deterministic: identical input yields identical bytes.
const again = buildCvDocxBuffer(md, { format: 'letter' });
assert(buffer.equals(again), 'output should be deterministic for identical input');

// --- Nesting before the first ## section (issue #15) ------------------------
// A ### or #### above the first ## used to be dropped, and every line after it
// was swept into the contact block, so the loss was invisible in the output.
// Both the parse and the rendered document.xml are checked here: the parse
// alone cannot prove the content reached the page.

/**
 * Read one part out of a ZIP buffer by scanning local file headers.
 * @param {Buffer} buf
 * @param {string} name
 * @returns {string} The part's UTF-8 contents.
 */
function zipPart(buf, name) {
  const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  for (let i = buf.indexOf(sig); i !== -1; i = buf.indexOf(sig, i + 4)) {
    const method = buf.readUInt16LE(i + 8);
    const compressed = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    if (buf.toString('utf8', i + 30, i + 30 + nameLen) !== name) continue;
    const start = i + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + compressed);
    return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
  }
  throw new Error(`part not found: ${name}`);
}

/**
 * Cut a passage out of the bundled fixture, from `start` up to `end`.
 * @param {string} start - Literal text the passage begins with.
 * @param {string} [end] - Literal text that begins the following passage.
 * @returns {string} The passage, trimmed.
 */
function fixtureSlice(start, end) {
  const from = md.indexOf(start);
  assert(from !== -1, `fixture no longer contains "${start}"`);
  const to = end === undefined ? md.length : md.indexOf(end, from);
  assert(to !== -1, `fixture no longer contains "${end}" after "${start}"`);
  return md.slice(from, to).trim();
}

// The input is assembled out of the bundled fixture rather than written inline,
// so `examples/cv-fractional-example.md` stays the only CV sample data in the
// repo. The heading order under test is malformed on purpose and must not be
// folded back into that fixture, which is a valid CV the README points readers
// at: the ### and its #### are lifted above the first ## here instead.
const leadingMd = [
  fixtureSlice('# CV -- Jordan Vale', '\n**Location:'), // the H1 alone
  fixtureSlice('**Email:**', '\n**LinkedIn:'), // one contact line
  fixtureSlice('### Vale Advisory', '\n#### Cobalt'), // a ### entry with one nested ####
  fixtureSlice('## Education', '\n## Skills'), // a real ## section after the nesting
].join('\n\n');

const leading = parseCvMarkdown(leadingMd);
assert.deepEqual(
  leading.contact,
  ['jordan@example.com'],
  'the contact block should end at the first heading of any level',
);
assert.deepEqual(
  leading.sections.map((s) => s.title),
  ['', 'Education'],
  'pre-section nesting needs an implicit untitled leading section',
);

const leadEntry = leading.sections[0].blocks[0];
assert(leadEntry && leadEntry.type === 'entry', 'the leading ### should parse as an entry');
assert(/Vale Advisory/.test(leadEntry.company), 'leading entry company wrong');
assert.equal(leadEntry.role, 'Founder and Principal, Fractional Operations', 'leading role lost');
assert.equal(leadEntry.date, '2021-Present', 'leading date lost');
assert.equal(leadEntry.bullets.length, 2, 'leading entry bullets lost');
assert.equal(leadEntry.subroles.length, 1, 'leading entry should keep its #### sub-role');
assert(/NorthStar Analytics/.test(leadEntry.subroles[0].title), 'leading sub-role title wrong');
assert.equal(leadEntry.subroles[0].date, '2023-2024', 'leading sub-role date lost');
assert.equal(leadEntry.subroles[0].bullets.length, 3, 'leading sub-role bullets lost');

/** Count paragraphs carrying a given style in a document.xml string. */
const styleCount = (doc, styleId) =>
  (doc.match(new RegExp(`w:val="${styleId}"`, 'g')) || []).length;

const leadingDoc = zipPart(buildCvDocxBuffer(leadingMd, { format: 'letter' }), 'word/document.xml');
for (const text of [
  'Vale Advisory',
  'Founder and Principal, Fractional Operations',
  'NorthStar Analytics',
]) {
  assert(leadingDoc.includes(text), `pre-section content missing from the document: "${text}"`);
}
// Bullet text alone proves nothing: when the headings were dropped, every line
// below them was swallowed by the contact block and still reached the page as
// part of that one line. Assert on where the text lands, not just that it exists.
const contactParagraph = leadingDoc.match(/<w:p><w:pPr><w:pStyle w:val="Contact"\/>.*?<\/w:p>/);
assert(contactParagraph, 'contact paragraph missing');
assert(
  !/operating rhythm|concurrent fractional|2021-Present/.test(contactParagraph[0]),
  'body content below a pre-section heading was swept into the contact line',
);
assert.equal(
  styleCount(leadingDoc, 'Bullet'),
  6,
  'both pre-section bullets and the Education bullet should render as bullets',
);
assert.equal(
  styleCount(leadingDoc, 'SectionHeader'),
  1,
  'the untitled leading section must not emit an empty section header',
);

// A #### with no ### above it and no ## anywhere still has to reach the page.
// Assembled from the fixture for the same reason as above.
const orphanMd = [
  fixtureSlice('# CV -- Jordan Vale', '\n**Location:'),
  fixtureSlice('#### Meridian Labs', '\n### Brightpath'),
].join('\n\n');
const orphanDoc = zipPart(buildCvDocxBuffer(orphanMd), 'word/document.xml');
assert(orphanDoc.includes('Meridian Labs'), 'orphan #### heading dropped');
assert.equal(styleCount(orphanDoc, 'Bullet'), 2, 'orphan #### bullets should render as bullets');
assert.equal(styleCount(orphanDoc, 'SectionHeader'), 0, 'orphan #### needs no section header');

// An explicit ## whose text strips to empty is a different case from the
// implicit section: the author asked for a section, so the divider rule the
// SectionHeader style carries still belongs on the page. Suppression keys on
// how the section was opened, not on whether its title happens to be empty.
const emptyHeadingDoc = zipPart(
  buildCvDocxBuffer('## ** **\n\n- Only the header rule matters here.\n'),
  'word/document.xml',
);
assert.equal(
  styleCount(emptyHeadingDoc, 'SectionHeader'),
  1,
  'an explicit ## with empty heading text keeps its section header rule',
);

console.log('✓ smoke ok:', keys.join(', '));
