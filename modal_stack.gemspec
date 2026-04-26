# frozen_string_literal: true

require_relative "lib/modal_stack/version"

Gem::Specification.new do |spec|
  spec.name = "modal_stack"
  spec.version = ModalStack::VERSION
  spec.authors = ["Florian Gagnaire"]
  spec.email = ["gagnaire.flo@gmail.com"]

  spec.summary = "Stackable modals, drawers and bottom sheets for Hotwire-powered Rails apps."
  spec.description = <<~DESC
    modal_stack adds a navigation stack on top of Hotwire: push N modals/drawers/bottom
    sheets, deep-link the top of the stack via native Rails URLs, get full browser
    history (back/forward) support, and drive everything from imperative Turbo Stream
    actions (modal_push, modal_pop, modal_replace).
  DESC
  spec.homepage = "https://github.com/Metalzoid/modal_stack"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.2.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage
  spec.metadata["changelog_uri"] = "#{spec.homepage}/blob/main/CHANGELOG.md"
  spec.metadata["bug_tracker_uri"] = "#{spec.homepage}/issues"
  spec.metadata["rubygems_mfa_required"] = "true"
  spec.metadata["allowed_push_host"] = "https://rubygems.org"

  gemspec = File.basename(__FILE__)
  spec.files = IO.popen(%w[git ls-files -z], chdir: __dir__, err: IO::NULL) do |ls|
    ls.readlines("\x0", chomp: true).reject do |f|
      (f == gemspec) ||
        f.start_with?(*%w[bin/ Gemfile .gitignore .rspec spec/ .github/ .rubocop.yml sig/ docs/ node_modules/ package.json package-lock.json vitest.config.js])
    end
  end
  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  spec.add_dependency "railties", ">= 7.2"
  spec.add_dependency "turbo-rails", ">= 2.0"
  spec.add_dependency "zeitwerk", ">= 2.6"
end
