# frozen_string_literal: true

require_relative "boot"

require "rails"
require "action_controller/railtie"
require "action_view/railtie"

begin
  require "propshaft"
rescue LoadError
  require "sprockets/railtie"
end

require "turbo-rails"
require "modal_stack"

module Dummy
  class Application < Rails::Application
    config.load_defaults Rails::VERSION::STRING.to_f
    config.eager_load = false
    config.root = File.expand_path("..", __dir__)
    config.secret_key_base = "dummy-key-for-tests"
    config.logger = Logger.new($stdout)
    config.log_level = :warn
    config.hosts.clear
    config.active_support.deprecation = :silence
    if config.respond_to?(:assets)
      config.assets.debug = false
      config.assets.quiet = true
    end
  end
end
