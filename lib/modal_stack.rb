# frozen_string_literal: true

require_relative "modal_stack/version"

module ModalStack
  class Error < StandardError; end

  TARGET_ID = "modal-stack-root"
  REQUEST_HEADER = "X-Modal-Stack-Request"
end

require "modal_stack/engine" if defined?(::Rails::Engine)
