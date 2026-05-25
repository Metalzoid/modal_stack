<div align="center">

# 🪟 modal_stack

**Stackable modals, drawers, bottom sheets, and confirmations for Hotwire-powered Rails apps.**

Push N layers, deep-link the top of the stack via native Rails URLs, get full
browser back/forward support, and drive everything from imperative Turbo
Stream actions (`modal_push`, `modal_pop`, `modal_replace`, `modal_close_all`).

[![CI](https://github.com/Metalzoid/modal_stack/actions/workflows/main.yml/badge.svg)](https://github.com/Metalzoid/modal_stack/actions)
[![Gem Version](https://img.shields.io/gem/v/modal_stack.svg?label=gem)](https://rubygems.org/gems/modal_stack)
[![Downloads](https://img.shields.io/gem/dt/modal_stack?label=downloads)](https://rubygems.org/gems/modal_stack)
[![Ruby](https://img.shields.io/badge/ruby-%3E%3D%203.2-CC342D?logo=ruby&logoColor=white)](https://www.ruby-lang.org/)
[![Rails](https://img.shields.io/badge/rails-7.2%20%7C%208.0%20%7C%208.1-CC0000?logo=rubyonrails&logoColor=white)](https://rubyonrails.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.txt)

</div>

---

## 📖 Table of contents

- [Why modal_stack?](#-why-modal_stack)
- [Features](#-features)
- [Compatibility](#-compatibility)
- [Installation](#-installation)
- [Quick start](#-quick-start)
- [Configuration](#%EF%B8%8F-configuration)
- [Usage](#-usage)
  - [Opening a modal from a link](#opening-a-modal-from-a-link)
  - [The modal layout](#the-modal-layout)
  - [Stack-aware controllers](#stack-aware-controllers)
  - [Turbo Stream actions](#turbo-stream-actions)
  - [Variants, sizes, custom dimensions](#variants-sizes-custom-dimensions)
  - [Wizards & multi-step flows](#wizards--multi-step-flows)
  - [Stack depth & inertness](#stack-depth--inertness)
- [Reference](#-reference)
  - [`ModalStack.configure`](#modalstackconfigure)
  - [View helpers](#view-helpers)
  - [Controller extensions](#controller-extensions)
  - [Turbo Stream actions reference](#turbo-stream-actions-reference)
  - [Layer DOM contract](#layer-dom-contract)
  - [Stimulus controllers](#stimulus-controllers)
  - [JS runtime](#js-runtime)
  - [Capybara helpers](#capybara-helpers)
  - [Generator](#generator)
- [CSS presets & theming](#-css-presets--theming)
- [Asset pipelines](#-asset-pipelines)
- [Accessibility](#-accessibility)
- [Development](#-development)
- [Releasing](#-releasing)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🤔 Why modal_stack?

The Hotwire ecosystem has a few "single modal" libraries, but the moment your
app needs to open a modal **from inside** another modal — picking a customer
while creating an invoice, running a 4-step wizard inside a drawer, or
browser-`back`-ing through nested confirmation steps — they break down.

|                                              | `ultimate_turbo_modal` | DIY Stimulus | **`modal_stack`** |
| -------------------------------------------- | :--------------------: | :----------: | :---------------: |
| 1 modal + history                            |          ✅            |     ✅       |        ✅         |
| Native `<dialog>` + focus trap               |          ✅            |     ❌       |        ✅         |
| Drawers (left/right/top/bottom)              |        partial         |     ❌       |        ✅         |
| Bottom sheets                                |          ❌            |     ❌       |        ✅         |
| **Stack of N layers**                        |          ❌            |     ❌       |        ✅         |
| **Wizard step-by-step inside a layer**       |          ❌            |     ❌       |        ✅         |
| **Browser back pops one layer at a time**    |          ❌            |     ❌       |        ✅         |
| **Imperative Turbo Stream actions**          |        partial         |     ❌       |        ✅         |
| Custom width/height per layer                |          ❌            |     ❌       |        ✅         |
| `dismissible: false` (locked layers)         |          ❌            |     ❌       |        ✅         |
| Tailwind / Bootstrap / vanilla CSS presets   |          ❌            |     ❌       |        ✅         |
| Capybara matchers shipped                    |          ❌            |     ❌       |        ✅         |

---

## ✨ Features

- 🪜 **Stack of N layers** — push modals on top of modals; the underlying ones become `inert` automatically.
- 🛤️ **Path inside a layer** — `modal_path_to` / `modal_path_back` for wizards & flows: each step gets its own URL and history entry, browser-back walks frames one by one, the X button collapses the whole path in a single jump.
- 🪟 **Native `<dialog>`** — focus trap, ESC, accessible roles for free.
- 🔗 **Deep-linking** — the top of the stack lives in `window.location`. Bookmark it, share it, refresh it.
- ↩️ **Browser back = pop or step-back** — frame paths collapse to single history jumps when the layer closes.
- 🎮 **Imperative Turbo Stream actions** — `turbo_stream.modal_push / modal_pop / modal_replace / modal_close_all / modal_path_to / modal_path_back` from anywhere.
- 🎨 **Four CSS presets** — Tailwind v4, Tailwind v3, Bootstrap, vanilla. All driven by `--modal-stack-*` CSS variables for easy retheming. Frame transitions (`slide`, `fade`) are fully implemented in every preset via `@starting-style`.
- 🪞 **Four variants** — `modal`, `drawer` (left/right/top/bottom), `bottom_sheet`, `confirmation`.
- 📏 **Sizes & custom dimensions** — `:sm` / `:md` / `:lg` / `:xl`, or pass `width:` / `height:` strings (`"42rem"`, `"min(90vw, 56rem)"`).
- 🔒 **Dismissible flag** — `dismissible: false` for confirmations users must answer.
- ♿ **`prefers-reduced-motion`** — animations collapse to 1ms when the OS asks.
- 🧪 **Capybara matchers** — `within_modal`, `within_modal_frame`, `have_modal_open`, `have_modal_stack(depth: 2)`, `have_modal_frames(2)`, `close_modal`, `close_all_modals`.
- ⚡ **Three asset pipelines** — Importmap (default), jsbundling, Sprockets.
- 🧱 **Engine-based** — zero monkey-patching, pure Rails Engine + Stimulus + Turbo.

---

## 🔧 Compatibility

Tested on every combination of Ruby and Rails listed below via the
[Appraisal](https://github.com/thoughtbot/appraisal) gem:

|         | Rails 7.2 | Rails 8.0 | Rails 8.1.3 | Rails 8.1.3 + Sprockets |
| ------- | :-------: | :-------: | :---------: | :---------------------: |
| Ruby 3.2|    ✅     |    ✅     |     ✅      |           ✅            |
| Ruby 3.3|    ✅     |    ✅     |     ✅      |           ✅            |
| Ruby 3.4|    ✅     |    ✅     |     ✅      |           ✅            |
| Ruby 3.5|    ✅     |    ✅     |     ✅      |           ✅            |
| Ruby 4.0|    —      |    ✅     |     ✅      |           ✅            |

> **Requirements:** Ruby **≥ 3.2**, Rails **≥ 7.2** (`railties >= 7.2`),
> `turbo-rails >= 2.0`, Stimulus **≥ 3.0**.

---

## 📦 Installation

Add to your `Gemfile`:

```ruby
gem "modal_stack"
```

Then run:

```bash
$ bundle install
$ bin/rails g modal_stack:install
```

The generator **autodetects** your asset pipeline. You can force it:

```bash
$ bin/rails g modal_stack:install --mode=importmap   # default for new Rails apps
$ bin/rails g modal_stack:install --mode=jsbundling  # esbuild, vite, bun
$ bin/rails g modal_stack:install --mode=sprockets   # legacy apps
```

Pick the CSS preset that matches your stack:

```bash
$ bin/rails g modal_stack:install --css-provider=tailwind_v4 # default — chains on Tailwind v4 @theme tokens
$ bin/rails g modal_stack:install --css-provider=tailwind_v3 # static values aligned with Tailwind v3
$ bin/rails g modal_stack:install --css-provider=bootstrap   # picks up Bootstrap 5 vars
$ bin/rails g modal_stack:install --css-provider=vanilla     # framework-free
$ bin/rails g modal_stack:install --css-provider=none        # bring your own CSS
```

### What the generator does

- 📄 creates `config/initializers/modal_stack.rb`
- 📌 pins (Importmap) or installs (jsbundling) `@hotwired/stimulus` and `modal_stack`
- 🎨 wires the chosen CSS preset into the asset pipeline
- 💉 injects `<%= modal_stack_stylesheet_link_tag %>` and `<%= modal_stack_dialog_tag %>` into `app/views/layouts/application.html.erb`
- 🚀 appends the `installModalStack(application)` call to your Stimulus entrypoint

In your JS entrypoint (e.g. `app/javascript/controllers/application.js`):

```js
import { Application } from "@hotwired/stimulus"
import { install as installModalStack } from "modal_stack"

const application = Application.start()
installModalStack(application)
```

---

## 🚀 Quick start

```erb
<%# app/views/projects/index.html.erb %>
<%= modal_link_to "Edit", edit_project_path(@project) %>
```

```ruby
# app/controllers/projects_controller.rb
class ProjectsController < ApplicationController
  modal_stack_layout
  # ...
end
```

```erb
<%# app/views/projects/edit.html.erb %>
<%= modal_stack_container do %>
  <%= form_with model: @project do |f| %>
    <%= f.text_field :name %>
    <%= f.submit %>
  <% end %>
<% end %>
```

That's it. Click the link → the form opens in a modal, the URL updates to
`/projects/42/edit`, browser back closes the modal, refresh re-opens it
right where it was.

---

## ⚙️ Configuration

Everything lives in `config/initializers/modal_stack.rb`:

```ruby
ModalStack.configure do |config|
  # ─── Presentation ─────────────────────────────────────────────────
  config.css_provider     = :tailwind_v4 # :tailwind_v3 | :tailwind_v4 | :bootstrap | :vanilla | :none
  config.default_variant  = :modal      # :modal | :drawer | :bottom_sheet | :confirmation
  config.default_size     = :md         # :sm | :md | :lg | :xl
  config.default_dismissible = true     # ESC + backdrop click close the layer

  # ─── Behavior ─────────────────────────────────────────────────────
  config.max_depth              = 5      # hard cap on nested layers (nil to disable)
  config.max_depth_strategy     = :warn  # :warn | :raise | :silent
  config.default_path_transition = :slide # :slide | :fade | :none
  config.respect_reduced_motion = true   # honor prefers-reduced-motion
  config.replace_turbo_confirm  = false  # use modal_stack confirmations for data-turbo-confirm

  # ─── Wiring (rarely changed) ──────────────────────────────────────
  config.dialog_id                 = "modal-stack-root"
  config.stack_root_data_attribute = "modal-stack"
  config.request_header            = "X-Modal-Stack-Request"
  config.assets_mode               = :auto      # :importmap | :jsbundling | :sprockets | :auto

  # ─── i18n ─────────────────────────────────────────────────────────
  config.i18n_scope = "modal_stack"
end
```

> 💡 **`config.initializer_version`** is stamped automatically by the
> generator. When you upgrade `modal_stack`, a boot-time warning tells you if
> the installed gem ships a newer initializer template than what you have.
> Set `config.silence_initializer_warning = true` to mute it.

---

## 🎯 Usage

### Opening a modal from a link

```erb
<%= modal_link_to "Edit", edit_project_path(@project) %>
<%= modal_link_to "Details", project_path(@project), as: :drawer, side: :right %>
<%= modal_link_to "Settings", settings_path, as: :bottom_sheet %>
<%= modal_link_to "Confirm", confirm_path, dismissible: false %>
```

`modal_link_to` accepts the same arguments as Rails' `link_to`, plus:

| Option        | Type      | Description |
| ------------- | --------- | ----------- |
| `as:`         | Symbol    | Variant — `:modal` (default), `:drawer`, `:bottom_sheet`, `:confirmation` |
| `side:`       | Symbol    | Drawer side — `:left`, `:right` (default), `:top`, `:bottom` |
| `size:`       | Symbol    | `:sm`, `:md`, `:lg`, `:xl` |
| `width:`      | String    | CSS length (e.g. `"42rem"`, `"min(90vw, 56rem)"`) |
| `height:`     | String    | CSS length |
| `dismissible:`| Boolean   | When `false`, ESC and backdrop click are ignored |

> **Hotwire Native fallback:** when the request comes from a Hotwire Native
> shell (matched on User-Agent), `modal_link_to` quietly degrades to plain
> `link_to` so the platform's native navigation handles it.

### The modal layout

The gem ships a minimal `modal` layout (`app/views/layouts/modal.html.erb`)
that just `yield`s. Each panel view is responsible for wrapping itself in
`modal_stack_container`, which lets every action pick its own size/variant
options at the call site:

```erb
<%# app/views/projects/edit.html.erb %>
<%= modal_stack_container size: :lg do %>
  <h2>Edit project</h2>
  <%= render "form", project: @project %>
<% end %>
```

`modal_stack_container` accepts `size:`, `variant:`, `side:`, `width:`,
`height:`, `dismissible:`, `title:`, `close_button:`, and an `html: { class:, data:, ... }` Hash for
extra attributes on the wrapping `<div>`.

Pass `title:` to render a `<header>` with an `<h2>` above the panel content.
`close_button:` (default: inherits `dismissible:`) renders a `×` button wired to
`modal-stack#pop` — locked layers (`dismissible: false`) get no close button by default:

```erb
<%# Dismissible — title + auto close button %>
<%= modal_stack_container title: "Edit project", size: :md do %>
  <%= render "form", project: @project %>
<% end %>

<%# Locked — title only, no × (close_button: defaults to false) %>
<%= modal_stack_container title: "Are you sure?",
                           variant: :confirmation,
                           dismissible: false do %>
  <button data-action="click->modal-stack#pop">Confirm</button>
<% end %>

<%# Explicit override %>
<%= modal_stack_container title: "Info", close_button: false do %>…<% end %>
```

### Stack-aware controllers

`modal_stack_layout` switches the controller's layout to `modal` **only**
when the request was issued by the modal_stack JS runtime (signaled by the
`X-Modal-Stack-Request` header). Direct visits / refreshes still get the
regular `application` layout, so deep-links keep rendering full pages.

```ruby
class ProjectsController < ApplicationController
  modal_stack_layout                            # all actions
  modal_stack_layout except: [:index]           # the standard Rails-style filter works
  modal_stack_layout fallback: "admin"          # fallback layout for non-stack requests
end
```

`render_modal` is a shortcut for re-rendering inside the modal layout —
typically after a validation failure:

```ruby
def update
  if @project.update(project_params)
    redirect_to @project
  else
    render_modal :edit, status: :unprocessable_entity
  end
end
```

`modal_stack_request?` is exposed as both a controller method and a view
helper for branching on stack-vs-page requests.

### Turbo Stream actions

For programmatic stack manipulation from anywhere a Turbo Stream lands
(create/update/destroy, ActionCable broadcast, custom controller action):

```ruby
respond_to do |format|
  format.turbo_stream do
    render turbo_stream: turbo_stream.modal_push(
      template: "items/new",
      variant: :drawer,
      side: :right,
      size: :lg
    )
  end
end
```

Available actions:

| Action                                    | Effect |
| ----------------------------------------- | ------ |
| `turbo_stream.modal_push(content, **opts)`    | Push a new layer on top of the stack. Same content options as Turbo's standard streams (`partial:`/`template:`/`locals:`/raw block). |
| `turbo_stream.modal_pop`                      | Pop the top layer. |
| `turbo_stream.modal_replace(content, **opts)` | Morph the top layer in place. Defaults to `history: :replace`; pass `history: :push` for wizard-step semantics where browser-back returns to the previous step. |
| `turbo_stream.modal_close_all`                | Tear down the entire stack. |

### Variants, sizes, custom dimensions

Four variants:

- **`:modal`** (default) — centered overlay panel
- **`:drawer`** — slides in from a side; pass `side: :left | :right | :top | :bottom`
- **`:bottom_sheet`** — full-width sheet that slides up from the bottom (mobile-first)
- **`:confirmation`** — typically combined with `dismissible: false` for "are you sure?" flows

Sizes via the `size:` keyword pick from `:sm`, `:md`, `:lg`, `:xl`. The
preset CSS maps each to a `max-width` (and `max-height` for bottom sheets).

Need a one-off dimension? Pass `width:` and/or `height:` as CSS length
strings — they're applied as inline styles, taking precedence over `size:`:

```erb
<%= modal_link_to "Print preview", preview_path,
      width: "min(90vw, 56rem)", height: "85vh" %>
```

### Wizards & multi-step flows

For step-by-step flows inside a single layer (onboarding, multi-step forms),
use `modal_path_to` to advance and `modal_path_back` (or the
`modal_back_link` helper) to step back. The current frame's HTML is cached
in memory, so back-navigation is instant — no network round-trip — and
each forward step pushes a real history entry, so browser-back walks the
frames one by one. When the user closes the layer (X / ESC / backdrop /
`modal_pop`), every frame's history entry collapses in a single jump.

```ruby
class WizardController < ApplicationController
  modal_stack_layout

  def step_2
    respond_to do |format|
      format.html # full-page render for deep-links
      format.turbo_stream do
        render turbo_stream: turbo_stream.modal_path_to(
          template: "wizard/step_2",
          url: wizard_step_2_path
          # transition: :fade        # :slide (default from config) | :fade | :none
          # stale: true              # force a refetch when the user steps back here
        )
      end
    end
  end
end
```

```erb
<%# wizard/step_2.html.erb %>
<%= modal_stack_container(back: true) do %>
  <h2>Step 2</h2>
  <%# … form … %>

  <%= modal_back_link "Back" %>
  <%# or modal_back_link "Restart", steps: 99    # clamped at the first frame %>
<% end %>
```

`back: true` on `modal_stack_container` injects a back-button slot —
hidden by CSS at `[data-frame-depth="1"]`, visible from frame 2 onward.

To force a refresh when the user steps back to a frame (e.g. its data is
stale), either pass `stale: true` to `modal_path_to` or set the
`X-Modal-Stack-Stale: true` header on the response. The runtime will
refetch the URL instead of restoring from cache.

> **Persisting form data between steps:** form field values are *not* automatically saved — see [`modal_stack:frame-leave` / `modal_stack:frame-enter`](#persisting-form-data-across-wizard-steps) for the recommended pattern.

> ⚠️ **`replaceTop` collapses path frames.** When the top layer has a
> path and you call `turbo_stream.modal_replace`, the path is forgotten:
> the layer is morphed back to a single frame and the surplus history
> entries are walked back. Use `modal_path_back` if you want to step
> back, `modal_replace` if you want to swap the entire layer.

If you'd rather not keep a back-history (e.g. each step replaces the
previous and there's no going back), use the older `modal_replace`
mechanism with `history: :push` instead — the URL still changes per
step, but no in-memory cache is kept and `replaceTop` is the right tool.

### Stack depth & inertness

When a layer is pushed on top of another, the bottom layer automatically
gets the `inert` HTML attribute, so screen-readers and pointer/keyboard
events skip it entirely. When the top layer is popped, `inert` is removed
from what becomes the new top.

The `<dialog>` itself is opened on first push, closed on last pop. Page
scroll is locked while any layer is open (`<body data-modal-stack-locked>`)
so the page beneath doesn't scroll under your finger on touch devices.

`max_depth` (default `5`) is a hard ceiling on the number of stacked layers,
on the assumption that going past it usually means you have a state-machine
bug. The behaviour is controlled by `config.max_depth_strategy`:

| Strategy   | Behaviour                                                            |
| ---------- | -------------------------------------------------------------------- |
| `:warn`    | (default) The push is dropped and `console.warn` logs a message.     |
| `:raise`   | The JS runtime throws `ModalStackDepthError` (caught by the stream-action error boundary, see below). |
| `:silent`  | The push is dropped without logging.                                 |

Set `config.max_depth = nil` to disable the cap entirely.

---

## 📘 Reference

### `ModalStack.configure`

```ruby
ModalStack.configure { |config| ... }
ModalStack.configuration                # reader, memoized
ModalStack.reset_configuration!         # test-fixture helper
```

| Attribute                    | Type    | Default                  | Description |
| ---------------------------- | ------- | ------------------------ | ----------- |
| `css_provider`               | Symbol  | `:tailwind_v3`           | One of `:tailwind_v3`, `:tailwind_v4`, `:bootstrap`, `:vanilla`, `:none`. Determines which stylesheet `modal_stack_stylesheet_link_tag` resolves to. The legacy `:tailwind` is accepted and normalized to `:tailwind_v3`. New installs default to `:tailwind_v4`. Validated. |
| `assets_mode`                | Symbol  | `:auto`                  | One of `:importmap`, `:jsbundling`, `:sprockets`, `:auto`. Used by the generator. Validated. |
| `default_variant`            | Symbol  | `:modal`                 | `:modal`, `:drawer`, `:bottom_sheet`, or `:confirmation`. Validated. |
| `default_size`               | Symbol  | `:md`                    | `:sm`, `:md`, `:lg`, `:xl`. Validated. |
| `default_dismissible`        | Boolean | `true`                   | Default for `dismissible:` when omitted. |
| `default_classes`            | Hash    | `{ ... }`                | Hash of extra CSS class strings keyed by `:modal_panel`, `:drawer_panel`, `:bottom_sheet_panel`, `:confirmation_panel`. Useful for adding utility classes on top of the chosen preset. |
| `max_depth`                  | Integer | `5`                      | Hard cap on stack depth. Coerced from strings; set to `nil` to disable. Validated. |
| `max_depth_strategy`         | Symbol  | `:warn`                  | One of `:warn`, `:raise`, `:silent`. See [Stack depth & inertness](#stack-depth--inertness). Validated. |
| `default_path_transition`    | Symbol  | `:slide`                 | Default transition for `modal_path_to` / `modal_path_back` when no per-call `transition:` is given. One of `:slide`, `:fade`, `:none`. Validated. |
| `request_header`             | String  | `"X-Modal-Stack-Request"` | HTTP header used by the JS runtime to signal stack-originated fetches. Read by `modal_stack_request?`. |
| `dialog_id`                  | String  | `"modal-stack-root"`     | The id of the singleton `<dialog>`. Override only on name collision. |
| `stack_root_data_attribute`  | String  | `"modal-stack"`          | The Stimulus `data-controller` value attached to the `<dialog>`. |
| `respect_reduced_motion`     | Boolean | `true`                   | When the OS reports `prefers-reduced-motion: reduce`, presets collapse transitions to 1ms. |
| `replace_turbo_confirm`      | Boolean | `false`                  | When `true`, replaces `data-turbo-confirm` window.confirm with a stack-rendered confirmation layer. |
| `i18n_scope`                 | String  | `"modal_stack"`          | I18n scope for user-facing strings (close button, swipe-down hint, …). |
| `initializer_version`        | String  | `nil` (set by generator) | Stamped by the install generator; used to warn when an older template is in use after a gem upgrade. |
| `silence_initializer_warning`| Boolean | `false`                  | Mutes the boot-time warning when the stamped version differs from the gem's. |

### View helpers

Injected into `ActionView::Base` by the engine — available in every view.

| Helper                                            | Description |
| ------------------------------------------------- | ----------- |
| `modal_link_to(name, options, html_options)`      | Renders a `link_to` wired to push a layer when clicked. Accepts the modal options (`as:`, `side:`, `size:`, `width:`, `height:`, `dismissible:`) on top of standard `link_to` arguments. Falls back to plain `link_to` for Hotwire Native requests. |
| `modal_stack_container(size:, variant:, side:, width:, height:, dismissible:, back:, transition:, title:, close_button:, html: {}) { ... }` | Wraps a panel view with the markup the JS runtime expects. `back: true` injects a back-button slot wired to `modal-stack#pathBack` (hidden by CSS at the first frame); `transition:` writes `data-modal-stack-transition` for host CSS hooks. `title:` renders a `<header>` with `<h2>`; `close_button:` (default: `dismissible:` value) renders a `×` close button. |
| `modal_back_link(name = nil, **opts) { ... }`     | Renders a `<button>` wired to the `modal-stack-back-link` Stimulus controller. Pass `steps:` (default `1`) to walk back multiple frames in a single click — clamped at the first frame, never closes the layer. Block form supported for custom markup (e.g. `<%= modal_back_link(class: "btn") { "← Back" } %>`). |
| `modal_stack_stylesheet_link_tag(**options)`      | Emits `<link rel="stylesheet">` for the configured preset (`modal_stack/tailwind_v4.css`, etc.). Returns an empty SafeBuffer when `css_provider = :none`. |
| `modal_stack_dialog_tag(**html_options)`          | Emits the singleton `<dialog id="modal-stack-root" data-controller="modal-stack">`. Drop just before `</body>`. |
| `modal_stack_javascript_tag`                      | Reserved hook for layouts; currently a no-op (JS is loaded via your bundler / importmap). |

### Controller extensions

Mixed into `ActionController::Base` by the engine.

| Method                                          | Description |
| ----------------------------------------------- | ----------- |
| `modal_stack_layout(fallback: nil, **conditions)` *(class macro)* | Switches the layout to `"modal"` for stack-originated requests. `fallback:` accepts a layout name, `nil`, or a callable. `**conditions` forwards `only:` / `except:` to Rails' `layout` directive. |
| `render_modal(template_or_options = nil, **options)` | Convenience for re-rendering inside the `modal` layout — useful after validation failures. |
| `modal_stack_request?` *(also a view helper)*   | `true` when the request carries the `X-Modal-Stack-Request` header. |

### Turbo Stream actions reference

Mixed into `Turbo::Streams::TagBuilder`. All target the singleton dialog
(`ModalStack::TARGET_ID = "modal-stack-root"`) and accept the same content
options as Turbo's built-in stream actions (`partial:`, `template:`,
`locals:`, raw HTML block, …).

| Action                                                      | Options |
| ----------------------------------------------------------- | ------- |
| `modal_push(content = nil, **opts, &block)`                 | `variant:`, `dismissible:`, `url:`, `side:`, `size:`, `width:`, `height:`, plus any rendering options |
| `modal_pop`                                                 | — |
| `modal_replace(content = nil, **opts, &block)`              | All `modal_push` options plus `history:` (`:replace` *(default)* or `:push`) and `layer_id:`. **Resets the path to a single frame** when the top layer has multiple frames. |
| `modal_close_all`                                           | — |
| `modal_path_to(content = nil, **opts, &block)`              | `url:`, `transition:` (`:slide` *(default from config)* / `:fade` / `:none`), `stale:` (when true, runtime refetches on back), `layer_id:`, plus any rendering options. |
| `modal_path_back(steps: 1, transition: nil)`                | `steps:` (positive integer, clamped at the first frame), `transition:` override. |

`history: :push` raises `ArgumentError` if given any value other than
`:push` or `:replace`. Unknown transitions on `modal_path_to` /
`modal_path_back` raise `ArgumentError` as well.

> 💡 **Stale frames.** When you want a frame to refetch on back instead
> of restoring from the in-memory cache, either pass `stale: true` to
> `modal_path_to` or set the `X-Modal-Stack-Stale: true` header on the
> response. Useful when the frame's data is expected to change between
> the forward visit and the back visit (e.g. a list that the user
> mutated downstream).

### Layer DOM contract

Each pushed layer is a `<div>` inside the dialog with:

```html
<div data-modal-stack-target="layer"
     data-layer-id="ms-…"
     data-depth="2"
     data-variant="drawer"
     data-side="right"
     data-dismissible="true"
     data-frame-index="1"
     data-frame-depth="2"
     data-modal-stack-size="lg"
     data-modal-stack-width="42rem"  style="width: 42rem;">
  <div data-modal-stack-frame
       data-frame-index="1"
       data-transition="slide"
       data-direction="forward">
    <!-- panel content -->
  </div>
</div>
```

The frame wrapper sits between the layer and the panel content. It
defaults to `display: contents` so it is invisible to host CSS. When a
transition is requested, the runtime sets `[data-transition]` and
`[data-direction]` on the entering frame — the shipped presets pick
these up via `@starting-style` rules (`slide`: translate from right/left,
`fade`: opacity 0→1) and restore `overflow-y: auto` on the layer once
`transitionend` fires. `data-frame-depth="N"` on the layer reflects the
current path length — `1` for layers without a path, `N` for layers `N`
frames deep.

Underlying layers receive `inert`. A layer being unmounted gets
`data-leaving=""` for the duration of the exit transition (capped at
600ms even if the host CSS forgets to define one).

### Stimulus controllers

All three controllers are registered via `installModalStack(application)`.

| Identifier             | Role |
| ---------------------- | ---- |
| `modal-stack`          | Bound to the singleton `<dialog>`. Wires popstate / cancel / backdrop-click listeners, registers the `Turbo.StreamActions`, hosts the Orchestrator. Also exposes a public `pathBack` action — wire it on any element via `data-action="click->modal-stack#pathBack"` (with optional `data-modal-stack-steps-param="2"`). |
| `modal-stack-link`     | Attached to elements rendered by `modal_link_to`. On `click`, finds the `modal-stack` controller and calls `push({ url, variant, … })` from the element's data attributes. |
| `modal-stack-back-link`| Attached to elements rendered by `modal_back_link`. On `click`, calls `orchestrator.pathBack({ steps })` — never closes the layer; clamps at the first frame. |

### JS runtime

The package exports a small functional core + a browser adapter:

```js
import {
  // pure reducer — no IO, no DOM
  createStack, push, pop, replaceTop, closeAll, handlePopstate,
  pathTo, pathBack,
  snapshot, restore, topLayer, VARIANTS, TRANSITIONS,
  ModalStackDepthError,

  // orchestrator + browser runtime
  Orchestrator, BrowserRuntime,
  FRAGMENT_HEADER, STALE_HEADER, SNAPSHOT_KEY, SCROLLBAR_WIDTH_VAR,
} from "modal_stack"

import { install } from "modal_stack/install"
```

`install(application)` registers both Stimulus controllers — that's the
entry point your `application.js` calls. The reducer is
side-effect-free and 100% covered; the browser adapter is the only
file that touches `<dialog>`, `history`, `fetch`, and `sessionStorage`.

The reducer's command type vocabulary (`mountLayer`, `morphTopLayer`,
`unmountTopLayer`, `unmountAllLayers`, `mountFrame`, `unmountFrame`,
`clearFrameCache`, `showDialog`, `closeDialog`, `lockScroll`,
`unlockScroll`, `inertLayer`, `pushHistory`, `replaceHistory`,
`historyBack`, `rebuildFromSnapshot`, `persistSnapshot`, `clearSnapshot`)
forms the contract between `state.js` and any runtime — swap in a
custom adapter (e.g. for Hotwire Native) by implementing one method
per command name.

#### Custom events

The `<dialog>` emits `CustomEvent`s that bubble to `document`:

| Event                       | `detail`                                            | Fired when |
| --------------------------- | --------------------------------------------------- | ---------- |
| `modal_stack:ready`         | `{ stackId }`                                       | The Stimulus controller has connected and the orchestrator is ready. |
| `modal_stack:error`         | `{ action, error }`                                 | A Turbo Stream action threw or rejected. The page is not crashed; surface UI feedback in the listener. |
| `modal_stack:frame-leave`   | `{ layerId, frameIndex, direction }`                | A path frame is about to be swapped out (user going forward or back). Fired while the leaving frame is still in the DOM — listeners can read current form field values. |
| `modal_stack:frame-enter`   | `{ layerId, frameIndex, direction }`                | A path frame has been mounted (user arrived at a step, restored from cache, or restored after page reload). Fired after the new frame is in the DOM — listeners can populate form fields. `direction` is `"forward"` or `"back"`. |

```js
document.addEventListener("modal_stack:error", (event) => {
  const { action, error } = event.detail;
  showFlash(`Modal action ${action} failed: ${error.message}`);
});
```

##### Persisting form data across wizard steps

Form field values typed by the user are **not** automatically preserved by modal_stack — that is the responsibility of the host application. Use `modal_stack:frame-leave` and `modal_stack:frame-enter` to save and restore data.

Example with a Stimulus controller added to each wizard step view:

```js
// app/javascript/controllers/wizard_step_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { key: String }

  connect() {
    // Listen on the dialog so events from any nested frame reach us.
    this._leave = (e) => {
      if (this.#isMyFrame(e)) this.#save()
    }
    this._enter = (e) => {
      if (this.#isMyFrame(e)) this.#restore()
    }
    document.addEventListener("modal_stack:frame-leave", this._leave)
    document.addEventListener("modal_stack:frame-enter", this._enter)
  }

  disconnect() {
    document.removeEventListener("modal_stack:frame-leave", this._leave)
    document.removeEventListener("modal_stack:frame-enter", this._enter)
  }

  #isMyFrame(event) {
    // The controller's element lives inside the frame — check ancestry.
    return event.target.contains(this.element)
  }

  #save() {
    const data = {}
    for (const el of this.element.querySelectorAll("input, textarea, select")) {
      if (el.name) data[el.name] = el.value
    }
    sessionStorage.setItem(this.keyValue, JSON.stringify(data))
  }

  #restore() {
    const raw = sessionStorage.getItem(this.keyValue)
    if (!raw) return
    const data = JSON.parse(raw)
    for (const [name, value] of Object.entries(data)) {
      const el = this.element.querySelector(`[name="${name}"]`)
      if (el) el.value = value
    }
  }
}
```

Then attach it to the step partial:

```erb
<%# app/views/wizard/_step1.html.erb %>
<div data-controller="wizard-step" data-wizard-step-key-value="wizard-step-1">
  <%# form fields … %>
</div>
```

> **Why not auto-persist?** The gem cannot know the shape of your data, applicable validations, or where you want it stored (session, server-side draft, etc.). Keeping this boundary explicit also means you can encrypt, debounce, or sync to a server-side draft without fighting the gem.

#### Scrollbar-width compensation

When the first layer is pushed, `BrowserRuntime#lockScroll` measures
`window.innerWidth - documentElement.clientWidth` and writes the result
to `--modal-stack-scrollbar-width` on `<html>`. The shipped CSS presets
already consume the variable (`padding-right: var(--modal-stack-scrollbar-width, 0)`)
so fixed elements don't jump rightward on lock. If you maintain custom
CSS, compose your fixed-position rules against the same variable.

### Capybara helpers

For system specs, opt in by requiring the RSpec entrypoint:

```ruby
# spec/rails_helper.rb
require "modal_stack/capybara/rspec"
```

This auto-includes the matchers in `type: :system` and `type: :feature`
specs. For Minitest, `require "modal_stack/capybara/minitest"`.

| Helper / matcher                  | Description |
| --------------------------------- | ----------- |
| `within_modal(depth: nil) { ... }`| Scopes Capybara matchers to a layer. Defaults to the topmost; `depth: 1` is the bottom. Raises `Capybara::ElementNotFound` when no such layer exists. |
| `within_modal_frame(depth: nil) { ... }` | Scopes Capybara matchers to the **current** frame inside a layer (the one that's not animating out). Useful when a path is in flight. |
| `have_modal_open`                 | Matcher: passes when the dialog has `[open]`. |
| `have_no_modal_open`              | Negation. |
| `have_modal_stack(depth: nil)`    | Matcher: asserts the live (non-leaving) layer count. |
| `have_no_modal_stack`             | Negation. |
| `have_modal_frames(count)`        | Matcher: asserts the top layer's path has `count` frames. Layers without a path read as `1`. |
| `close_modal`                     | Sends `ESC` to the dialog. Honors `dismissible: false` (the layer stays). |
| `close_all_modals(max: 16)`       | Pops every layer by sending `ESC` repeatedly. |
| `modal_stack_depth`               | Reads the current depth from the live DOM. |

### Generator

```bash
$ bin/rails g modal_stack:install [flags]
```

| Flag                  | Type    | Default     | Values |
| --------------------- | ------- | ----------- | ------ |
| `--mode`              | String  | `auto`      | `auto`, `importmap`, `jsbundling`, `sprockets` |
| `--css-provider`      | String  | `tailwind_v4` | `tailwind_v3`, `tailwind_v4`, `bootstrap`, `vanilla`, `none` (legacy `tailwind` accepted, normalized to `tailwind_v3`) |
| `--skip-layout`       | Boolean | `false`     | When set, doesn't inject the stylesheet/dialog helpers into `application.html.erb` |
| `--skip-js`           | Boolean | `false`     | When set, skips the Importmap pin / package install / Stimulus install wiring |
| `--skip-initializer`  | Boolean | `false`     | When set, doesn't generate `config/initializers/modal_stack.rb` |

`--mode=auto` detection order:

1. `config/importmap.rb` present → `importmap`
2. Sprockets manifest present and no `config/importmap.rb` and no `package.json` → `sprockets`
3. `package.json` present → `jsbundling`
4. fallback → `importmap`

All append operations are idempotent — running the generator twice is
safe.

---

## 🎨 CSS presets & theming

Four opinionated stylesheets ship with the gem. Pick one with
`config.css_provider`:

| Preset          | File                                                  | Best for |
| --------------- | ----------------------------------------------------- | -------- |
| `:tailwind_v4`  | `app/assets/stylesheets/modal_stack/tailwind_v4.css`  | Tailwind v4 apps — chains on `@theme` tokens (`--color-*`, `--radius-*`, `--shadow-*`, `--container-*`) so the modal picks up your theme automatically. Falls back to Tailwind defaults when `@theme` isn't redefined. |
| `:tailwind_v3`  | `app/assets/stylesheets/modal_stack/tailwind_v3.css`  | Tailwind v3 apps — static values aligned with Tailwind v3 defaults (v3 doesn't expose tokens as CSS variables). Legacy `:tailwind` is accepted as an alias. |
| `:bootstrap`    | `app/assets/stylesheets/modal_stack/bootstrap.css`    | Picks up Bootstrap 5 CSS variables |
| `:vanilla`      | `app/assets/stylesheets/modal_stack/vanilla.css`      | Framework-free, neutral defaults |
| `:none`         | —                                                     | Bring your own CSS |

All four presets share the following capabilities:

- **Frame transitions** — `slide` (horizontal translate via `@starting-style`) and `fade` (opacity) are both fully implemented. The entering frame animates in; the layer clips off-screen frames with `overflow: hidden` for the duration, then restores `overflow-y: auto`.
- **All four drawer sides** — `left`, `right`, `top`, `bottom` with matching entry/exit animations.
- **Mobile scroll containment** — `overscroll-behavior: contain` prevents scroll chaining when modal content reaches its boundary.
- **Safe-area inset** — `bottom_sheet` and `drawer[data-side="bottom"]` apply `env(safe-area-inset-bottom)` padding.
- **Keyboard focus ring** — `.modal-stack__panel-back` has a `:focus-visible` outline.
- **Reduced-motion** — frame transition durations collapse to `1ms` alongside layer transitions.

All presets are driven by the same `--modal-stack-*` CSS variables.
Override on `:root` to retheme without touching the gem:

```css
:root {
  --modal-stack-radius: 16px;
  --modal-stack-bg: #18181b;
  --modal-stack-fg: #f4f4f5;
  --modal-stack-shadow: 0 24px 60px -16px rgba(0, 0, 0, 0.6);
  --modal-stack-backdrop: rgba(0, 0, 0, 0.7);
  --modal-stack-duration: 180ms;
}
```

Variants and sizes are addressed via data attributes on the panel:
`[data-variant="drawer"][data-side="right"]`,
`[data-modal-stack-size="lg"]`, etc.

---

## ⚡ Asset pipelines

`modal_stack` adapts to whichever pipeline you use — the generator picks
the right setup automatically.

```
┌─ Importmap (Rails 7+ default) ───────────────────────────────────────┐
│   config/importmap.rb                                                │
│     pin "modal_stack", to: "modal_stack.js"                          │
│   app/javascript/controllers/application.js                          │
│     import { install } from "modal_stack"                            │
│     install(application)                                             │
└──────────────────────────────────────────────────────────────────────┘

┌─ jsbundling (esbuild / vite / bun) ──────────────────────────────────┐
│   package.json  →  "@hotwired/stimulus": "^3"                        │
│   app/javascript/controllers/application.js                          │
│     import { install } from "modal_stack"                            │
│     install(application)                                             │
└──────────────────────────────────────────────────────────────────────┘

┌─ Sprockets (legacy) ─────────────────────────────────────────────────┐
│   app/assets/config/manifest.js                                      │
│     //= link modal_stack.js                                          │
│     //= link modal_stack/<provider>.css                              │
└──────────────────────────────────────────────────────────────────────┘
```

The Importmap-friendly bundle is pre-built and committed at
`app/assets/javascripts/modal_stack.js` (Stimulus + Turbo are externals,
provided by the host app).

---

## ♿ Accessibility

- **Native `<dialog>`** — modern browsers handle focus trap, ESC, and `aria-modal` for free.
- **Inertness** — underlying layers in a stack receive `inert`, so screen-readers and keyboard navigation skip them.
- **Reduced motion** — when `prefers-reduced-motion: reduce` is set, presets collapse all transitions (layer and frame) to 1 ms.
- **Focus restoration** — when a layer is popped, focus returns to the trigger element (per `<dialog>` semantics).
- **Back-button focus ring** — `.modal-stack__panel-back` renders a `:focus-visible` outline on keyboard focus in every preset.
- **Body scroll lock** — `<body data-modal-stack-locked>` prevents background scroll while the dialog is open; `overscroll-behavior: contain` on layers additionally blocks scroll chaining (pull-to-refresh, iOS bounce) when modal content is scrolled to its boundary.
- **Safe-area padding** — `bottom_sheet` and bottom drawers apply `env(safe-area-inset-bottom)` so content is never hidden under the iOS home indicator.

---

## 🧪 Development

```bash
$ git clone https://github.com/Metalzoid/modal_stack.git
$ cd modal_stack
$ bin/setup
$ bundle exec rake          # rspec + rubocop
$ bundle exec rspec         # Ruby specs (incl. system specs via Cuprite)
$ bun test                  # JS unit tests (state, orchestrator, runtime)
$ bin/build                 # rebuild app/assets/javascripts/modal_stack.js
```

System specs require Google Chrome locally:

```bash
$ brew install --cask google-chrome
```

Test against a specific Rails version:

```bash
$ bundle exec appraisal install
$ BUNDLE_GEMFILE=gemfiles/rails_7_2.gemfile bundle exec rake
$ BUNDLE_GEMFILE=gemfiles/rails_8_1_sprockets.gemfile bundle exec rake
```

### Repo layout

```
modal_stack/
├── app/
│   ├── assets/
│   │   ├── javascripts/modal_stack.js  # pre-built importmap bundle (committed)
│   │   └── stylesheets/modal_stack/    # tailwind_v3 / tailwind_v4 / bootstrap / vanilla presets
│   ├── javascript/modal_stack/         # ES module sources + bun tests
│   │   ├── state.js                    # pure reducer (100% coverage)
│   │   ├── orchestrator.js             # state → command translator
│   │   ├── runtime.js                  # BrowserRuntime IO adapter
│   │   ├── install.js                  # Stimulus install hook
│   │   └── controllers/                # Stimulus controllers
│   └── views/layouts/modal.html.erb
├── lib/
│   ├── modal_stack.rb                  # entry point + Engine
│   ├── modal_stack/
│   │   ├── configuration.rb
│   │   ├── controller_extensions.rb
│   │   ├── turbo_streams_extension.rb
│   │   ├── helpers/                    # ActionView helpers
│   │   └── capybara{.rb,/rspec.rb,/minitest.rb}
│   └── generators/modal_stack/install/
├── spec/
│   ├── dummy/                          # minimal Rails app for system specs
│   └── system/                         # Capybara + Cuprite suite
├── Appraisals                          # Rails 7.2 → 8.1 (+sprockets) variants
└── gemfiles/                           # per-version gemfiles (generated)
```

---

## 🚀 Releasing

1. Bump `lib/modal_stack/version.rb` to the next semantic version.
2. Move `[Unreleased]` items to a new dated section in `CHANGELOG.md`.
3. Push to `main`. The release workflow will:
   - create and push the `vX.Y.Z` annotated tag,
   - build the gem and create a GitHub Release with auto-generated notes,
   - publish to RubyGems via OIDC trusted publishing.

To re-release an existing version, push the tag manually:

```bash
$ git tag -a v0.2.0 -m "Release v0.2.0" && git push origin v0.2.0
```

---

## 🤝 Contributing

Bug reports and pull requests welcome on GitHub at
<https://github.com/Metalzoid/modal_stack>.

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Make sure the full default task passes (`bundle exec rake`) and JS tests are green (`bun test`)
4. If you touched `app/javascript/`, rebuild the importmap bundle (`bin/build`) and commit the result
5. Push (`git push origin my-new-feature`)
6. Open a Pull Request

CI runs the full Ruby matrix (Ruby 3.2-4.0 × Rails 7.2-8.1) plus the JS
suite, the build smoke test, and a bundle-freshness check that catches
PRs that edited the JS source without rebuilding the bundle.

---

## 📜 License

Released under the [MIT License](LICENSE.txt).

<div align="center">

Built with 🪟 by [Metalzoid](https://github.com/Metalzoid)

</div>
