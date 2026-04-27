# frozen_string_literal: true

require "modal_stack/capybara"
require "rspec/core"

RSpec.configure do |config|
  config.include ModalStack::Capybara, type: :system
  config.include ModalStack::Capybara, type: :feature
end
