# frozen_string_literal: true

module ModalStack
  module Helpers
    # Renders a button (or link) that steps back through the top layer's
    # path. Wired to the `modal-stack-back-link` Stimulus controller, which
    # delegates to `orchestrator.pathBack`.
    #
    #   <%= modal_back_link "Back" %>
    #   <%= modal_back_link "Back to step 1", steps: 2 %>
    #   <%= modal_back_link class: "btn btn-link" do %>
    #     <span aria-hidden="true">←</span> Back
    #   <% end %>
    module ModalBackLinkHelper
      LINK_CONTROLLER = "modal-stack-back-link"
      LINK_CLICK_ACTION = "click->modal-stack-back-link#trigger"

      def modal_back_link(name = nil, options = {}, &block) # rubocop:disable Metrics/CyclomaticComplexity
        if block
          options = name.is_a?(Hash) ? name : {}
          name = capture(&block)
        end
        options = options.dup
        steps = Integer(options.delete(:steps) || 1)
        raise ArgumentError, "steps must be a positive integer, got #{steps.inspect}" if steps < 1

        options[:data] = back_link_data(options.delete(:data) || {}, steps)
        options[:type] ||= "button"

        button_tag(name || I18n.t("modal_stack.back", default: "Back"), **options)
      end

      private

      def back_link_data(existing, steps)
        existing.merge(
          controller: merged_token(existing[:controller], LINK_CONTROLLER),
          action: merged_token(existing[:action], LINK_CLICK_ACTION),
          modal_stack_back_link_steps_value: steps
        )
      end

      def merged_token(existing, addition)
        [existing, addition].compact.join(" ").strip
      end
    end
  end
end
