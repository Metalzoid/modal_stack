# frozen_string_literal: true

require "spec_helper"
require "action_view"
require "modal_stack/helpers/modal_link_helper"

RSpec.describe ModalStack::Helpers::ModalLinkHelper do
  let(:view) do
    Class.new(ActionView::Base) do
      include ModalStack::Helpers::ModalLinkHelper

      attr_accessor :request
    end.with_empty_template_cache.new(
      ActionView::LookupContext.new([]),
      {},
      nil
    )
  end

  let(:request_double) { instance_double("ActionDispatch::Request", user_agent: "Mozilla/5.0") }

  before { view.request = request_double }

  it "renders a link with modal-stack-link controller wired" do
    out = view.modal_link_to("Edit", "/projects/42/edit")
    expect(out).to include('href="/projects/42/edit"')
    expect(out).to include('data-controller="modal-stack-link"')
    expect(out).to include('data-action="click-&gt;modal-stack-link#open"')
  end

  it "preserves caller's data-controller and data-action" do
    out = view.modal_link_to(
      "Edit",
      "/x",
      data: { controller: "tooltip", action: "mouseenter->tooltip#show" }
    )
    expect(out).to include('data-controller="tooltip modal-stack-link"')
    expect(out).to include("mouseenter-&gt;tooltip#show")
    expect(out).to include("click-&gt;modal-stack-link#open")
  end

  it "extracts variant/side/size/width/height/dismissible into modal_stack_link data" do
    out = view.modal_link_to(
      "Side",
      "/x",
      as: :drawer,
      side: :right,
      size: :lg,
      width: "48rem",
      height: "70vh",
      dismissible: false
    )
    expect(out).to include('data-modal-stack-link-variant="drawer"')
    expect(out).to include('data-modal-stack-link-side="right"')
    expect(out).to include('data-modal-stack-link-size="lg"')
    expect(out).to include('data-modal-stack-link-width="48rem"')
    expect(out).to include('data-modal-stack-link-height="70vh"')
    expect(out).to include('data-modal-stack-link-dismissible="false"')
  end

  it "falls back to a plain link_to under Hotwire Native" do
    allow(request_double).to receive(:user_agent).and_return("Mozilla/5.0 Hotwire Native iOS")
    out = view.modal_link_to("Edit", "/projects/42/edit", as: :drawer)
    expect(out).to include('href="/projects/42/edit"')
    expect(out).not_to include("data-controller")
    expect(out).not_to include("modal-stack-link")
  end
end
