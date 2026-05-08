# frozen_string_literal: true

module ModalStack
  # Custom Turbo Stream actions for stack manipulation. Mixed into
  # Turbo::Streams::TagBuilder via the :turbo_streams_tag_builder load hook
  # so the standard `turbo_stream.foo(...)` form keeps working alongside.
  module TurboStreamsExtension
    HISTORY_MODES = %i[push replace].freeze
    PATH_TRANSITIONS = %i[slide fade none].freeze

    # Push a new layer on top of the stack. The content is rendered using
    # the same options as Turbo's standard stream actions
    # (partial:/locals:/template:/...).
    #
    # variant:     :modal (default) | :drawer | :bottom_sheet | :confirmation
    # dismissible: true (default) | false
    # url:         override the URL associated with this layer (defaults to the request path)
    # side:        only meaningful for :drawer — :left | :right | :top | :bottom
    # size:        :sm | :md | :lg | :xl | string
    # width/height: CSS length values (e.g. "42rem", "70vh", "min(90vw, 56rem)")
    def modal_push(content = nil, variant: :modal, dismissible: true, url: nil, side: nil, size: nil, width: nil, height: nil, **rendering,
                   &)
      template = render_template(ModalStack::TARGET_ID, content, **rendering, &)
      turbo_stream_action_tag(
        :modal_push,
        target: ModalStack::TARGET_ID,
        template: template,
        data: modal_data(variant: variant, dismissible: dismissible, url: url, side: side, size: size, width: width, height: height)
      )
    end

    # Pop the top layer.
    def modal_pop
      turbo_stream_action_tag(:modal_pop, target: ModalStack::TARGET_ID)
    end

    # Replace the top layer's content. Defaults to history.replaceState
    # (no new history entry). Pass history: :push for a wizard-step semantic
    # where browser-back returns to the previous step.
    def modal_replace(content = nil, variant: nil, dismissible: nil, url: nil, history: :replace, layer_id: nil, side: nil, size: nil,
                      width: nil, height: nil, **rendering, &)
      raise ArgumentError, "history: must be #{HISTORY_MODES.inspect}, got #{history.inspect}" unless HISTORY_MODES.include?(history)

      template = render_template(ModalStack::TARGET_ID, content, **rendering, &)
      turbo_stream_action_tag(
        :modal_replace,
        target: ModalStack::TARGET_ID,
        template: template,
        data: modal_data(
          variant: variant,
          dismissible: dismissible,
          url: url,
          side: side,
          size: size,
          width: width,
          height: height,
          history_mode: history,
          layer_id: layer_id
        )
      )
    end

    # Tear down the entire stack.
    def modal_close_all
      turbo_stream_action_tag(:modal_close_all, target: ModalStack::TARGET_ID)
    end

    # Navigate forward inside the top layer's path. The current frame is
    # cached in memory so a subsequent `modal_path_back` (or browser back)
    # restores it without a network round-trip. Pass `stale: true` (or set
    # `X-Modal-Stack-Stale: true` on the response) to force a refetch on
    # back.
    def modal_path_to(content = nil, url: nil, transition: nil, stale: false, layer_id: nil, **rendering, &)
      template = render_template(ModalStack::TARGET_ID, content, **rendering, &)
      turbo_stream_action_tag(
        :modal_path_to,
        target: ModalStack::TARGET_ID,
        template: template,
        data: modal_data(
          url: url,
          transition: validate_path_transition(resolved_path_transition(transition)),
          stale: stale ? "true" : nil,
          layer_id: layer_id
        )
      )
    end

    # Step back through the top layer's path. Defaults to one frame; pass
    # `steps: N` to collapse multiple frames at once. Clamps at the first
    # frame — does not close the layer.
    def modal_path_back(steps: 1, transition: nil)
      n = Integer(steps)
      raise ArgumentError, "steps must be a positive integer, got #{steps.inspect}" if n < 1

      turbo_stream_action_tag(
        :modal_path_back,
        target: ModalStack::TARGET_ID,
        data: modal_data(
          steps: n,
          transition: validate_path_transition(resolved_path_transition(transition))
        )
      )
    end

    private

    def modal_data(**attrs)
      attrs.compact
    end

    def validate_path_transition(value)
      return nil if value.nil?

      sym = value.to_sym
      unless PATH_TRANSITIONS.include?(sym)
        raise ArgumentError, "transition must be one of #{PATH_TRANSITIONS.inspect}, got #{value.inspect}"
      end

      sym
    end

    # Falls back to the configured default when a call site doesn't
    # specify a transition. Pass `transition: :none` to disable
    # explicitly.
    def resolved_path_transition(value)
      value || ModalStack.configuration.default_path_transition
    end
  end
end
