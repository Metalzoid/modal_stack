# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.2.0] - 2026-05-03

### Added
- **`max_depth` enforcement**: pushes past the cap are now intercepted by the reducer. The new `config.max_depth_strategy` (`:warn` default, `:raise`, `:silent`) controls behaviour. The cap can be disabled with `config.max_depth = nil`.
- **`ModalStackDepthError`** JS class, thrown by `push()` under the `:raise` strategy. Exported from `state.js`.
- **Scrollbar-width compensation**: `BrowserRuntime#lockScroll` now sets `--modal-stack-scrollbar-width` on `<html>` so the host CSS can offset fixed elements without layout shift. The CSS variable was already referenced by the Tailwind / Bootstrap / vanilla presets — this completes the wiring.
- **`modal_stack:error` custom event**: malformed Turbo Stream payloads (bad `data-*`, fetch failures) no longer crash the page. The error is logged and re-emitted as a bubbling `CustomEvent` on the `<dialog>` so apps can surface UI feedback.
- **JSDoc** on the JS public surface (`state.js`, `runtime.js`, `orchestrator.js`) — including `Layer`, `Stack`, `Command`, and `Transition` typedefs.
- New tests: max_depth strategies, scrollbar-width compensation, missing-handler error message, default_dismissible/max_depth/max_depth_strategy validation, dialog tag wiring.

### Changed
- `Configuration#default_dismissible=` now raises `ArgumentError` on non-boolean values (was a silent `attr_accessor`).
- `Configuration#max_depth=` now coerces strings, accepts `nil`, and rejects non-positive integers.
- `Orchestrator` constructor accepts `maxDepth` + `maxDepthStrategy`. The Stimulus controller forwards them via `data-modal-stack-max-depth-value` / `data-modal-stack-max-depth-strategy-value`, which `modal_stack_dialog_tag` now emits from the gem's configuration.
- The "runtime missing handler" error message now lists the runtime's known handlers and the current stack depth.
- `INITIALIZER_VERSION` bumped to `0.2.0` because the generator template gained `config.max_depth_strategy`.

## [0.1.1] - 2026-05-02

### Added
- Multi-Rails CI matrix (Ruby 3.2-4.0 × Rails 7.2/8.0/8.1/8.1+sprockets) via Appraisal.
- Automated release pipeline (`release.yml`) — push to `main` creates the tag, GitHub release, and publishes to RubyGems via OIDC trusted publishing.
- `bun test`, `bun run build:check`, and bundle-freshness CI jobs.
- Full Capybara + Cuprite system spec suite (boot, push, pop, replace, history-back, drawer sides, dismissible).
- Cuprite `rails_helper.rb` with the gem's Capybara matchers auto-loaded.
- Dependabot config for bundler + GitHub Actions (weekly).
- Comprehensive README with reference tables and theming guide.

### Changed
- RuboCop config rebuilt on a swal_rails-style baseline (Metrics tuned for DSL helpers, `Naming/PredicatePrefix` exempt for Capybara matchers, `ParameterLists` ignores keyword args). `.rubocop_todo.yml` deleted.
- `modal_link_to` refactored into smaller helpers to satisfy the new Metrics limits.
- Gemspec exclusions extended (`Appraisals`, `gemfiles/`, `examples/`, `CLAUDE.md`, `bunfig.toml`) so the published gem stays minimal.

### Fixed
- `capybara_spec` now restores `Capybara.app` / `current_driver` in an `around` block so the unit specs no longer pollute global state and break system specs that run after them.
- `modal_replace_spec` no longer caches a `within_modal` reference across the morph — avoids a Cuprite `NodeNotFoundError` race on slow CI runners.

## [0.1.0] - 2026-04-26

- Initial release.
