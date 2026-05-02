# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

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
