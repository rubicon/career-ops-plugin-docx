// @ts-check
/**
 * zip.mjs: a minimal, dependency-free ZIP writer.
 *
 * career-ops registry plugins must be dependency-free (relative modules plus an
 * allowlist of node: builtins, no npm imports). A .docx is a ZIP of a handful
 * of XML parts, so this writes the container by hand with node:zlib for DEFLATE
 * and a pure-JS CRC-32. Deterministic output (fixed DOS timestamp) so identical
 * input yields identical bytes.
 */

import { deflateRawSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

/** @type {Int32Array | null} */
let CRC_TABLE = null;

/** Build (once) and return the CRC-32 lookup table. */
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  CRC_TABLE = t;
  return t;
}

/**
 * Compute the CRC-32 of a buffer (ZIP/PKZIP polynomial).
 * @param {Buffer} buf
 * @returns {number} Unsigned 32-bit CRC.
 */
function crc32(buf) {
  const t = crcTable();
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ t[(c ^ buf[i]) & 0xff];
  return (c ^ ~0) >>> 0;
}

// Fixed DOS date/time (2020-01-01 00:00:00) so archives are reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

/**
 * Pack a set of named parts into a ZIP archive.
 *
 * @param {Array<{name: string, data: Buffer|string}>} files
 * @returns {Buffer} The ZIP bytes.
 */
export function zipSync(files) {
  /** @type {Buffer[]} */
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const content = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(content);
    const deflated = deflateRawSync(content);
    const useDeflate = deflated.length < content.length;
    const data = useDeflate ? deflated : content;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8); // compression method
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    chunks.push(local, nameBuf, data);

    central.push({ nameBuf, crc, comp: data.length, uncomp: content.length, method, offset });
    offset += local.length + nameBuf.length + data.length;
  }

  const cdStart = offset;
  for (const e of central) {
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); // central directory header signature
    c.writeUInt16LE(20, 4); // version made by
    c.writeUInt16LE(20, 6); // version needed
    c.writeUInt16LE(0, 8); // flags
    c.writeUInt16LE(e.method, 10);
    c.writeUInt16LE(DOS_TIME, 12);
    c.writeUInt16LE(DOS_DATE, 14);
    c.writeUInt32LE(e.crc, 16);
    c.writeUInt32LE(e.comp, 20);
    c.writeUInt32LE(e.uncomp, 24);
    c.writeUInt16LE(e.nameBuf.length, 28);
    c.writeUInt16LE(0, 30); // extra
    c.writeUInt16LE(0, 32); // comment
    c.writeUInt16LE(0, 34); // disk number start
    c.writeUInt16LE(0, 36); // internal attrs
    c.writeUInt32LE(0, 38); // external attrs
    c.writeUInt32LE(e.offset, 42);
    chunks.push(c, e.nameBuf);
    offset += c.length + e.nameBuf.length;
  }

  const cdSize = offset - cdStart;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length
  chunks.push(eocd);

  return Buffer.concat(chunks);
}
