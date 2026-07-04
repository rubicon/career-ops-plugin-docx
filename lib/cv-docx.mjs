// @ts-check
/**
 * cv-docx.mjs: the CV-to-Word engine for career-ops-plugin-docx.
 *
 * Pure and dependency-free: it takes a Markdown CV string and returns a .docx
 * Buffer, using only relative modules (lib/zip.mjs) and allowlisted node:
 * builtins. career-ops registry plugins may not import npm packages, so this
 * writes the OOXML (WordprocessingML) parts by hand rather than pulling in a
 * Word library. No filesystem, no CLI, no personal data. The parser and
 * renderer stay reusable.
 *
 * It parses cv.md generically from its Markdown hierarchy and renders one clean,
 * professional, ATS-friendly Word document:
 *   ## Section   → a CV section (Summary, Experience, Education, Skills, ...)
 *   ### Company   → a role / company entry within a section
 *   #### Sub-role → a nested sub-role beneath its parent ### company/umbrella
 *
 * The #### level represents fractional, interim, and umbrella work (several
 * client engagements under one advisory/consulting company) as nested sub-roles
 * instead of separate jobs. A ### with no #### renders as an ordinary role.
 */

import { zipSync } from './zip.mjs';

// --- Geometry (twips: 1/1440in) and type sizes (half-points) ---------------
const PAGE_SIZE = {
  letter: { w: 12240, h: 15840 }, // 8.5 x 11 in
  a4: { w: 11906, h: 16838 }, // 210 x 297 mm
};
const MARGIN = 1080; // 0.75in on all sides
const CONTENT_W = 12240 - MARGIN * 2; // right-tab column (10080); A4 is narrower and still lands inside

/** Supported page formats, exported for CLI validation and tests. */
export const FORMATS = Object.freeze(['a4', 'letter']);

// --- Markdown → structured CV ----------------------------------------------

/**
 * Strip a leading "CV" / "Resume" / "Curriculum Vitae" label from the H1 so the
 * document title is the person's name, not "CV -- Name".
 * @param {string} text
 * @returns {string}
 */
function stripNameLabel(text) {
  return text.replace(/^\s*(cv|resume|résumé|curriculum vitae)\s*[-–—:]+\s*/i, '').trim();
}

const DATE_RE = /\b(19|20)\d{2}\b|present|current|ongoing|now\b/i;
const BOLD_LINE_RE = /^\*\*(.+)\*\*$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

/**
 * Detect whether a plain line reads as a date range rather than prose.
 * @param {string} line
 * @returns {boolean}
 */
function looksLikeDate(line) {
  if (line.length > 40) return false;
  return DATE_RE.test(line);
}

/**
 * Reduce inline Markdown to plain text (links → label, drop emphasis/code marks).
 * @param {string} text
 * @returns {string}
 */
function stripInlineMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Parse a Markdown CV into an ordered structure that preserves the heading
 * hierarchy (## sections, ### company/role entries, #### nested sub-roles).
 *
 * Format-tolerant: role titles may be a bold line under the heading, dates are a
 * short line that looks like a date range, and bullets attach to the nearest
 * open sub-role, else the open entry, else the section itself.
 *
 * @param {string} markdown
 * @returns {{name: string, contact: string[], sections: Array}}
 */
export function parseCvMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const cv = { name: '', contact: [], sections: [] };
  let section = null;
  let entry = null;
  let subrole = null;
  let seenSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const h4 = line.match(/^####\s+(.*)$/);

    if (h4) {
      const title = stripInlineMarkdown(h4[1]);
      if (!section) continue;
      if (!entry) {
        entry = {
          type: 'entry',
          company: title,
          role: null,
          date: null,
          bullets: [],
          subroles: [],
        };
        section.blocks.push(entry);
        subrole = null;
        continue;
      }
      subrole = { type: 'subrole', title, role: null, date: null, bullets: [] };
      entry.subroles.push(subrole);
      continue;
    }

    if (h3) {
      if (!section) continue;
      entry = {
        type: 'entry',
        company: stripInlineMarkdown(h3[1]),
        role: null,
        date: null,
        bullets: [],
        subroles: [],
      };
      section.blocks.push(entry);
      subrole = null;
      continue;
    }

    if (h2) {
      seenSection = true;
      section = { title: stripInlineMarkdown(h2[1]), blocks: [] };
      cv.sections.push(section);
      entry = null;
      subrole = null;
      continue;
    }

    if (h1) {
      cv.name = stripNameLabel(h1[1]);
      continue;
    }

    if (!seenSection) {
      const labelled = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
      const value = labelled ? labelled[2].trim() : stripInlineMarkdown(line);
      if (value) cv.contact.push(value);
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const text = bullet[1].trim();
      if (subrole) subrole.bullets.push(text);
      else if (entry) entry.bullets.push(text);
      else section.blocks.push({ type: 'bullet', text });
      continue;
    }

    const bold = line.match(BOLD_LINE_RE);
    if (bold) {
      const text = bold[1].trim();
      if (subrole && !subrole.role) {
        subrole.role = text;
        continue;
      }
      if (entry && !entry.role) {
        entry.role = text;
        continue;
      }
    }

    if (looksLikeDate(line)) {
      if (subrole && !subrole.date) {
        subrole.date = line;
        continue;
      }
      if (entry && !entry.date) {
        entry.date = line;
        continue;
      }
    }

    const text = stripInlineMarkdown(line);
    if (subrole) subrole.bullets.push(text);
    else if (entry) entry.bullets.push(text);
    else section.blocks.push({ type: 'paragraph', text });
  }

  return cv;
}

// --- OOXML rendering --------------------------------------------------------

/**
 * Escape XML text content / attribute values.
 * @param {string} s
 * @returns {string}
 */
function xml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render inline Markdown to a run sequence, keeping **bold** spans bold. Size
 * and font come from the paragraph style; only bold is set per-run here.
 * @param {string} text
 * @returns {string} Concatenated <w:r> XML.
 */
function inlineRuns(text) {
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1$2');
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 0) return `<w:r><w:t xml:space="preserve"></w:t></w:r>`;
  let out = '';
  for (const part of parts) {
    const b = part.match(/^\*\*([^*]+)\*\*$/);
    if (b)
      out += `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${xml(b[1])}</w:t></w:r>`;
    else out += `<w:r><w:t xml:space="preserve">${xml(part)}</w:t></w:r>`;
  }
  return out;
}

/**
 * A styled paragraph with a plain (style-formatted) single run.
 * @param {string} styleId
 * @param {string} text
 * @returns {string}
 */
