# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Frame transition CSS** fully implemented in all four presets (`tailwind_v4`, `tailwind_v3`, `bootstrap`, `vanilla`): `[data-transition="slide"]` animates the entering frame with `@starting-style translate` (slides in from the right on forward, from the left on back); `[data-transition="fade"]` cross-fades via `opacity`. The layer clips off-screen frames via a `:has([data-transition])` → `overflow: hidden` rule during animation, then the runtime removes `[data-transition]` / `[data-direction]` on `transitionend` (safety fallback: `#leaveTimeoutMs`-based timeout) so `overflow-y: auto` is fully restored afterward.
- **`top` / `bottom` drawer sides** in the `vanilla` and `bootstrap` presets (parity with `tailwind_v3` / `tailwind_v4`). Both presets gain the `--modal-stack-drawer-height` CSS token (default `22rem`), entry/exit `@starting-style` translate animations, `[data-leaving]` exit rules, and updated header comments.
- **`overscroll-behavior: contain`** on `[data-modal-stack-target="layer"]` in all four presets — prevents scroll chaining (Android pull-to-refresh, iOS bounce scrolling propagating to the page) when a modal's content is scrolled to its top or bottom boundary.
- **Safe-area inset** support: `padding-bottom: env(safe-area-inset-bottom, 0)` on `bottom_sheet` and `drawer[data-side="bottom"]` layers in all four presets — panel content is no longer obscured by the iOS home indicator.
- **`:focus-visible` ring** on `.modal-stack__panel-back` in all four presets — the back button now renders a keyboard-focus outline (`2px solid currentColor, offset 4px`) in full compliance with WCAG 2.4.7.

### Changed
- `modal_stack_container` helper: extracted `build_panel_attrs` private method — eliminates the `Metrics/MethodLength` RuboCop offense introduced by the `back:` / `transition:` parameters added in 0.4.0.

### Fixed
- `escapeAttr` fallback (used when `CSS.escape` is unavailable) now escapes `[` and `]` in addition to `"` and `\`. An unescaped `]` in a layer ID would prematurely close a CSS attribute selector such as `[data-layer-id="…"]`, producing either a silent no-op or a selector error depending on the browser.

## [0.4.0] - 2026-05-08

### Added
- **Path navigation inside a single layer** — `turbo_stream.modal_path_to(...)` appends a frame to the top layer's path; `turbo_stream.modal_path_back(steps: N)` walks back. Each forward step pushes a real history entry, so browser-back walks frames one by one before closing the layer. `modal_pop` / X / ESC still close the whole layer at once and collapse all of its frames from history in a single jump.
- **`Layer.frames` in the reducer**: every layer now carries an immutable `frames: [{ url, stale }]` array. Layers without a path read as a single-frame array, so existing `push` / `pop` / `replaceTop` behavior is unchanged.
- **In-memory frame cache** in `BrowserRuntime`: forward frames cache their HTML so back-navigation is instant — no network round-trip. The cache is purged when the layer closes; `purgeFrameCacheAbove` evicts entries when the user steps back.
- **`X-Modal-Stack-Stale` response header**: controllers can mark a frame stale at render time (or pass `stale: true` on the stream action) so the runtime refetches instead of restoring from cache when the user steps back to it.
- **`modal_back_link` view helper**: renders a button wired to the new `modal-stack-back-link` Stimulus controller. Accepts `steps:` (default 1) to collapse multiple frames in a single click. Pairs with the new `back: true` option on `modal_stack_container`, which injects a back-button slot — hidden by CSS when the layer is on its first frame (`[data-frame-depth="1"]`).
- **`config.default_path_transition`** (default `:slide`, also `:fade` / `:none`): read by `modal_path_to` / `modal_path_back` when no per-call `transition:` is given.
- **New Capybara matchers**: `have_modal_frames(count)` and `within_modal_frame(depth: nil)` for testing path-based wizards.
- **`modal-stack#pathBack` Stimulus action** for direct wiring on custom UI (`data-action="click->modal-stack#pathBack"`, optional `data-modal-stack-steps-param`).
- **CSS preset hooks**: every preset (`tailwind_v3`, `tailwind_v4`, `bootstrap`, `vanilla`) gains `[data-modal-stack-frame] { display: contents }` so the runtime's frame wrapper is layout-invisible, plus a `.modal-stack__panel-back` reset.
- **`Orchestrator#pathTo` / `pathBack`** public methods, `pathTo` / `pathBack` reducer functions, `mountFrame` / `unmountFrame` / `clearFrameCache` runtime commands.
- New tests: 38 added across `state.test.js`, `orchestrator.test.js`, `runtime.test.js`, plus Ruby specs for the new helpers / config / stream actions and a 4-example system spec covering forward, back via helper, multi-step back, browser back through frames, and ESC mid-path.

