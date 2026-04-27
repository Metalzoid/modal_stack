# frozen_string_literal: true

require "spec_helper"
require "capybara/rspec"
require "modal_stack/capybara"

RSpec.describe ModalStack::Capybara do
  include ::Capybara::DSL
  include ModalStack::Capybara

  HTML_OPEN_TWO_LAYERS = <<~HTML
    <!doctype html>
    <html><body>
      <main>background page</main>
      <dialog id="modal-stack-root" data-controller="modal-stack" open>
        <div data-modal-stack-target="layer" data-depth="1" inert>
          <div class="modal-stack__panel">
            <h2>edit</h2>
            <p>bottom layer body</p>
          </div>
        </div>
        <div data-modal-stack-target="layer" data-depth="2">
          <div class="modal-stack__panel">
            <h2>nested</h2>
            <p>top layer body</p>
          </div>
        </div>
      </dialog>
    </body></html>
  HTML

  HTML_CLOSED = <<~HTML
    <!doctype html>
    <html><body>
      <main>only the page</main>
      <dialog id="modal-stack-root" data-controller="modal-stack"></dialog>
    </body></html>
  HTML

  HTML_LEAVING_LAYER = <<~HTML
    <!doctype html>
    <html><body>
      <dialog id="modal-stack-root" data-controller="modal-stack" open>
        <div data-modal-stack-target="layer" data-depth="1">live layer</div>
        <div data-modal-stack-target="layer" data-depth="2" data-leaving>fading out</div>
      </dialog>
    </body></html>
  HTML

  def serve(html)
    ::Capybara.app = ->(_env) { [200, { "Content-Type" => "text/html" }, [html]] }
    ::Capybara.current_driver = :rack_test
    visit "/"
  end

  describe "#have_modal_open" do
    it "matches when the dialog carries [open]" do
      serve(HTML_OPEN_TWO_LAYERS)
      expect(page).to have_modal_open
    end

    it "fails when the dialog is closed" do
      serve(HTML_CLOSED)
      expect(page).not_to have_modal_open
    end
  end

  describe "#have_modal_stack(depth:)" do
    it "matches the live layer count" do
      serve(HTML_OPEN_TWO_LAYERS)
      expect(page).to have_modal_stack(depth: 2)
    end

    it "ignores [data-leaving] layers in the count" do
      serve(HTML_LEAVING_LAYER)
      expect(page).to have_modal_stack(depth: 1)
    end

    it "matches the existence of any layer when depth is omitted" do
      serve(HTML_OPEN_TWO_LAYERS)
      expect(page).to have_modal_stack
    end

    it "fails fast when no layer is present" do
      serve(HTML_CLOSED)
      expect(page).to have_no_modal_stack
    end
  end

  describe "#within_modal" do
    it "scopes to the top layer by default" do
      serve(HTML_OPEN_TWO_LAYERS)
      within_modal do
        expect(page).to have_content("nested")
        expect(page).not_to have_content("edit")
      end
    end

    it "honors depth: to target a specific layer" do
      serve(HTML_OPEN_TWO_LAYERS)
      within_modal(depth: 1) do
        expect(page).to have_content("bottom layer body")
        expect(page).not_to have_content("top layer body")
      end
    end

    it "ignores [data-leaving] layers when picking the top" do
      serve(HTML_LEAVING_LAYER)
      within_modal do
        expect(page).to have_content("live layer")
        expect(page).not_to have_content("fading out")
      end
    end

    it "raises when depth points past the stack" do
      serve(HTML_OPEN_TWO_LAYERS)
      expect { within_modal(depth: 5) {} }
        .to raise_error(::Capybara::ElementNotFound)
    end
  end

  describe "#modal_stack_depth" do
    it "returns the live layer count" do
      serve(HTML_OPEN_TWO_LAYERS)
      expect(modal_stack_depth).to eq(2)
    end

    it "returns 0 when nothing is open" do
      serve(HTML_CLOSED)
      expect(modal_stack_depth).to eq(0)
    end
  end
end
