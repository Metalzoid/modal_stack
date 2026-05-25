# frozen_string_literal: true

module ModalStack
  module Helpers
    # Wraps the layout content in the panel structure expected by the
    # JS runtime.  The layout `modal.html.erb` typically reads:
    #
    #   <%= modal_stack_container size: :md, dismissible: true do %>
    #     <%= yield %>
    #   <% end %>
    #
    module ModalStackContainerHelper
      DEFAULT_SIZE = :md

      def modal_stack_container(size: DEFAULT_SIZE, dismissible: true, variant: :modal, side: nil, width: nil, height: nil,
                                back: false, transition: nil, html: {},
                                title: nil, close_button: nil, &)
        attrs = build_panel_attrs(size: size, variant: variant, side: side,
                                  dismissible: dismissible, width: width,
                                  height: height, transition: transition, html: html)
        body = capture(&)
        back_html = back ? modal_stack_container_back_button : nil
        show_close = close_button.nil? ? dismissible : close_button

        render partial: "modal_stack/panel", locals: {
          content: body, back_button: back_html, wrapper_attrs: attrs,
          title: title, show_close: show_close,
          size: size, variant: variant, dismissible: dismissible,
          side: side, width: width, height: height, transition: transition
        }
      end

      private

      def build_panel_attrs(size:, variant:, side:, dismissible:, width:, height:, transition:, html:)
        classes = ["modal-stack__panel", "modal-stack__panel--#{variant}", "modal-stack__panel--size-#{size}"]
        classes << "modal-stack__panel--side-#{side}" if side

        data = {
          modal_stack_size: size, modal_stack_variant: variant,
          modal_stack_dismissible: dismissible.to_s, modal_stack_side: side,
          modal_stack_width: width, modal_stack_height: height,
          modal_stack_transition: transition
        }.merge(html.fetch(:data, {})).compact

        { class: [classes, html[:class]].compact.join(" "), data: data }
          .merge(html.except(:class, :data))
      end

      # The back button stays in the DOM at all depths and is hidden by CSS
      # when the layer is on its first frame (`[data-frame-depth="1"]`).
      # That keeps the wizard structure stable across path_to/path_back —
      # no Stimulus state needed.
      def modal_stack_container_back_button
        label = (defined?(I18n) ? I18n.t("modal_stack.back", default: "Back") : "Back")
        button_tag(
          label,
          type: "button",
          class: "modal-stack__panel-back",
          data: { action: "click->modal-stack#pathBack" },
          aria: { label: label }
        )
      end
    end
  end
end