### Changed
- **Snapshot format bumped to v2** to carry the new `frames` array. v1 snapshots from existing tabs are restored gracefully — each v1 layer is rehydrated with a synthesised single-frame array, so an in-flight upgrade doesn't break sessions.
- **Layer DOM contract**: each layer's content is now wrapped in `<div data-modal-stack-frame data-frame-index="N">`. With `display: contents`, host CSS is unaffected. The layer carries `data-frame-depth="N"` and `data-frame-index="N"` for matchers and CSS hooks (e.g. hide the back button at depth 1).
- **`replaceTop` collapses path frames**: when the top layer has multiple frames, `replaceTop` walks history back over the surplus, evicts the cache, and morphs to a single-frame layer. Documented as a deliberate trade-off.
- **`pop` / `closeAll`** walk history back across every frame of every popped layer in a single jump, so the back button doesn't land on stale frame entries pointing at a closed layer.
- **`handlePopstate`** routes on `frameIndex` as well as depth: lower frame-index in the same layer steps back via `unmountFrame`; forward to a frame the state no longer tracks (e.g. after a back) defers to `rebuildFromSnapshot`.
- **`fetchFragment` returns `{ fragment, stale }`**: the runtime surfaces the `X-Modal-Stack-Stale` header to the orchestrator. The orchestrator's prefetch accepts both the new shape and the legacy bare-fragment return for back-compat with custom test runtimes.
- `INITIALIZER_VERSION` bumped to `0.4.0`; the install template documents `default_path_transition`.

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
  - The old `--modal-stack-backdrop-blur` variable (radius only) is replaced with `--modal-stack-backdrop-filter` (full filter expression). Default is `none`, which lets Chrome skip the filter pass entirely — `backdrop-filter: blur(0)` still allocated a filter layer, so a `0` radius wasn't actually free. Apps that want a blurred backdrop now opt in with `:root { --modal-stack-backdrop-filter: blur(8px); }` (any filter expression accepted, not just `blur()`).
  - `backdrop-filter` is no longer in the backdrop's `transition` list — when the user opts in, the filter is applied statically when the dialog opens, so the cost is paid once and the per-frame compositor work disappears.
  - `filter: blur(0.5px)` on inert (underlying) layers has been dropped — only `opacity: 0.5` remains. The blur was visually negligible on screen but forced an extra GPU layer per stacked modal.
  - The `filter` property has been removed from the layer's `transition` list since nothing animates it any more.
- **Backdrop fade now runs in parallel with the layer's leave animation** when closing the last modal (or `closeAll`). Previously the reducer emitted `[unmountTopLayer, …, closeDialog, …]` and the orchestrator awaited each command sequentially — `closeDialog` only fired after the layer's 220 ms `transitionend`, so the backdrop fade-out was perceived *after* the modal was gone (effective close time ≈ 440 ms). The reducer now emits `closeDialog` first; it's synchronous on the runtime, so the dialog's exit transition (opacity, backdrop background, `display`/`overlay` `allow-discrete`) starts immediately and runs alongside the layer's `[data-leaving]` transition. Total close time is now ≈ 220 ms. Fix applied to `pop`, `closeAll`, and the two `handlePopstate` branches that close the dialog.
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
