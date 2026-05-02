# frozen_string_literal: true

require "capybara"

module ModalStack
  # Capybara helpers for system / feature specs.
  #
  # Opt in by requiring this file and including the module in your test
  # context. For RSpec, prefer the auto-wired entrypoint:
  #
  #   # spec/spec_helper.rb (or rails_helper.rb)
  #   require "modal_stack/capybara/rspec"
  #
  module Capybara
    DIALOG_SELECTOR = "#modal-stack-root"
    LAYER_SELECTOR = '[data-modal-stack-target="layer"]:not([data-leaving])'

    # Scope Capybara matchers to a specific layer of the stack.
    #
    #   within_modal { expect(page).to have_content("Edit") }
    #   within_modal(depth: 1) { ... }   # bottom-most layer
    #   within_modal(depth: 2) { ... }   # second from the bottom
    #
    # When `depth:` is omitted the top-most layer is targeted.
    def within_modal(depth: nil, **, &)
      layers = ::Capybara.current_session.all(:css, LAYER_SELECTOR, minimum: 1, **)
      target = depth ? layers[depth - 1] : layers.last
      raise ::Capybara::ElementNotFound, "no modal_stack layer at depth #{depth}" unless target

      ::Capybara.current_session.within(target, &)
    end

    # Capybara matcher: passes when the modal_stack <dialog> is open.
    #
    #   expect(page).to have_modal_open
    def have_modal_open(**)
      have_css("#{DIALOG_SELECTOR}[open]", **)
    end

    def have_no_modal_open(**)
      have_no_css("#{DIALOG_SELECTOR}[open]", **)
    end

    # Capybara matcher: assert the live (non-leaving) layer count.
    #
    #   expect(page).to have_modal_stack(depth: 2)
    #   expect(page).to have_modal_stack            # any open layer
    def have_modal_stack(depth: nil, **)
      if depth
        have_css(LAYER_SELECTOR, count: depth, **)
      else
        have_css(LAYER_SELECTOR, **)
      end
    end

    def have_no_modal_stack(**)
      have_no_css(LAYER_SELECTOR, **)
    end

    # Send ESC to the dialog so the runtime pops the top layer (honors
    # the layer's dismissible flag — a non-dismissible layer will not
    # close).
    def close_modal
      ::Capybara.current_session.find(:css, DIALOG_SELECTOR).send_keys(:escape)
    end

    # Pop every layer by sending ESC repeatedly. Stops as soon as no
    # live layer remains, or after `max` attempts as a safety net.
    def close_all_modals(max: 16)
      session = ::Capybara.current_session
      max.times do
        break unless session.has_css?(LAYER_SELECTOR, wait: 0)

        close_modal
        session.has_no_css?(LAYER_SELECTOR, wait: 1)
      end
    end

    # Read the current stack depth from the live DOM. Useful when an
    # explicit assertion would be clearer than `have_modal_stack`.
    def modal_stack_depth
      ::Capybara.current_session.all(:css, LAYER_SELECTOR, wait: 0).size
    end
  end
end
