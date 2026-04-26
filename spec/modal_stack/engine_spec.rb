# frozen_string_literal: true

require "spec_helper"

RSpec.describe ModalStack::Engine do
  it "is a Rails engine" do
    expect(described_class.ancestors).to include(Rails::Engine)
  end

  it "wires the modal helpers into ActionView::Base" do
    expect(ActionView::Base.ancestors).to include(ModalStack::Helpers::ModalLinkHelper)
    expect(ActionView::Base.ancestors).to include(ModalStack::Helpers::ModalStackContainerHelper)
  end

  it "wires controller extensions into ActionController::Base" do
    expect(ActionController::Base.ancestors).to include(ModalStack::ControllerExtensions)
  end

  it "extends Turbo::Streams::TagBuilder with modal_push" do
    expect(Turbo::Streams::TagBuilder.instance_method(:modal_push)).to be_a(UnboundMethod)
  end

  it "registers the engine app/javascript path on the host asset pipeline" do
    if Rails.application.config.respond_to?(:assets)
      paths = Rails.application.config.assets.paths
      expect(paths.any? { |p| p.to_s.end_with?("app/javascript") }).to be(true)
    else
      skip "asset pipeline not configured in this environment"
    end
  end
end
