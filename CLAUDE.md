# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`modal_stack` is a Rails engine + ES-module JS runtime that adds a *stack* of modals / drawers / bottom sheets / confirmations on top of Hotwire. The top of the stack is encoded in a real Rails URL (so back/forward and deep-linking work), and stack mutations are driven by imperative Turbo Stream actions (`modal_push`, `modal_pop`, `modal_replace`, `modal_close_all`).

## Common commands

```bash
# Ruby
bundle exec rake                       # default task: rspec + rubocop
bundle exec rspec                      # all Ruby specs
bundle exec rspec spec/path_spec.rb    # one file
bundle exec rspec spec/foo_spec.rb:42  # one example
bundle exec rubocop                    # lint only
bin/console                            # IRB with the gem loaded

# JavaScript (uses Bun)
bun test                               # all JS tests (*.test.js)
bun test path/to/file.test.js          # one file
bun test --watch
bun run build:check                    # type-/build-check the JS entry

# Rebuild the concatenated importmap bundle (commit the result)
bin/build                              # → app/assets/javascripts/modal_stack.js

# JS-only demo (no Rails)
bun examples/serve.js                  # http://localhost:4321/
```

CI runs `bundle exec rake` on Ruby 3.3.5 (`.github/workflows/main.yml`). Note the workflow is wired to push-on-`master` but the active branch is `main` — Ruby CI currently only runs on pull requests.

## Architecture

The gem is a **two-layer codebase**: a Rails engine (Ruby) and a vanilla ES-module runtime (JS). The two halves communicate only via DOM data attributes and the `X-Modal-Stack-Request` HTTP header — they're tested independently.

### Ruby side (`lib/modal_stack/`)

- **`engine.rb`** — Rails::Engine wiring. Uses `ActiveSupport.on_load` hooks to mix helpers into ActionView, `ControllerExtensions` into `ActionController::Base`, and `TurboStreamsExtension` into `Turbo::Streams::TagBuilder`. Also registers asset paths.
- **`configuration.rb`** — `ModalStack.configure { |c| ... }` singleton. Whitelists for `css_provider`, `assets_mode`, `default_variant`, `default_size`. Spec helper calls `ModalStack.reset_configuration!` before each example.
- **`controller_extensions.rb`** — adds `modal_stack_layout` class macro (flips to `modal` layout when the request carries the `X-Modal-Stack-Request` header) and `render_modal` for re-renders after validation failures.
- **`turbo_streams_extension.rb`** — adds `turbo_stream.modal_push / modal_pop / modal_replace / modal_close_all`. All target the singleton `<dialog>` id (`ModalStack::TARGET_ID = "modal-stack-root"`); options propagate as `data-*` on the stream element and are read by the JS controller.
- **`helpers/`** — `modal_link_to` (adds Stimulus wiring; no-ops to plain `link_to` for Hotwire Native), `modal_stack_container` (panel wrapper), `modal_stack_stylesheet_link_tag` / `modal_stack_dialog_tag` (layout helpers).
- **`initializer_version_check.rb`** — boot-time warning when `config.initializer_version` ≠ `ModalStack::INITIALIZER_VERSION` (= "0.1.0"). Bump the constant in `lib/modal_stack.rb` whenever the generator template gains/loses an option.
- **`capybara.rb`** + **`capybara/rspec.rb`** — system spec matchers (`within_modal`, `have_modal_open`, `have_modal_stack`, `close_modal`). Auto-included via `require "modal_stack/capybara/rspec"`.
- **`lib/generators/modal_stack/install/`** — `bin/rails g modal_stack:install`. Auto-detects `importmap` / `jsbundling` / `sprockets` from the host app's files, injects helpers into `application.html.erb`, and writes `config/initializers/modal_stack.rb` from an ERB template.

### JavaScript side (`app/javascript/modal_stack/`)

The JS is split deliberately so the brain (state.js) is pure and the IO (runtime.js) is swappable:

- **`state.js`** — pure functional reducer. `createStack`, `push`, `pop`, `replaceTop`, `closeAll`, `handlePopstate`, `snapshot`, `restore`. Each transition returns `{ state, commands }`; no DOM, no fetch, no history. Layers are frozen. **Keep this file pure** — it's covered to 100% and that's how regressions get caught.
- **`orchestrator.js`** — owns the current state, calls the reducer, executes commands against an injected runtime, and pre-fetches fragments for `push`/`replaceTop` when no HTML is provided. Maintains an `#expectedPopstates` counter so its own `historyBack` calls don't re-enter the reducer when the resulting `popstate` fires.
- **`runtime.js`** — `BrowserRuntime`, the only file that touches `<dialog>`, `history`, `fetch`, and `sessionStorage`. Implements one method per command type the reducer emits. `animateOut` adds `[data-leaving]`, awaits `transitionend`, and falls back to a 600 ms hard timeout if the host CSS has no exit transition.
- **`controllers/modal_stack_controller.js`** — Stimulus controller bound to the singleton `<dialog>`. On connect: instantiates `BrowserRuntime` + `Orchestrator`, restores from `sessionStorage` if present, registers `popstate` / `cancel` / backdrop-click handlers, and registers the four `Turbo.StreamActions`.
- **`controllers/modal_stack_link_controller.js`** — turns a plain `<a>` into `orchestrator.push({ url: a.href, ... })`.
- **`install.js`** — `install(application)` registers both Stimulus controllers. This is the importmap entrypoint.
- **`app/assets/javascripts/modal_stack.js`** — pre-built browser bundle (Stimulus + Turbo external). **Committed**; rebuild via `bin/build` after touching anything under `app/javascript/`.

### Test layout

- Ruby specs live in `spec/`, with a Rails dummy app under `spec/dummy/` that loads the engine. `spec/spec_helper.rb` resets configuration between examples.
- JS specs are colocated as `*.test.js` next to their source (`state.test.js`, `orchestrator.test.js`, `runtime.test.js`). Pure layers target 100% coverage; `runtime.js` is the IO surface and is best validated end-to-end via system specs in the dummy app (cf. `bunfig.toml`).

## Conventions to respect

- `state.js` must remain side-effect-free. Anything that touches the DOM, history, fetch, or storage belongs in `runtime.js` (or a new runtime adapter).
- The reducer's command types are a contract between `state.js` and any runtime; if you add a new command, update both `BrowserRuntime` and the orchestrator dispatch and add tests on both sides.
- Drawer layers always carry a `side` (defaults to `"right"`). `state.js` enforces this — don't paper over it at the call site.
- The generator template `lib/generators/modal_stack/install/templates/initializer.rb` is excluded from RuboCop (it's ERB, not Ruby) — see `.rubocop.yml`.
- The `modal.html.erb` layout intentionally only `yield`s; per-panel wrapping is the view's job via `modal_stack_container` (so each action picks its own size/variant/dismissible).
- When changing the generator's initializer template, bump `ModalStack::INITIALIZER_VERSION` in `lib/modal_stack.rb` so existing apps see the regen warning.
