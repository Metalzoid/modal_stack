# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.3.0] - 2026-05-03

### Added
- **Prefetch cache + dedupe** in `Orchestrator`: fragments fetched for `push` / `replaceTop` are cached per URL (TTL 30 s) and concurrent prefetches for the same URL share a single in-flight request. Aborts pending requests on `closeAll` and on stack-mismatching `popstate`.
- **Hover/focus prefetch** on `modal-stack-link`: links warm the cache on `pointerenter` / `focus` so the modal opens with no network latency on click. Opt out with `data-modal-stack-link-prefetch="false"`.
- **`Orchestrator#prefetch(url)`** public method (and matching `ModalStackController#prefetch`) for warming the cache from app code.
- **Request-scoped configuration** via `controller.modal_stack_config` (helper-method exposed). Rendering helpers now read configuration once per request instead of once per call.
- **`:tailwind_v4` CSS preset** that chains on Tailwind v4 `@theme` tokens (`--color-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--container-*`), so the modal stack inherits the host project's Tailwind theme automatically. Fallbacks match the Tailwind v4 defaults so the preset still renders correctly when `@theme` isn't redefined (or when Tailwind v4 isn't installed).
- **`:tailwind_v3` CSS preset** — the previous `:tailwind` preset, renamed for clarity. Static values aligned with Tailwind v3 defaults (Tailwind v3 doesn't expose tokens as CSS variables).
- `Configuration::CSS_PROVIDER_ALIASES` constant for legacy `:tailwind` → `:tailwind_v3` normalization.
- New tests: prefetch dedupe / cache hit / TTL / abort-on-closeAll / `prefetch` API; CSS-derived leave timeout; `:tailwind` alias normalization; generator default + alias mapping.

### Changed
- **Animation safety timeout** is now derived from the `--modal-stack-duration` CSS variable on the `<dialog>` (1.5× the declared duration, floored at 300 ms). Falls back to 600 ms when the variable is unset, so existing host CSS keeps working.
- `BrowserRuntime#fetchFragment` accepts an `{ signal }` option to support `AbortController` cancellation.
- **CSS preset perf overhaul**: removed animated blur from all four presets — animating `backdrop-filter: blur(2px)` on a fullscreen surface costs ~190 ms/frame on Hi-DPI displays (Retina, 4K), which collapsed modal animations to ~5 fps.
  - `--modal-stack-backdrop-blur` default is now `0` in every preset (was `2px` in `tailwind`). Apps that want a blurred backdrop can opt in by setting `--modal-stack-backdrop-blur: 8px` (or any value) on `:root`.
  - `backdrop-filter` is no longer in the backdrop's `transition` list — when the user opts in, the blur is applied statically when the dialog opens, so the cost is paid once and the per-frame compositor work disappears.
  - `filter: blur(0.5px)` on inert (underlying) layers has been dropped — only `opacity: 0.5` remains. The blur was visually negligible on screen but forced an extra GPU layer per stacked modal.
  - The `filter` property has been removed from the layer's `transition` list since nothing animates it any more.
- **`config.css_provider` default** is now `:tailwind_v3` (was `:tailwind`). Existing apps with `config.css_provider = :tailwind` keep working — the alias is normalized to `:tailwind_v3` on assignment, with no rendered CSS change.
- **Generator default `--css-provider`** is now `tailwind_v4` for new installs (was `tailwind`). Run `bin/rails g modal_stack:install --css-provider=tailwind_v3` to opt back in to the v3 preset, or pass the legacy `tailwind` flag — it's normalized to `tailwind_v3` in the generated initializer.
- The `app/assets/stylesheets/modal_stack/tailwind.css` file has been renamed to `tailwind_v3.css`. Sprockets manifests written by previous installs that contain `//= link modal_stack/tailwind.css` need the line updated to `tailwind_v3.css` (or `tailwind_v4.css`). Importmap / jsbundling installs aren't affected — they don't reference the stylesheet by filename.
- `INITIALIZER_VERSION` bumped to `0.3.0` because the generator template documents the new providers.

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
