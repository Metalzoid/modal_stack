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

      def modal_stack_container(size: DEFAULT_SIZE, dismissible: true, variant: :modal, side: nil, width: nil, height: nil, html: {},
                                &)
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
            modal_stack_height: height
          }.merge(html.fetch(:data, {})).compact
        }.merge(html.except(:class, :data))

        content_tag(:div, capture(&), **attrs)
      end
    end
  end
end