function styledParagraph(styleId, text) {
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

/**
 * A company/role or sub-role heading with the title left and the date flushed
 * right via the style's right tab stop (a real <w:tab/> element).
 * @param {string} styleId
 * @param {string} title
 * @param {string|null} date
 * @returns {string}
 */
function headingLine(styleId, title, date) {
  let runs = `<w:r><w:t xml:space="preserve">${xml(title)}</w:t></w:r>`;
  if (date) {
    runs += `<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:tab/><w:t xml:space="preserve">${xml(date)}</w:t></w:r>`;
  }
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${runs}</w:p>`;
}

/**
 * A bullet paragraph at a numbering level (0 top-level, 1 under a sub-role).
 * @param {string} text
 * @param {0|1} level
 * @returns {string}
 */
function bulletParagraph(text, level) {
  return `<w:p><w:pPr><w:pStyle w:val="Bullet"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr></w:pPr>${inlineRuns(text)}</w:p>`;
}

/**
 * A body paragraph with inline runs (used for the Professional Summary prose).
 * @param {string} text
 * @returns {string}
 */
function bodyParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>${inlineRuns(text)}</w:p>`;
}

/**
 * Render the parsed CV to the ordered <w:p> sequence for the document body.
 * @param {ReturnType<typeof parseCvMarkdown>} cv
 * @returns {string}
 */
function renderBody(cv) {
  let out = '';
  if (cv.name) out += styledParagraph('Name', cv.name);
  if (cv.contact.length) out += styledParagraph('Contact', cv.contact.join('  |  '));

  for (const section of cv.sections) {
    out += styledParagraph('SectionHeader', section.title.toUpperCase());
    for (const block of section.blocks) {
      if (block.type === 'paragraph') out += bodyParagraph(block.text);
      else if (block.type === 'bullet') out += bulletParagraph(block.text, 0);
      else if (block.type === 'entry') {
        out += headingLine('Company', block.company, block.date);
        if (block.role) out += styledParagraph('Role', block.role);
        for (const b of block.bullets) out += bulletParagraph(b, 0);
        for (const sr of block.subroles) {
          const title = sr.role ? `${sr.title} - ${sr.role}` : sr.title;
          out += headingLine('SubRole', title, sr.date);
          for (const b of sr.bullets) out += bulletParagraph(b, 1);
        }
      }
    }
  }
  return out;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * word/document.xml for a given body and page format.
 * @param {string} bodyXml
 * @param {'letter'|'a4'} format
 * @returns {string}
 */
function documentXml(bodyXml, format) {
  const size = PAGE_SIZE[format] || PAGE_SIZE.a4;
  const sect =
    `<w:sectPr>` +
    `<w:pgSz w:w="${size.w}" w:h="${size.h}" w:orient="portrait"/>` +
    `<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="708" w:footer="708" w:gutter="0"/>` +
    `</w:sectPr>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W_NS}"><w:body>${bodyXml}${sect}</w:body></w:document>`
  );
}

// Named paragraph styles: generic, theme-free, Word-safe Calibri, black text, a
// neutral rule under section headers, keep-together flags on structural styles.
const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="${W_NS}">` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="SectionHeader"><w:name w:val="Section Header"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="220" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Company"><w:name w:val="Company"/><w:pPr><w:keepNext/><w:keepLines/><w:tabs><w:tab w:val="right" w:pos="${CONTENT_W}"/></w:tabs><w:spacing w:before="160" w:after="20"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Role"><w:name w:val="Role"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:after="40"/></w:pPr><w:rPr><w:i/><w:iCs/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="SubRole"><w:name w:val="Sub Role"/><w:pPr><w:keepNext/><w:keepLines/><w:tabs><w:tab w:val="right" w:pos="${CONTENT_W}"/></w:tabs><w:spacing w:before="100" w:after="20"/><w:ind w:left="360"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Body"><w:name w:val="Body"/><w:pPr><w:spacing w:after="80"/></w:pPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Bullet"/><w:pPr><w:keepLines/><w:spacing w:after="40"/></w:pPr></w:style>` +
  `</w:styles>`;

// One abstract bullet list with two levels: • at the role level, ◦ one level
// deeper for bullets under a nested sub-role.
const NUMBERING_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:numbering xmlns:w="${W_NS}">` +
  `<w:abstractNum w:abstractNumId="0">` +
  `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="600" w:hanging="280"/></w:pPr></w:lvl>` +
  `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1080" w:hanging="280"/></w:pPr></w:lvl>` +
  `</w:abstractNum>` +
  `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>` +
  `</w:numbering>`;

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const DOC_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>` +
  `</Relationships>`;

/**
 * Build the .docx as a Buffer from a Markdown CV string.
 * @param {string} markdown - cv.md-style Markdown.
 * @param {{format?: 'letter'|'a4'}} [opts]
 * @returns {Buffer}
 */
export function buildCvDocxBuffer(markdown, opts = {}) {
  const format = FORMATS.includes((opts.format || '').toLowerCase())
    ? opts.format.toLowerCase()
    : 'a4';
  const cv = parseCvMarkdown(markdown);
  const body = renderBody(cv);
  return zipSync([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'word/document.xml', data: documentXml(body, format) },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/numbering.xml', data: NUMBERING_XML },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
  ]);
}
