# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2](https://github.com/rubicon/career-ops-plugin-docx/compare/v0.1.1...v0.1.2) (2026-08-08)


### Bug Fixes

* **ci:** address the release-please 1Password item by UUID ([#21](https://github.com/rubicon/career-ops-plugin-docx/issues/21)) ([f93d8a4](https://github.com/rubicon/career-ops-plugin-docx/commit/f93d8a4084bc0843d39533ea2daf11afd75716fb))

## [0.1.1] - 2026-07-30

First published release. A `0.1.0` was written up during development but never tagged or released, so the tag history begins at `v0.1.1` and the initial feature set is recorded here.

### Added

- Word `.docx` export for career-ops, generated directly from `cv.md` through the plugin `export` hook ([9252dc8](https://github.com/rubicon/career-ops-plugin-docx/commit/9252dc84c09dbb597c995190b82322109cf84805)).
- Support for the `cv.md` heading hierarchy: `##` sections, `###` company and role entries, and `####` nested sub-roles for fractional, interim, and umbrella engagements ([9252dc8](https://github.com/rubicon/career-ops-plugin-docx/commit/9252dc84c09dbb597c995190b82322109cf84805)).
- Standalone CLI (`bin/generate-docx.mjs`) for exporting any Markdown CV outside career-ops ([9252dc8](https://github.com/rubicon/career-ops-plugin-docx/commit/9252dc84c09dbb597c995190b82322109cf84805)).
- Configurable `cv_path`, `output_dir`, and `format` (a4 or letter) settings ([9252dc8](https://github.com/rubicon/career-ops-plugin-docx/commit/9252dc84c09dbb597c995190b82322109cf84805)).
- Dependency-free OOXML engine, relative modules plus Node built-ins only, with a zero-network smoke test ([9252dc8](https://github.com/rubicon/career-ops-plugin-docx/commit/9252dc84c09dbb597c995190b82322109cf84805)).
- A non-personal example CV at `examples/cv-fractional-example.md` ([9252dc8](https://github.com/rubicon/career-ops-plugin-docx/commit/9252dc84c09dbb597c995190b82322109cf84805)).

### Release pipeline

- Release automation now reads its GitHub App credentials from a 1Password service account at run time instead of per-repo secrets, so the signing identity behind a published release is rotated in one place ([#11](https://github.com/rubicon/career-ops-plugin-docx/pull/11)).

Contributors to this release: [Dax Davis](https://github.com/rubicon).

[Unreleased]: https://github.com/rubicon/career-ops-plugin-docx/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/rubicon/career-ops-plugin-docx/releases/tag/v0.1.1
