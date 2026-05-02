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
      MODAL_OPTION_KEYS = %i[as side size width height dismissible].freeze

      def modal_link_to(name = nil, options = nil, html_options = nil, &block)
        if block_given?
          html_options = options
          options = name
          name = block
        end
        html_options = (html_options || {}).dup

        return link_to(name, options, html_options, &block) if hotwire_native_request?

        modal_options = html_options.extract!(*MODAL_OPTION_KEYS)
        html_options[:data] = build_modal_link_data(html_options[:data] || {}, modal_options)

        link_to(name, options, html_options, &block)
      end

      private

      def build_modal_link_data(existing_data, modal_options)
        existing_data.merge(
          controller: merged_token(existing_data[:controller], LINK_CONTROLLER),
          action: merged_token(existing_data[:action], LINK_CLICK_ACTION),
          **modal_link_data_attrs(modal_options)
        )
      end

      def modal_link_data_attrs(opts)
        {
          modal_stack_link_variant: opts[:as],
          modal_stack_link_side: opts[:side],
          modal_stack_link_size: opts[:size],
          modal_stack_link_width: opts[:width],
          modal_stack_link_height: opts[:height],
          modal_stack_link_dismissible: opts[:dismissible]&.to_s
        }.compact
      end

      def merged_token(existing, addition)
        [existing, addition].compact.join(" ").strip
      end

      def hotwire_native_request?
        return false unless respond_to?(:request) && request

        request.user_agent.to_s.include?("Hotwire Native")
      end
    end
  end
end
