# frozen_string_literal: true

require "spec_helper"
require "action_view"
require "modal_stack/helpers/modal_back_link_helper"

RSpec.describe ModalStack::Helpers::ModalBackLinkHelper do
  let(:view) do
    Class.new(ActionView::Base) do
      include ModalStack::Helpers::ModalBackLinkHelper
    end.with_empty_template_cache.new(
      ActionView::LookupContext.new([]),
      {},
      nil
    )
  end

  it "renders a button wired to modal-stack-back-link" do
    out = view.modal_back_link("Back")
    expect(out).to include("Back")
    expect(out).to include('data-controller="modal-stack-back-link"')
    expect(out).to include("modal-stack-back-link#trigger")
    expect(out).to include('data-modal-stack-back-link-steps-value="1"')
    expect(out).to include('type="button"')
  end

  it "embeds a custom steps value" do
    out = view.modal_back_link("Back to step 1", steps: 2)
    expect(out).to include('data-modal-stack-back-link-steps-value="2"')
  end

  it "supports a block body" do
    out = view.modal_back_link(class: "btn") { "← Back".html_safe }
    expect(out).to include("← Back")
    expect(out).to include('class="btn"')
  end

  it "rejects non-positive steps" do
    expect { view.modal_back_link("Back", steps: 0) }.to raise_error(ArgumentError, /steps/)
    expect { view.modal_back_link("Back", steps: -1) }.to raise_error(ArgumentError, /steps/)
  end

  it "preserves caller-provided data attributes" do
    out = view.modal_back_link("Back", data: { tracking: "back" })
    expect(out).to include('data-tracking="back"')
    expect(out).to include('data-controller="modal-stack-back-link"')
  end
end
