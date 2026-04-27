# frozen_string_literal: true

require "rails/generators"
require "rails/generators/base"

module ModalStack
  module Generators
    class InstallGenerator < Rails::Generators::Base
      source_root File.expand_path("templates", __dir__)

      ASSETS_MODES = %w[importmap jsbundling auto].freeze
      PRESETS = %w[tailwind none].freeze

      class_option :mode, type: :string, default: "auto",
                          enum: ASSETS_MODES,
                          desc: "Asset mode (auto-detects from importmap.rb / package.json by default)"
      class_option :preset, type: :string, default: "tailwind",
                            enum: PRESETS,
                            desc: "CSS preset bundled with the install"
      class_option :skip_layout, type: :boolean, default: false,
                                 desc: "Skip injecting <dialog> into application layout"
      class_option :skip_js, type: :boolean, default: false,
                             desc: "Skip JS pin / install wiring"

      def configure_javascript
        return if options[:skip_js]

        case resolved_mode
        when "importmap" then install_importmap
        when "jsbundling" then install_jsbundling
        end
      end

      def install_css_preset
        return if options[:preset] == "none"

        case options[:preset]
        when "tailwind"
          source_path = ModalStack::Engine.root.join(
            "app/assets/stylesheets/modal_stack/tailwind.css"
          )
          dest = "app/assets/stylesheets/modal_stack.css"
          if file_exists?(dest)
            say_status :skip, dest, :yellow
          else
            create_file dest, File.read(source_path)
          end
        end
      end

      def inject_dialog_into_layout
        return if options[:skip_layout]

        layout = "app/views/layouts/application.html.erb"
        unless file_exists?(layout)
          return say_status(:skip, "#{layout} not found", :yellow)
        end

        if File.read(File.join(destination_root, layout)).include?('id="modal-stack-root"')
          return say_status(:skip, "<dialog id=\"modal-stack-root\"> already present", :yellow)
        end

        inject_into_file layout, before: %r{</body>} do
          %(  <dialog id="modal-stack-root" data-controller="modal-stack"></dialog>\n  )
        end
      end

      def show_readme
        say <<~TXT, :green

          modal_stack installed.

          Mode:    #{resolved_mode}
          Preset:  #{options[:preset]}

          Next steps:
            1. Make sure <dialog id="modal-stack-root"> is rendered in your layout.
            2. Confirm install(application) is wired in your JS entrypoint.
            3. Add a modal_link_to in any view:

                 <%= modal_link_to "Edit", edit_thing_path(@thing) %>

            4. In the controller behind that link:

                 class ThingsController < ApplicationController
                   modal_stack_layout
                   def edit; ...; end
                 end

          Docs: https://github.com/Metalzoid/modal_stack
        TXT
      end

      private

      def resolved_mode
        @resolved_mode ||= detect_mode
      end

      def detect_mode
        mode = options[:mode].to_s
        return mode unless mode == "auto"
        return "importmap" if file_exists?("config/importmap.rb")
        return "jsbundling" if file_exists?("package.json")
        "importmap"
      end

      def install_importmap
        importmap = "config/importmap.rb"
        if file_exists?(importmap)
          append_unique importmap, %(pin "modal_stack", to: "modal_stack.js", preload: true)
        else
          say_status :warn, "#{importmap} not found; cannot pin modal_stack", :yellow
        end

        app_js = "app/javascript/application.js"
        if file_exists?(app_js)
          inject_install_call(app_js)
        else
          say_status :warn, "#{app_js} not found; add the install call manually", :yellow
        end
      end

      def install_jsbundling
        if file_exists?("bun.lockb") || file_exists?("bun.lock")
          run "bun add @hotwired/stimulus", abort_on_failure: false
        elsif file_exists?("yarn.lock")
          run "yarn add @hotwired/stimulus", abort_on_failure: false
        elsif file_exists?("package-lock.json")
          run "npm install @hotwired/stimulus", abort_on_failure: false
        else
          say_status :warn, "no JS lockfile detected; install @hotwired/stimulus manually", :yellow
        end

        say_status :info, "modal_stack JS source lives in app/javascript/modal_stack/.", :cyan
        say_status :info, "Either copy app/javascript/modal_stack/install.js into your bundle, or pin via importmap.", :cyan

        app_js = "app/javascript/application.js"
        inject_install_call(app_js) if file_exists?(app_js)
      end

      def inject_install_call(app_js)
        content = File.read(File.join(destination_root, app_js))
        if content.include?("modal_stack")
          return say_status(:skip, "modal_stack already imported in #{app_js}", :yellow)
        end

        append_to_file app_js, <<~JS

          import { install as installModalStack } from "modal_stack"
          installModalStack(application)
        JS
      end

      def append_unique(path, line)
        full_path = File.join(destination_root, path)
        content = File.read(full_path)
        return if content.include?(line)
        append_to_file path, "\n#{line}\n"
      end

      def file_exists?(path)
        File.exist?(File.join(destination_root, path))
      end
    end
  end
end
