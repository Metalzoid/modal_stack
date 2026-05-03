# frozen_string_literal: true

require "spec_helper"

RSpec.describe ModalStack::Configuration do
  subject(:config) { described_class.new }

  describe "defaults" do
    it "starts with the tailwind preset" do
      expect(config.css_provider).to eq(:tailwind)
    end

    it "auto-detects the assets mode" do
      expect(config.assets_mode).to eq(:auto)
    end

    it "uses sensible variant/size defaults" do
      expect(config.default_variant).to eq(:modal)
      expect(config.default_size).to eq(:md)
      expect(config.default_dismissible).to be true
    end

    it "sets the dialog id and request header" do
      expect(config.dialog_id).to eq("modal-stack-root")
      expect(config.request_header).to eq("X-Modal-Stack-Request")
    end

    it "respects reduced motion by default" do
      expect(config.respect_reduced_motion).to be true
    end

    it "leaves data-turbo-confirm alone by default" do
      expect(config.replace_turbo_confirm).to be false
    end
  end

  describe "validation" do
    it "rejects unknown css_provider" do
      expect { config.css_provider = :material }
        .to raise_error(ArgumentError, /css_provider/)
    end

    it "accepts a string and coerces to symbol" do
      config.css_provider = "bootstrap"
      expect(config.css_provider).to eq(:bootstrap)
    end

    it "rejects unknown assets_mode" do
      expect { config.assets_mode = :webpack }
        .to raise_error(ArgumentError, /assets_mode/)
    end

    it "rejects unknown default_variant" do
      expect { config.default_variant = :popover }
        .to raise_error(ArgumentError, /default_variant/)
    end

    it "rejects unknown default_size" do
      expect { config.default_size = :tiny }
        .to raise_error(ArgumentError, /default_size/)
    end

    it "rejects non-boolean default_dismissible" do
      expect { config.default_dismissible = "yes" }
        .to raise_error(ArgumentError, /default_dismissible/)
      expect { config.default_dismissible = nil }
        .to raise_error(ArgumentError, /default_dismissible/)
    end

    it "accepts true/false for default_dismissible" do
      config.default_dismissible = false
      expect(config.default_dismissible).to be false
    end

    it "rejects max_depth that is not a positive integer" do
      expect { config.max_depth = 0 }.to raise_error(ArgumentError, /max_depth/)
      expect { config.max_depth = -1 }.to raise_error(ArgumentError, /max_depth/)
      expect { config.max_depth = "abc" }.to raise_error(ArgumentError, /max_depth/)
    end

    it "accepts nil for max_depth (no cap)" do
      config.max_depth = nil
      expect(config.max_depth).to be_nil
    end

    it "coerces stringy max_depth" do
      config.max_depth = "10"
      expect(config.max_depth).to eq(10)
    end

    it "defaults max_depth_strategy to :warn" do
      expect(config.max_depth_strategy).to eq(:warn)
    end

    it "rejects unknown max_depth_strategy" do
      expect { config.max_depth_strategy = :explode }
        .to raise_error(ArgumentError, /max_depth_strategy/)
    end

    it "accepts a string and coerces max_depth_strategy" do
      config.max_depth_strategy = "raise"
      expect(config.max_depth_strategy).to eq(:raise)
    end
  end

  describe "ModalStack.configure" do
    it "yields the singleton configuration" do
      ModalStack.configure do |c|
        c.css_provider = :bootstrap
        c.default_size = :lg
      end
      expect(ModalStack.configuration.css_provider).to eq(:bootstrap)
      expect(ModalStack.configuration.default_size).to eq(:lg)
    end

    it "is reset by reset_configuration!" do
      ModalStack.configuration.css_provider = :bootstrap
      ModalStack.reset_configuration!
      expect(ModalStack.configuration.css_provider).to eq(:tailwind)
    end
  end

  describe "ModalStack::InitializerVersionCheck" do
    it "warns when initializer_version is nil" do
      ModalStack.configuration.initializer_version = nil
      expect { ModalStack::InitializerVersionCheck.perform }
        .to output(/no.*initializer_version/i).to_stderr
    end

    it "warns when stamped version is older than shipped" do
      ModalStack.configuration.initializer_version = "0.0.1"
      expect { ModalStack::InitializerVersionCheck.perform }
        .to output(/0\.0\.1.*ships/i).to_stderr
    end

    it "stays silent when stamped matches shipped" do
      ModalStack.configuration.initializer_version = ModalStack::INITIALIZER_VERSION
      expect { ModalStack::InitializerVersionCheck.perform }
        .not_to output.to_stderr
    end

    it "stays silent when silenced regardless of stamp" do
      ModalStack.configuration.initializer_version = nil
      ModalStack.configuration.silence_initializer_warning = true
      expect { ModalStack::InitializerVersionCheck.perform }
        .not_to output.to_stderr
    end
  end
end
