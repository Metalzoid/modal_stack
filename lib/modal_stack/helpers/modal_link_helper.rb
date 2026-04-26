# frozen_string_literal: true

module ModalStack
  module Helpers
    # View helper that turns a regular link into a modal stack trigger.
    # Falls back to plain link_to when the request comes from Hotwire Native
    # (cf. RFC §15 Q3 — "don't break" policy on native shells).
    #
    #   <%= modal_link_to "Edit", edit_project_path(@project) %>
    #   <%= modal_link_to "Details", project_path(@project), as: :drawer, side: :right %>
    #
    module ModalLinkHelper
      LINK_CONTROLLER = "modal-stack-link"
      LINK_CLICK_ACTION = "click->modal-stack-link#open"

      def modal_link_to(name = nil, options = nil, html_options = nil, &block)
        html_options, options, name = options, name, block if block_given?
        html_options ||= {}
        html_options = html_options.dup

        if hotwire_native_request?
          return link_to(name, options, html_options, &block)
        end

        as = html_options.delete(:as)
        side = html_options.delete(:side)
        size = html_options.delete(:size)
        dismissible = html_options.delete(:dismissible)

        existing_data = html_options[:data] || {}
        merged_controller = [existing_data[:controller], LINK_CONTROLLER].compact.join(" ").strip
        merged_action = [existing_data[:action], LINK_CLICK_ACTION].compact.join(" ").strip

        modal_attrs = {
          modal_stack_link_variant: as,
          modal_stack_link_side: side,
          modal_stack_link_size: size,
          modal_stack_link_dismissible: dismissible.nil? ? nil : dismissible.to_s
        }.compact

        html_options[:data] = existing_data.merge(
          controller: merged_controller,
          action: merged_action,
          **modal_attrs
        )

        link_to(name, options, html_options, &block)
      end

      private

      def hotwire_native_request?
        return false unless respond_to?(:request) && request
        request.user_agent.to_s.include?("Hotwire Native")
      end
    end
  end
end
