# career-ops-plugin-docx

Export your `cv.md` to a clean, ATS-friendly Microsoft Word `.docx`, straight
from the Markdown. A [career-ops](https://github.com/santifer/career-ops)
community plugin.

[![CI](https://github.com/rubicon/career-ops-plugin-docx/actions/workflows/ci.yaml/badge.svg)](https://github.com/rubicon/career-ops-plugin-docx/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it does

career-ops generates CVs as PDF and LaTeX. This plugin adds an editable Word
document, which is what some portals and recruiters ask for and what most people
reach for when they want to make a quick edit before sending.

It reads your `cv.md` and writes one single-column, Word-safe (Calibri) `.docx`.
No theme, no color, no graphics, so it parses cleanly in an ATS and still reads
well for a human. It runs entirely on your machine: no network, no API key.

## The headline feature: `####` nested sub-roles

The exporter honors your Markdown heading hierarchy, and the `####` level is the
reason this plugin exists:

| Markdown        | Renders as                                        |
| --------------- | ------------------------------------------------- |
| `# Name`        | Your name                                         |
| `## Section`    | A CV section (Experience, Education, Skills, ...) |
| `### Company`   | A role or company entry                           |
| `#### Sub-role` | A nested sub-role under its parent `###`          |

That `####` level lets one company entry hold several nested engagements, which
is how you represent **fractional, interim, and umbrella work**: an advisory or
consulting practice as the `###`, with each client engagement as a `####`
underneath it. Each nested sub-role gets its own right-flushed date and
deeper-indented bullets, instead of being flattened into separate jobs. A `###`
with no `####` children renders as an ordinary role.

There is a runnable, non-personal example at
[`examples/cv-fractional-example.md`](examples/cv-fractional-example.md):

```markdown
### Vale Advisory -- Remote (advisory practice)

**Founder and Principal, Fractional Operations**
2021-Present

- One or two umbrella-level bullets.

#### NorthStar Analytics -- Interim VP Operations

2023-2024

- Engagement-specific achievement.

#### Cobalt Systems -- Fractional Chief of Staff

2022-2023

- Engagement-specific achievement.
```

## Install

This is a career-ops plugin. From your career-ops checkout:

```bash
node plugins.mjs add docx
```

Then enable it in `config/plugins.yml`:

```yaml
plugins:
  docx:
    enabled: true
```

## Usage

```bash
node plugins.mjs run docx export            # writes output/cv-<name>.docx from cv.md
node plugins.mjs run docx export --dry-run  # report what it would write, write nothing
```

You can also run the exporter directly, outside career-ops, on any Markdown CV:

```bash
node bin/generate-docx.mjs path/to/cv.md path/to/out.docx --format=letter
```

## Configuration

Optional settings under `plugins.docx` in `config/plugins.yml`:

| Setting      | Default  | Meaning                                                    |
| ------------ | -------- | ---------------------------------------------------------- |
| `cv_path`    | `cv.md`  | CV source, relative to the project root                    |
| `output_dir` | `output` | Where the `.docx` is written, relative to the project root |
| `format`     | `a4`     | Page size: `a4` or `letter`                                |

## How it works

The engine parses `cv.md` and writes the WordprocessingML (OOXML) by hand, then
packs it into the `.docx` ZIP container. It has no runtime dependencies: only
relative modules and Node's built-in `zlib`, so it stays within the career-ops
plugin rules (dependency-free, no network, no process spawning). The parser and
the OOXML writer are separate, so the parser is reusable on its own.

## Development

```bash
npm install        # dev tooling only (Prettier, commitlint); the plugin ships with no runtime deps
npm test           # zero-network smoke test
npm run format:check
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and discussion are welcome. This
plugin is human-in-the-loop by design: it never submits anything anywhere, it
only writes a document you review.

## License

MIT. See [LICENSE](LICENSE).

## Contributors

![Contributors](https://contrib.rocks/image?repo=rubicon/career-ops-plugin-docx)
