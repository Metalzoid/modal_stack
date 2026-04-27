# frozen_string_literal: true

require "modal_stack/capybara"

# Minitest auto-include. Mirror the standard "include in
# ActionDispatch::SystemTestCase" pattern.
ActiveSupport.on_load(:action_dispatch_system_test_case) do
  include ModalStack::Capybara
end
