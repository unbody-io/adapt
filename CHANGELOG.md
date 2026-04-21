# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, with release notes written to match the actual shipped package history for this repo.

## [Unreleased]

### Changed

- Refactor store internals to make persistent storage modular and extensible.
- Keep SQLite as the first-class persistent backend while isolating runtime-specific bindings at the adapter edge.
- Align internal eval and docs code imports with the current package entrypoints.

### Added

- Runtime-specific SQLite entrypoints:
  - `@unbody-io/adapt/sqlite` for Node.js
  - `@unbody-io/adapt/sqlite/bun` for Bun
- Shared internal store specs and builders to keep persistence semantics defined once.
- Shared SQLite core collection layer used by multiple runtimes.
- Store conformance coverage across memory, Node SQLite, and Bun SQLite.
- SQLite persistence and restore coverage for both Node and Bun.
- Brain restore smoke tests that exercise real Brain and neuron flows over SQLite.
- Packaged-install smoke checks for published Node and Bun entrypoints.
- A `test:release:store` release gate for store-focused verification.
- Public docs coverage for runtime-specific SQLite usage and release history.

## [0.0.3] - 2026-04-14

### Changed

- Baseline tagged release before formal changelog tracking started in-repo.
