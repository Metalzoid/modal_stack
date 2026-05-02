# frozen_string_literal: true

require "bundler/gem_tasks"
require "rspec/core/rake_task"

RSpec::Core::RakeTask.new(:spec)

require "rubocop/rake_task"

RuboCop::RakeTask.new do |task|
  # Avoid inheriting runner-level/home RuboCop configs in CI.
  task.options = ["--config", ".rubocop.yml"]
end

task default: %i[spec rubocop]
