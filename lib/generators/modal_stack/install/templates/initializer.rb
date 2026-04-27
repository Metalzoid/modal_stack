# frozen_string_literal: true

ModalStack.configure do |config|
  # Stamps this initializer against the template version that shipped with
  # the installed gem. The boot-time check warns if you upgrade modal_stack
  # to a version with a newer template — regenerate with:
  #   bin/rails g modal_stack:install --skip-layout --skip-js --force
  # Set `config.silence_initializer_warning = true` to silence.
  config.initializer_version = "<%= ModalStack::INITIALIZER_VERSION %>"

  # CSS provider. Determines which stylesheet
  # `modal_stack_stylesheet_link_tag` resolves to.
  #
  #   :tailwind   — Tailwind-aligned tokens (default)
  #   :bootstrap  — picks up Bootstrap 5 CSS variables
  #   :vanilla    — neutral defaults, framework-free
  #   :none       — emit no <link>; provide your own CSS
  config.css_provider = :<%= options[:css_provider] %>

  # JS asset strategy used by the install generator and by the
  # `modal_stack_javascript_tag` helper.
  #   :auto        — detect from importmap.rb / package.json (default)
  #   :importmap   — pin in config/importmap.rb
  #   :jsbundling  — esbuild / bun / yarn pipeline
  #   :sprockets   — manifest-driven include
  config.assets_mode = :<%= options[:mode] %>

  # Defaults for modal_link_to / turbo_stream.modal_push when the call
  # site doesn't specify them.
  config.default_variant = :modal       # :modal / :drawer / :bottom_sheet / :confirmation
  config.default_size = :md             # :sm / :md / :lg / :xl
  config.default_dismissible = true

  # The id of the singleton <dialog> root and the data-controller name.
  # Override only if you have a name collision in your app.
  config.dialog_id = "modal-stack-root"
  config.stack_root_data_attribute = "modal-stack"

  # Header sent on JS-initiated fetches so the controller can flip its
  # layout to "modal" — read by `modal_stack_request?`.
  config.request_header = "X-Modal-Stack-Request"

  # Hard cap on stack depth (push past this is a runtime error).
  config.max_depth = 5

  # Replace `data-turbo-confirm` window.confirm with a modal_stack
  # confirmation layer (cf. RFC §15.Q7). Off by default — opt-in.
  config.replace_turbo_confirm = false

  # Honor `prefers-reduced-motion`. The Tailwind / Bootstrap / vanilla
  # presets already collapse transitions to 1ms when this OS preference
  # is set; this flag is reserved for future JS-side opt-outs.
  config.respect_reduced_motion = true

  # I18n scope for user-facing strings (close, back, swipe-down hint, …).
  config.i18n_scope = "modal_stack"
end
