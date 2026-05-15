# frozen_string_literal: true

require_relative "spec_helper"
require "rspec/rails"
require "capybara/rspec"
require "capybara/cuprite"
require "modal_stack/capybara/rspec"
require "rspec/retry"

abort("Rails is running in production mode!") if Rails.env.production?

Capybara.register_driver(:cuprite) do |app|
  # CI runners boot Chrome cold on the first system spec — 120s gives
  # headroom even on slow/loaded runners without masking real hangs.
  # `disable-dev-shm-usage` avoids /dev/shm exhaustion in containers.
  Capybara::Cuprite::Driver.new(
    app,
    window_size: [1280, 800],
    browser_options: {
      "no-sandbox" => nil,
      "disable-dev-shm-usage" => nil,
      "disable-gpu" => nil
    },
    headless: true,
    process_timeout: 120,
    timeout: 15
  )
end
Capybara.javascript_driver = :cuprite
Capybara.default_max_wait_time = 8
Capybara.server = :puma, { Silent: true }

RSpec.configure do |config|
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.use_transactional_fixtures = false

  config.before(:each, type: :system) { driven_by :cuprite }

  # Retry system specs up to 3 times — browser automation is inherently
  # timing-sensitive and can flake on loaded CI runners. Unit specs are
  # deterministic and should never need a retry.
  config.verbose_retry = true
  config.retry_callback = proc do |ex|
    Capybara.reset_sessions!
    ex
  end
  config.around(:each, type: :system) do |ex|
    ex.run_with_retry retry: 3
  end
end
