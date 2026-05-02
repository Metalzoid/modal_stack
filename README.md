# modal_stack

[![CI](https://github.com/Metalzoid/modal_stack/actions/workflows/main.yml/badge.svg)](https://github.com/Metalzoid/modal_stack/actions)

Stackable modals, drawers, and bottom sheets for Hotwire-powered Rails apps.
Push N layers, deep-link the top of the stack via native Rails URLs, get full
browser back/forward support, and drive everything from imperative Turbo
Stream actions (`modal_push`, `modal_pop`, `modal_replace`).

## Installation

Add to your Gemfile:

```ruby
gem "modal_stack"
```

Then run:

```bash
bundle install
bin/rails generate modal_stack:install
```

The generator detects your asset pipeline (importmap / jsbundling /
sprockets), wires the helpers into your application layout, and writes
`config/initializers/modal_stack.rb`.

## Usage

```erb
<%= modal_link_to "Edit", edit_project_path(@project) %>
<%= modal_link_to "Details", project_path(@project), as: :drawer, side: :right %>
```

```ruby
class ProjectsController < ApplicationController
  modal_stack_layout

  def update
    if @project.update(project_params)
      redirect_to @project
    else
      render_modal :edit, status: :unprocessable_entity
    end
  end
end
```

From a Turbo Stream:

```ruby
respond_to do |format|
  format.turbo_stream do
    render turbo_stream: turbo_stream.modal_push(template: "items/new",
                                                 variant: :drawer, side: :right)
  end
end
```

## Development

After checking out the repo, run `bin/setup` to install dependencies. Then:

```bash
bundle exec rake          # spec + rubocop
bundle exec rspec         # Ruby specs only (incl. system specs via Cuprite)
bun test                  # JS unit tests (state, orchestrator, runtime)
bin/build                 # rebuild app/assets/javascripts/modal_stack.js
```

System specs require Google Chrome locally:

```bash
brew install --cask google-chrome
```

To test against multiple Rails versions locally:

```bash
bundle exec appraisal install
BUNDLE_GEMFILE=gemfiles/rails_8_1.gemfile bundle exec rake
```

## Releasing

1. Bump `lib/modal_stack/version.rb` to the next semantic version.
2. Move `[Unreleased]` items to a new dated section in `CHANGELOG.md`.
3. Push to `main`. The release workflow will:
   - Create and push the `vX.Y.Z` annotated tag.
   - Build the gem and create a GitHub Release with auto-generated notes.
   - Publish to RubyGems via OIDC trusted publishing.

To re-release an existing version, push `vX.Y.Z` manually — the workflow
re-runs against the tag.

## License

MIT — see [LICENSE.txt](LICENSE.txt).
