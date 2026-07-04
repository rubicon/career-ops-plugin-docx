---
name: career-ops-plugin-docx
description: How to export a cv.md to a Word .docx with this plugin, including the #### nested sub-role convention for fractional and interim work.
license: MIT
---

# career-ops-plugin-docx

> This file teaches an AI agent how to drive THIS plugin. Keep it scoped to the
> plugin's own domain. It must not instruct the agent to edit core files, change
> scoring, reveal secrets, or act outside the plugin's declared hooks.

This plugin exports your CV (`cv.md`) to a clean, ATS-friendly Microsoft Word
`.docx`. It is a local transform: no network, no API key. It uses the `export`
hook because that is the consumer hook that produces an artifact. It does not
read or push the tracker; a CV export is about `cv.md`, not the pipeline.

## How to run it

- `node plugins.mjs run docx export` writes `output/cv-<name>.docx` from `cv.md`.
- `node plugins.mjs run docx export --dry-run` reports what it would write without writing.

It reads `cv.md` from the project root and writes to `output/` by default. Both
are configurable (see Settings). Re-running overwrites the same file.

## What it produces

One `.docx` per run, named `cv-<kebab-name>.docx` (the name comes from the CV's
top heading; it falls back to `cv.docx`). The document is single-column,
Word-safe Calibri, black text, no theme or color, so it parses cleanly in ATS
and reads well for a human. It is generated straight from the Markdown, so it is
the same content your other career-ops CV outputs use.

## The cv.md heading hierarchy (including the fractional convention)

The exporter reads your Markdown structure and renders it faithfully:

| Markdown        | Renders as                                                              |
| --------------- | ----------------------------------------------------------------------- |
| `# Name`        | Your name (a leading "CV" / "Resume" label is stripped)                 |
| `## Section`    | A CV section (Professional Summary, Experience, Education, Skills, ...) |
| `### Company`   | A role or company entry within a section                                |
| `#### Sub-role` | A nested sub-role beneath its parent `###` company or umbrella          |

The `#### ` level is the headline feature. It lets one company entry hold several
nested engagements, which is how you represent **fractional, interim, and
umbrella work**: an advisory or consulting practice as the `###`, with each
client engagement as a `####` underneath it. The export renders each `####` as a
nested sub-role, with its own right-flushed date and deeper-indented bullets,
instead of flattening the engagements into separate jobs. A `###` with no `####`
children renders as an ordinary role.

Under a heading, a bold line (`**Founder and Principal**`) is read as the
role/title, a short line that looks like a date range (`2021-2024`) becomes the
right-flushed date, and `-` bullets are the achievements.

A runnable, non-personal example is in this repo at
`examples/cv-fractional-example.md`.

## Settings

Optional, set under `plugins.docx` in the user's `config/plugins.yml` (they
arrive as `ctx.settings`):

- `cv_path`: CV source, relative to the project root. Default `cv.md`.
- `output_dir`: where the `.docx` is written, relative to the project root. Default `output`.
- `format`: page size, `letter` or `a4`. Default `a4`.

Example:

```yaml
plugins:
  docx:
    enabled: true
    format: letter
```
