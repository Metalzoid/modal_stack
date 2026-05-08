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
                                back: false, transition: nil, html: {}, &)
        classes = ["modal-stack__panel", "modal-stack__panel--#{variant}", "modal-stack__panel--size-#{size}"]
        classes << "modal-stack__panel--side-#{side}" if side

        attrs = {
          class: [classes, html[:class]].compact.join(" "),
          data: {
            modal_stack_size: size,
            modal_stack_variant: variant,
            modal_stack_dismissible: dismissible.to_s,
            modal_stack_side: side,
            modal_stack_width: width,
            modal_stack_height: height,
            modal_stack_transition: transition
          }.merge(html.fetch(:data, {})).compact
        }.merge(html.except(:class, :data))

        body = capture(&)
        body = safe_join([modal_stack_container_back_button, body]) if back

        content_tag(:div, body, **attrs)
      end

      private

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
