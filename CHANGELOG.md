# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.0.5] - 2026-04-30

### Changed

- **Breaking:** `Brain.create(config)` / `Brain.restore(pathOrStore)` replace `new Brain(...) + initialize()`. Constructors are private.
- **Breaking:** Standalone neurons get the same shape: `TextNeuron.create(config)` / `TextNeuron.restore(pathOrStore, {id?})` and `ListNeuron.create(config)` / `ListNeuron.restore(pathOrStore, {id?})` replace `new TextNeuron(...) + init()` / `new ListNeuron(...) + init()`. Constructors are private.
- **Breaking:** Per-neuron persistence resolves through `BrainStore.getNeuronStore(neuronId)`. The `BrainConfig.learning.store` factory is removed. Stores from prior versions are not compatible.
- Models persist as `{provider, modelId}` refs and rehydrate as gateway strings. Direct provider override via `brain.update({ model })` after restore.
- Deep-mode synthesis split into two phases (gather → synthesize) to avoid the Gemini Flash strict-schema tool-call loop.
- Runtime `'ai'` imports consolidated into `src/llm/index.ts`.

### Added

- CJS build for Electron and CommonJS consumers.
- Observation API on `BaseNeuron`: `getObservations`, `setObservations`, `updateObservation`, `removeObservation`.
- Neuron pause/resume: `brain.pauseNeuron(id)`, `brain.resumeNeuron(id)`, `brain.getNeuronStatus(id)`, `brain:neuron:status:changed` event. Inactive neurons are skipped during inject; query path unaffected.

### Fixed

- Heal orphan neuron rows on init retry; mid-init failures no longer poison subsequent `Brain.create()` attempts.
- Prevent empty insights from deep-mode synthesis loop on weak models.

## [0.0.4] - 2026-04-21

### Changed

- Refactor store internals to make persistent storage modular and extensible.
- Keep SQLite as the persistent backend while isolating runtime-specific adapters.

### Added

- Runtime-specific SQLite adapters for Node.js and Bun.
- Store release checks covering persistence, restore, and packaged-install smoke tests.

## [0.0.3] - 2026-04-14

- Baseline tagged release before formal changelog tracking started in-repo.
