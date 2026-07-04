# Architecture

career-ops-plugin-docx turns a Markdown CV into a Word `.docx`. It is a
career-ops plugin, so it must be dependency-free: relative modules plus
allowlisted Node built-ins only, no network, no process spawning.

## Layout

```
career-ops-plugin-docx/
  manifest.json          # plugin manifest (export hook, no env, no hosts)
  index.mjs              # the export hook: read cv.md, write output/<name>.docx
  lib/
    cv-docx.mjs          # parser (Markdown -> structure) + OOXML renderer
    zip.mjs              # minimal ZIP writer (node:zlib + pure-JS CRC-32)
  bin/
    generate-docx.mjs    # standalone CLI, for use outside career-ops
  test/
    smoke.mjs            # zero-network smoke test
  examples/
    cv-fractional-example.md   # non-personal sample CV
```

## Design boundary: parser and renderer are separate

`lib/cv-docx.mjs` has two halves that do not depend on each other's internals:

1. **`parseCvMarkdown(markdown)`** turns the CV Markdown into a plain data
   structure that preserves the heading hierarchy: sections (`##`), entries
   (`###`), and nested sub-roles (`####`). This is pure and reusable on its own.
2. **The renderer** turns that structure into WordprocessingML (OOXML) strings
   and hands them to the ZIP writer.

Keeping these apart means the parser can back other renderers (a differently
styled Word document, a different format) without change, and the renderer can
be reasoned about as pure string assembly.

## Why the OOXML is written by hand

A `.docx` is a ZIP of a handful of XML parts (`document.xml`, `styles.xml`,
`numbering.xml`, the content-types map, and relationships). career-ops plugins
cannot import an npm Word library because the registry forbids bare-specifier
(npm) imports. So the engine emits those XML parts directly and packs them with
`node:zlib`. The result has no runtime dependencies and passes the registry
static audit.

## The `####` hierarchy

The single most important behavior is that a `####` heading renders as a nested
sub-role under its parent `###`. That is what represents fractional, interim,
and umbrella engagements (several client engagements under one advisory
umbrella) instead of flattening them into separate jobs. Nested sub-roles get a
distinct paragraph style, their own right-flushed date, and bullets one list
level deeper.

## Data flow

```
cv.md ──> parseCvMarkdown ──> { name, contact, sections[ blocks[ entry[ subroles[] ] ] ] }
                                   │
                                   ▼
                         renderBody -> OOXML strings
                                   │
                                   ▼
                  zipSync([...parts]) ──> cv-<name>.docx (Buffer)
```
