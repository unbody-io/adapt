# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- Refactor store internals to make persistent storage modular and extensible.
- Keep SQLite as the persistent backend while isolating runtime-specific adapters.

### Added

- Runtime-specific SQLite adapters for Node.js and Bun.
- Store release checks covering persistence, restore, and packaged-install smoke tests.

## [0.0.3] - 2026-04-14

- Baseline tagged release before formal changelog tracking started in-repo.
