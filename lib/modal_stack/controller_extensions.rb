# frozen_string_literal: true

module ModalStack
  module ControllerExtensions
    extend ActiveSupport::Concern

    included do
      helper_method :modal_stack_request?, :modal_stack_config
    end

    class_methods do
      # Switch to the `modal` layout for modal_stack-originated requests,
      # fall back to the regular layout otherwise.
      #
      #   class Projects::EditController < ApplicationController
      #     modal_stack_layout
      #   end
      #
      # Accepts the same `only:` / `except:` filters as Rails' `layout`,
      # so a controller can host both a non-modal index and a set of
      # modal panel actions:
      #
      #   class ModalStack::DemosController < ApplicationController
      #     modal_stack_layout except: [:index]
      #   end
      def modal_stack_layout(fallback: nil, **conditions)
        layout(
          lambda do
            if modal_stack_request?
              "modal"
            elsif fallback.respond_to?(:call)
              fallback.call
            else
              fallback
            end
          end,
          conditions
        )
      end
    end

    # Request-scoped accessor for `ModalStack.configuration`. Memoized so
    # helpers that read several config values per render hit the global
    # singleton once instead of N times.
    def modal_stack_config
      @modal_stack_config ||= ModalStack.configuration
    end

    # True when the current request was issued by the modal_stack JS runtime
    # (signaled by the X-Modal-Stack-Request header on the fetch).
    def modal_stack_request?
      return false unless respond_to?(:request) && request

      request.headers[ModalStack::REQUEST_HEADER] == "1"
    end

    # Convenience for re-rendering inside the modal layout, e.g. after a
    # validation failure on update:
    #
    #   def update
    #     if @project.update(project_params)
    #       redirect_to @project
    #     else
    #       render_modal :edit, status: :unprocessable_entity
    #     end
    #   end
    def render_modal(template_or_options = nil, **options)
      render_args =
        if template_or_options.is_a?(Hash)
          template_or_options.merge(options)
        elsif template_or_options
          { template_or_options => true, **options }
        else
          options
        end
      render_args[:layout] = "modal" unless render_args.key?(:layout)
      render(**render_args)
    end
  end
end
