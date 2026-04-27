# frozen_string_literal: true

module ModalStack
  # Runtime configuration for the gem. A default instance is created on
  # first access; override via `config/initializers/modal_stack.rb`:
  #
  #   ModalStack.configure do |config|
  #     config.css_provider = :bootstrap
  #     config.default_size = :lg
  #     config.replace_turbo_confirm = true
  #   end
  #
  class Configuration
    CSS_PROVIDERS = %i[tailwind bootstrap vanilla none].freeze
    ASSETS_MODES = %i[importmap jsbundling sprockets auto].freeze
    VARIANTS = %i[modal drawer bottom_sheet confirmation].freeze
    SIZES = %i[sm md lg xl].freeze

    attr_accessor :default_classes,
                  :default_dismissible,
                  :max_depth,
                  :request_header,
                  :dialog_id,
                  :stack_root_data_attribute,
                  :respect_reduced_motion,
                  :replace_turbo_confirm,
                  :i18n_scope,
                  :initializer_version,
                  :silence_initializer_warning

    attr_reader :css_provider, :assets_mode, :default_variant, :default_size

    def initialize
      @css_provider = :tailwind
      @assets_mode = :auto
      @default_variant = :modal
      @default_size = :md
      @default_dismissible = true
      @max_depth = 5
      @request_header = "X-Modal-Stack-Request"
      @dialog_id = "modal-stack-root"
      @stack_root_data_attribute = "modal-stack"
      @respect_reduced_motion = true
      @replace_turbo_confirm = false
      @i18n_scope = "modal_stack"
      @initializer_version = nil
      @silence_initializer_warning = false
      @default_classes = default_classes_hash
    end

    def css_provider=(value)
      value = value.to_sym
      unless CSS_PROVIDERS.include?(value)
        raise ArgumentError, "css_provider must be one of #{CSS_PROVIDERS.inspect}, got #{value.inspect}"
      end
      @css_provider = value
    end

    def assets_mode=(value)
      value = value.to_sym
      unless ASSETS_MODES.include?(value)
        raise ArgumentError, "assets_mode must be one of #{ASSETS_MODES.inspect}, got #{value.inspect}"
      end
      @assets_mode = value
    end

    def default_variant=(value)
      value = value.to_sym
      unless VARIANTS.include?(value)
        raise ArgumentError, "default_variant must be one of #{VARIANTS.inspect}, got #{value.inspect}"
      end
      @default_variant = value
    end

    def default_size=(value)
      value = value.to_sym
      unless SIZES.include?(value)
        raise ArgumentError, "default_size must be one of #{SIZES.inspect}, got #{value.inspect}"
      end
      @default_size = value
    end

    private

    def default_classes_hash
      {
        modal_panel: nil,
        drawer_panel: nil,
        bottom_sheet_panel: nil,
        confirmation_panel: nil
      }
    end
  end
end
