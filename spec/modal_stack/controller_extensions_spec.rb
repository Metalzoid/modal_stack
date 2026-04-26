# frozen_string_literal: true

require "spec_helper"
require "action_controller"
require "modal_stack/controller_extensions"

RSpec.describe ModalStack::ControllerExtensions do
  let(:controller_class) do
    Class.new(ActionController::Base) do
      include ModalStack::ControllerExtensions
    end
  end
  let(:controller) { controller_class.new }

  describe "#modal_stack_request?" do
    it "is true when the X-Modal-Stack-Request header is '1'" do
      controller.request = ActionDispatch::TestRequest.create("HTTP_X_MODAL_STACK_REQUEST" => "1")
      expect(controller.modal_stack_request?).to be true
    end

    it "is false when the header is missing" do
      controller.request = ActionDispatch::TestRequest.create
      expect(controller.modal_stack_request?).to be false
    end

    it "is false when the header has another value" do
      controller.request = ActionDispatch::TestRequest.create("HTTP_X_MODAL_STACK_REQUEST" => "0")
      expect(controller.modal_stack_request?).to be false
    end
  end

  describe "#render_modal" do
    it "passes layout: 'modal' through to render" do
      args_seen = nil
      allow(controller).to receive(:render) { |**args| args_seen = args }
      controller.render_modal(:edit, status: :unprocessable_entity)
      expect(args_seen).to include(edit: true, layout: "modal", status: :unprocessable_entity)
    end

    it "preserves an explicit layout override" do
      args_seen = nil
      allow(controller).to receive(:render) { |**args| args_seen = args }
      controller.render_modal(template: "foo/bar", layout: "custom")
      expect(args_seen[:layout]).to eq("custom")
    end

    it "accepts a hash directly" do
      args_seen = nil
      allow(controller).to receive(:render) { |**args| args_seen = args }
      controller.render_modal(action: :show)
      expect(args_seen).to include(action: :show, layout: "modal")
    end
  end
end
