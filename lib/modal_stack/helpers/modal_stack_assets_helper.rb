# frozen_string_literal: true

module ModalStack
  module Helpers
    # Layout-level helpers for wiring modal_stack into the host app.
    module ModalStackAssetsHelper
      # Renders a <link> for the configured CSS provider:
      #
      #   <%= modal_stack_stylesheet_link_tag %>
      #
      # Returns an empty SafeBuffer when `config.css_provider = :none`,
      # so apps can call this unconditionally.
      def modal_stack_stylesheet_link_tag(**)
        provider = ModalStack.configuration.css_provider
        return ActiveSupport::SafeBuffer.new if provider == :none

        stylesheet_link_tag("modal_stack/#{provider}", **)
      end

      # Renders the singleton <dialog> root that the modal-stack Stimulus
      # controller binds to. Drop into your application layout:
      #
      #   <%= modal_stack_dialog_tag %>
      #
      def modal_stack_dialog_tag(**html_options)
        config = ModalStack.configuration
        attrs = html_options.dup
        attrs[:id] ||= config.dialog_id
        attrs[:data] = build_dialog_data(attrs[:data], config)

        content_tag(:dialog, "".html_safe, attrs)
      end

      # Merges caller-provided data attrs with the gem-managed ones (controller,
      # max-depth value/strategy). Caller data wins on key collision.
      def build_dialog_data(provided, config)
        existing = provided || {}
        controllers = [existing[:controller], config.stack_root_data_attribute].compact.join(" ").strip
        data = existing.merge(controller: controllers)
        data[:modal_stack_max_depth_value] ||= config.max_depth if config.max_depth
        data[:modal_stack_max_depth_strategy_value] ||= config.max_depth_strategy.to_s
        data
      end

      # Emits a no-op SafeBuffer for now — kept as a stable hook for apps
      # that prefer a single line in their layout. The actual JS loading
      # is handled by the host app's bundler / importmap.
      def modal_stack_javascript_tag(**)
        ActiveSupport::SafeBuffer.new
      end
    end
  end
end
