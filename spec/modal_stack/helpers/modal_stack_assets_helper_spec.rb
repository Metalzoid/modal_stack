# frozen_string_literal: true

require "spec_helper"
require "action_view"
require "modal_stack/helpers/modal_stack_assets_helper"

RSpec.describe ModalStack::Helpers::ModalStackAssetsHelper do
  let(:view) do
    Class.new(ActionView::Base) do
      include ModalStack::Helpers::ModalStackAssetsHelper
    end.with_empty_template_cache.new(
      ActionView::LookupContext.new([]),
      {},
      nil
    )
  end

  describe "#modal_stack_stylesheet_link_tag" do
    it "emits a link to the configured provider" do
      ModalStack.configuration.css_provider = :tailwind
      out = view.modal_stack_stylesheet_link_tag
      expect(out).to match(%r{href="[^"]*modal_stack/tailwind[^"]*\.css"})
      expect(out).to include('rel="stylesheet"')
    end

    it "switches when the provider changes" do
      ModalStack.configuration.css_provider = :bootstrap
      expect(view.modal_stack_stylesheet_link_tag).to match(%r{modal_stack/bootstrap[^"]*\.css})
      ModalStack.configuration.css_provider = :vanilla
      expect(view.modal_stack_stylesheet_link_tag).to match(%r{modal_stack/vanilla[^"]*\.css})
    end

    it "renders nothing when provider is :none" do
      ModalStack.configuration.css_provider = :none
      expect(view.modal_stack_stylesheet_link_tag.to_s).to eq("")
    end
  end

  describe "#modal_stack_dialog_tag" do
    it "emits a <dialog> with the configured id and data-controller" do
      out = view.modal_stack_dialog_tag
      expect(out).to include('id="modal-stack-root"')
      expect(out).to include('data-controller="modal-stack"')
      expect(out).to match(%r{<dialog [^>]*></dialog>})
    end

    it "honors a custom dialog_id" do
      ModalStack.configuration.dialog_id = "custom-stack"
      out = view.modal_stack_dialog_tag
      expect(out).to include('id="custom-stack"')
    end

    it "merges caller-provided data-controller" do
      out = view.modal_stack_dialog_tag(data: { controller: "tooltip", x_value: 1 })
      expect(out).to include('data-controller="tooltip modal-stack"')
      expect(out).to include('data-x-value="1"')
    end

    it "lets the caller override the id" do
      out = view.modal_stack_dialog_tag(id: "x")
      expect(out).to include('id="x"')
    end

    it "forwards max_depth + max_depth_strategy to the Stimulus controller" do
      ModalStack.configuration.max_depth = 7
      ModalStack.configuration.max_depth_strategy = :raise
      out = view.modal_stack_dialog_tag
      expect(out).to include('data-modal-stack-max-depth-value="7"')
      expect(out).to include('data-modal-stack-max-depth-strategy-value="raise"')
    end

    it "omits max-depth-value when max_depth is nil" do
      ModalStack.configuration.max_depth = nil
      out = view.modal_stack_dialog_tag
      expect(out).not_to include("max-depth-value")
      expect(out).to include('data-modal-stack-max-depth-strategy-value="warn"')
    end
  end

  describe "#modal_stack_javascript_tag" do
    it "is currently a no-op (importmap/jsbundling handle JS loading)" do
      expect(view.modal_stack_javascript_tag).to eq("")
    end
  end
end
