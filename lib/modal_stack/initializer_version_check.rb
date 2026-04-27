# frozen_string_literal: true

module ModalStack
  module InitializerVersionCheck
    module_function

    def perform
      return if ModalStack.configuration.silence_initializer_warning

      stamped = ModalStack.configuration.initializer_version
      shipped = ModalStack::INITIALIZER_VERSION

      if stamped.nil?
        warn(
          "[modal_stack] config/initializers/modal_stack.rb has no " \
          "config.initializer_version. The initializer template shipped " \
          "with #{shipped} introduces options the older template did " \
          "not have — regenerate with `bin/rails g modal_stack:install " \
          "--skip-layout --force`. Set " \
          "`config.silence_initializer_warning = true` to silence."
        )
      elsif stamped != shipped
        warn(
          "[modal_stack] config/initializers/modal_stack.rb is stamped " \
          "for v#{stamped} but the gem ships v#{shipped}. The template " \
          "may have new options — review the diff or regenerate with " \
          "`bin/rails g modal_stack:install --skip-layout --force`. Set " \
          "`config.silence_initializer_warning = true` to silence."
        )
      end
    end
  end
end
