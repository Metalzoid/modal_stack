# frozen_string_literal: true

require "spec_helper"
require "action_view"
require "turbo-rails"
require "modal_stack/turbo_streams_extension"

# Without booting a full Rails engine, we splice the extension in manually.
unless Turbo::Streams::TagBuilder.include?(ModalStack::TurboStreamsExtension)
  Turbo::Streams::TagBuilder.prepend(ModalStack::TurboStreamsExtension)
end

RSpec.describe ModalStack::TurboStreamsExtension do
  let(:view_context) do
    Class.new do
      attr_accessor :formats

      def initialize
        @formats = []
      end

      def render(**rendering)
        if rendering[:partial]
          %(<div class="rendered" data-partial="#{rendering[:partial]}"></div>).html_safe
        else
          "".html_safe
        end
      end

      def capture(&block)
        block.call.to_s.html_safe
      end
    end.new
  end

  let(:builder) { Turbo::Streams::TagBuilder.new(view_context) }

  describe "#modal_push" do
    it "emits action and target on the stack root" do
      out = builder.modal_push(partial: "projects/edit").to_s
      expect(out).to include('action="modal_push"')
      expect(out).to include('target="modal-stack-root"')
    end

    it "embeds the rendered template" do
      out = builder.modal_push(partial: "projects/edit").to_s
      expect(out).to include('data-partial="projects/edit"')
    end

    it "exposes variant and dismissible as data attributes" do
      out = builder.modal_push(partial: "x", variant: :drawer, dismissible: false).to_s
      expect(out).to include('data-variant="drawer"')
      expect(out).to include('data-dismissible="false"')
    end

    it "omits unset attributes" do
      out = builder.modal_push(partial: "x").to_s
      expect(out).not_to include('data-side="')
      expect(out).not_to include('data-size="')
      expect(out).not_to include('data-url="')
    end

    it "passes through drawer-specific side and size" do
      out = builder.modal_push(partial: "x", variant: :drawer, side: :right, size: :lg).to_s
      expect(out).to include('data-side="right"')
      expect(out).to include('data-size="lg"')
    end
  end

  describe "#modal_pop" do
    it "renders an action with no rendered partial" do
      out = builder.modal_pop.to_s
      expect(out).to include('action="modal_pop"')
      expect(out).to include('target="modal-stack-root"')
      expect(out).not_to include('data-partial=')
    end
  end

  describe "#modal_replace" do
    it "defaults history-mode to replace" do
      out = builder.modal_replace(partial: "x").to_s
      expect(out).to include('data-history-mode="replace"')
    end

    it "switches to push when explicit" do
      out = builder.modal_replace(partial: "x", history: :push).to_s
      expect(out).to include('data-history-mode="push"')
    end

    it "rejects unknown history modes" do
      expect { builder.modal_replace(partial: "x", history: :wat) }
        .to raise_error(ArgumentError, /history:/)
    end

    it "passes explicit layer_id" do
      out = builder.modal_replace(partial: "x", layer_id: "L1b").to_s
      expect(out).to include('data-layer-id="L1b"')
    end
  end

  describe "#modal_close_all" do
    it "emits the close-all action" do
      out = builder.modal_close_all.to_s
      expect(out).to include('action="modal_close_all"')
      expect(out).to include('target="modal-stack-root"')
    end
  end
end
