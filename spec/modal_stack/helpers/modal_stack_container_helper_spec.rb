# frozen_string_literal: true

require "spec_helper"
require "action_view"
require "modal_stack/helpers/modal_stack_container_helper"

RSpec.describe ModalStack::Helpers::ModalStackContainerHelper do
  let(:view) do
    Class.new(ActionView::Base) do
      include ModalStack::Helpers::ModalStackContainerHelper
    end.with_empty_template_cache.new(
      ActionView::LookupContext.new([]),
      {},
      nil
    )
  end

  it "wraps the block in a panel div with default classes" do
    out = view.modal_stack_container { "hello" }
    expect(out).to include("hello")
    expect(out).to include('class="modal-stack__panel modal-stack__panel--modal modal-stack__panel--size-md"')
    expect(out).to include('data-modal-stack-size="md"')
    expect(out).to include('data-modal-stack-variant="modal"')
    expect(out).to include('data-modal-stack-dismissible="true"')
  end

  it "applies size, variant, and side modifiers" do
    out = view.modal_stack_container(size: :lg, variant: :drawer, side: :right) { "x" }
    expect(out).to include("modal-stack__panel--drawer")
    expect(out).to include("modal-stack__panel--size-lg")
    expect(out).to include("modal-stack__panel--side-right")
    expect(out).to include('data-modal-stack-side="right"')
  end

  it "exposes optional width and height data attributes" do
    out = view.modal_stack_container(width: "56rem", height: "72vh") { "x" }
    expect(out).to include('data-modal-stack-width="56rem"')
    expect(out).to include('data-modal-stack-height="72vh"')
  end

  it "merges caller-supplied class and data attributes" do
    out = view.modal_stack_container(html: { class: "custom-class", data: { tracking: "edit" } }) { "x" }
    expect(out).to include("custom-class")
    expect(out).to include('data-tracking="edit"')
  end

  it "drops nil side from data attributes" do
    out = view.modal_stack_container { "x" }
    expect(out).not_to include("data-modal-stack-side=")
  end

  it "exposes the path transition as a data attribute when provided" do
    out = view.modal_stack_container(transition: :slide) { "x" }
    expect(out).to include('data-modal-stack-transition="slide"')
  end

  it "omits the transition data attribute by default" do
    out = view.modal_stack_container { "x" }
    expect(out).not_to include("data-modal-stack-transition=")
  end

  it "renders a back button when back: true is passed" do
    out = view.modal_stack_container(back: true) { "x" }
    expect(out).to include('class="modal-stack__panel-back"')
    expect(out).to include('data-action="click-&gt;modal-stack#pathBack"').or include('data-action="click->modal-stack#pathBack"')
  end

  it "does not render a back button by default" do
    out = view.modal_stack_container { "x" }
    expect(out).not_to include("modal-stack__panel-back")
  end
end
