# frozen_string_literal: true

require "rails/generators"
require "rails/generators/base"

module ModalStack
  module Generators
    class InstallGenerator < Rails::Generators::Base
      source_root File.expand_path("templates", __dir__)

      ASSETS_MODES = ModalStack::Configuration::ASSETS_MODES.map(&:to_s).freeze
      CSS_PROVIDERS = ModalStack::Configuration::CSS_PROVIDERS.map(&:to_s).freeze

      class_option :mode, type: :string, default: "auto", enum: ASSETS_MODES,
                          desc: "JS asset strategy"
      class_option :css_provider, type: :string, default: "tailwind",
                                  enum: CSS_PROVIDERS,
                                  desc: "CSS preset bundled with the install"
      class_option :skip_layout, type: :boolean, default: false,
                                 desc: "Skip injecting helpers / dialog into application layout"
      class_option :skip_js, type: :boolean, default: false,
                             desc: "Skip JS pin / install wiring"
      class_option :skip_initializer, type: :boolean, default: false,
                                      desc: "Skip generating config/initializers/modal_stack.rb"

      def copy_initializer
        return if options[:skip_initializer]

        template "initializer.rb", "config/initializers/modal_stack.rb"
      end

      def configure_javascript
        return if options[:skip_js]

        case resolved_mode
        when "importmap" then install_importmap
        when "jsbundling" then install_jsbundling
        when "sprockets" then install_sprockets
        end
      end

      def inject_into_layout
        return if options[:skip_layout]

        layout = "app/views/layouts/application.html.erb"
        return say_status(:skip, "#{layout} not found", :yellow) unless file_exists?(layout)

        inject_stylesheet_helper(layout)
        inject_dialog_helper(layout)
      end

      def show_readme
        say <<~TXT, :green

          modal_stack installed.

          Mode:          #{resolved_mode}
          CSS provider:  #{options[:css_provider]}

          Next steps:
            1. Confirm config/initializers/modal_stack.rb matches your needs.
            2. Confirm <%= modal_stack_stylesheet_link_tag %> is in your <head>
               and <%= modal_stack_dialog_tag %> is right before </body>.
            3. Add a modal_link_to in any view:

                 <%= modal_link_to "Edit", edit_thing_path(@thing) %>

            4. Use the modal layout in the controller behind that link:

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
        return "sprockets" if file_exists?("app/assets/config/manifest.js") &&
                              !file_exists?("config/importmap.rb") &&
                              !file_exists?("package.json")
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

        target = stimulus_install_target
        if target
          inject_install_call(target)
        else
          say_status :warn, "no Stimulus app entry point found; add the install call manually", :yellow
        end
      end

      def install_jsbundling
        if file_exists?("bun.lockb") || file_exists?("bun.lock")
          run "bun add @hotwired/stimulus", abort_on_failure: false
        elsif file_exists?("yarn.lock")
          run "yarn add @hotwired/stimulus", abort_on_failure: false
        elsif file_exists?("package-lock.json")
          run "npm install @hotwired/stimulus", abort_on_failure: false
        elsif file_exists?("package.json")
          say_status :warn, "no JS lockfile detected; install @hotwired/stimulus manually", :yellow
        end

        say_status :info, "modal_stack JS bundle: app/assets/javascripts/modal_stack.js (gem-served)", :cyan
        say_status :info, "Add it to your bundler entry, or pin via importmap.", :cyan

        target = stimulus_install_target
        inject_install_call(target) if target
      end

      # Where to drop `installModalStack(application)`. The Rails 7+
      # importmap default puts the Stimulus Application instance in
      # app/javascript/controllers/application.js (and exports it from
      # there), so we prefer that. Falling back to
      # app/javascript/application.js is best-effort — older or custom
      # layouts usually wire Stimulus themselves.
      def stimulus_install_target
        candidates = [
          "app/javascript/controllers/application.js",
          "app/javascript/application.js"
        ]
        candidates.find { |path| file_exists?(path) }
      end

      def install_sprockets
        manifest = "app/assets/config/manifest.js"
        if file_exists?(manifest)
          append_unique manifest, "//= link modal_stack.js"
          append_unique manifest, "//= link modal_stack/#{options[:css_provider]}.css" unless options[:css_provider] == "none"
        else
          say_status :warn, "#{manifest} not found; add `//= link modal_stack.js` manually", :yellow
        end

        layout_inject_javascript_tag
      end

      def inject_install_call(app_js)
        content = File.read(File.join(destination_root, app_js))
        if content.include?(%(from "modal_stack")) || content.include?(%('modal_stack'))
          return say_status(:skip, "modal_stack already imported in #{app_js}", :yellow)
        end

        append_to_file app_js, <<~JS

          import { install as installModalStack } from "modal_stack"
          installModalStack(application)
        JS
      end

      def inject_stylesheet_helper(layout)
        content = File.read(File.join(destination_root, layout))
        if content.include?("modal_stack_stylesheet_link_tag")
          say_status :skip, "modal_stack_stylesheet_link_tag already in #{layout}", :yellow
        elsif content =~ %r{</head>}
          inject_into_file layout, before: %r{</head>} do
            "    <%= modal_stack_stylesheet_link_tag %>\n  "
          end
        else
          say_status :warn, "no </head> in #{layout}; insert <%= modal_stack_stylesheet_link_tag %> manually", :yellow
        end
      end

      def inject_dialog_helper(layout)
        content = File.read(File.join(destination_root, layout))
        if content.include?("modal_stack_dialog_tag") || content.include?(%(id="modal-stack-root"))
          say_status :skip, "modal_stack_dialog_tag already in #{layout}", :yellow
        elsif content =~ %r{</body>}
          inject_into_file layout, before: %r{</body>} do
            "  <%= modal_stack_dialog_tag %>\n  "
          end
        else
          say_status :warn, "no </body> in #{layout}; insert <%= modal_stack_dialog_tag %> manually", :yellow
        end
      end

      def layout_inject_javascript_tag
        return if options[:skip_layout]

        layout = "app/views/layouts/application.html.erb"
        return unless file_exists?(layout)

        content = File.read(File.join(destination_root, layout))
        return if content.include?("javascript_include_tag \"modal_stack\"") ||
                  content.include?("javascript_include_tag 'modal_stack'")

        inject_into_file layout, before: %r{</head>} do
          "    <%= javascript_include_tag \"modal_stack\" %>\n  "
        end
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
