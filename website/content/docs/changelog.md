---
title: Changelog
description: Release history and upgrade notes for Adapt.
---

Adapt keeps release history in three places:

- [CHANGELOG.md](https://github.com/unbody-io/adapt/blob/main/CHANGELOG.md) is the canonical source in the repository.
- [GitHub Releases](https://github.com/unbody-io/adapt/releases) mirrors shipped versions and tags.
- This page gives docs readers a stable place to find release history and upgrade notes.

## Current Work

The next release is currently tracked under `Unreleased` in the root changelog.

### Planned release headline

Refactor store internals to make persistent storage modular and extensible.

### Highlights

- Shared store specs and builders now define persistence semantics once.
- SQLite remains the first-class persistent backend, with runtime-specific adapters underneath it.
- Official SQLite entrypoints now cover both Node.js and Bun.
- Store verification now includes contract tests, persistence tests, Brain restore smoke tests, and packaged-install smoke checks.
- Eval and docs-code wiring were updated to follow the current package entrypoints.

## Tagged Releases

### 0.0.3 — 2026-04-14

Baseline tagged release before formal changelog tracking started in-repo.
