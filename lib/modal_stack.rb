# frozen_string_literal: true

require_relative "modal_stack/version"

module ModalStack
  class Error < StandardError; end

  # Default IDs / headers — exposed for code that needs the values
  # without instantiating Configuration.  Configuration overrides them
  # at the application level (config.dialog_id =, config.request_header =).
  TARGET_ID = "modal-stack-root"
  REQUEST_HEADER = "X-Modal-Stack-Request"

  # Bumped when config/initializers/modal_stack.rb gains/loses an option,
  # so apps that haven't regenerated their initializer get a one-line
  # boot warning.  Independent from the gem's VERSION.
  INITIALIZER_VERSION = "0.1.0"

  class << self
    def configuration
      @configuration ||= Configuration.new
    end

    def configure
      yield configuration
    end

    def reset_configuration!
      @configuration = Configuration.new
    end
  end
end

require_relative "modal_stack/configuration"
require_relative "modal_stack/initializer_version_check"
require "modal_stack/engine" if defined?(Rails::Engine)
