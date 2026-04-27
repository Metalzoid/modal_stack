# frozen_string_literal: true

require "rails/engine"

module ModalStack
  class Engine < ::Rails::Engine
    config.eager_load_namespaces << ModalStack

    initializer "modal_stack.helpers" do
      ActiveSupport.on_load(:action_view) do
        require "modal_stack/helpers/modal_link_helper"
        require "modal_stack/helpers/modal_stack_container_helper"
        require "modal_stack/helpers/modal_stack_assets_helper"
        include ModalStack::Helpers::ModalLinkHelper
        include ModalStack::Helpers::ModalStackContainerHelper
        include ModalStack::Helpers::ModalStackAssetsHelper
      end
    end

    initializer "modal_stack.controller_extensions" do
      ActiveSupport.on_load(:action_controller_base) do
        require "modal_stack/controller_extensions"
        include ModalStack::ControllerExtensions
      end
    end

    initializer "modal_stack.turbo_streams" do
      ActiveSupport.on_load(:turbo_streams_tag_builder) do
        require "modal_stack/turbo_streams_extension"
        include ModalStack::TurboStreamsExtension
      end
    end

    initializer "modal_stack.assets" do |app|
      next unless app.config.respond_to?(:assets)
      app.config.assets.paths << root.join("app", "javascript").to_s
      app.config.assets.paths << root.join("app", "assets", "javascripts").to_s
      app.config.assets.paths << root.join("app", "assets", "stylesheets").to_s
    end

    config.after_initialize do
      ModalStack::InitializerVersionCheck.perform
    end
  end
end
