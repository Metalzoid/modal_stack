# frozen_string_literal: true

require "rails/generators"
require "rails/generators/base"

module ModalStack
  module Generators
    class ViewsGenerator < Rails::Generators::Base
      source_root File.expand_path("templates", __dir__)

      class_option :panel, type: :boolean, default: false,
                           desc: "Copy only the panel partial"
      class_option :dialog, type: :boolean, default: false,
                            desc: "Copy only the dialog partial"

      def copy_views
        if options[:panel]
          copy_panel
        elsif options[:dialog]
          copy_dialog
        else
          copy_panel
          copy_dialog
        end
      end

      def show_readme
        say <<~TXT, :green

          modal_stack views ejected to app/views/modal_stack/.

          Edit the copied partials to override the default HTML structure.
          The `wrapper_attrs` / `dialog_attrs` locals carry the required
          data attributes — keep them on the root element so the JS runtime
          continues to work.
        TXT
      end

      private

      def copy_panel
        copy_file "_panel.html.erb", "app/views/modal_stack/_panel.html.erb"
      end

      def copy_dialog
        copy_file "_dialog.html.erb", "app/views/modal_stack/_dialog.html.erb"
      end
    end
  end
end
