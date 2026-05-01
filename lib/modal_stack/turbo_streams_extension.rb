# frozen_string_literal: true

module ModalStack
  # Custom Turbo Stream actions for stack manipulation. Mixed into
  # Turbo::Streams::TagBuilder via the :turbo_streams_tag_builder load hook
  # so the standard `turbo_stream.foo(...)` form keeps working alongside.
  module TurboStreamsExtension
    HISTORY_MODES = %i[push replace].freeze

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
    def modal_push(content = nil, variant: :modal, dismissible: true, url: nil, side: nil, size: nil, width: nil, height: nil, **rendering, &block)
      template = render_template(ModalStack::TARGET_ID, content, **rendering, &block)
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
    def modal_replace(content = nil, variant: nil, dismissible: nil, url: nil, history: :replace, layer_id: nil, side: nil, size: nil, width: nil, height: nil, **rendering, &block)
      unless HISTORY_MODES.include?(history)
        raise ArgumentError, "history: must be #{HISTORY_MODES.inspect}, got #{history.inspect}"
      end

      template = render_template(ModalStack::TARGET_ID, content, **rendering, &block)
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

    private

    def modal_data(**attrs)
      attrs.compact
    end
  end
end
