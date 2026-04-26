# frozen_string_literal: true

require "spec_helper"

RSpec.describe ModalStack do
  it "has a version number" do
    expect(ModalStack::VERSION).not_to be_nil
  end

  it "exposes the dialog target id" do
    expect(ModalStack::TARGET_ID).to eq("modal-stack-root")
  end

  it "exposes the request header name" do
    expect(ModalStack::REQUEST_HEADER).to eq("X-Modal-Stack-Request")
  end
end
