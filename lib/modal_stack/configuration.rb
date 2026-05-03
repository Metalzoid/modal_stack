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
    MAX_DEPTH_STRATEGIES = %i[raise warn silent].freeze

    attr_accessor :default_classes,
                  :request_header,
                  :dialog_id,
                  :stack_root_data_attribute,
                  :respect_reduced_motion,
                  :replace_turbo_confirm,
                  :i18n_scope,
                  :initializer_version,
                  :silence_initializer_warning

    attr_reader :css_provider,
                :assets_mode,
                :default_variant,
                :default_size,
                :default_dismissible,
                :max_depth,
                :max_depth_strategy

    def initialize
      @css_provider = :tailwind
      @assets_mode = :auto
      @default_variant = :modal
      @default_size = :md
      @default_dismissible = true
      @max_depth = 5
      @max_depth_strategy = :warn
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
      raise ArgumentError, "css_provider must be one of #{CSS_PROVIDERS.inspect}, got #{value.inspect}" unless CSS_PROVIDERS.include?(value)

      @css_provider = value
    end

    def assets_mode=(value)
      value = value.to_sym
      raise ArgumentError, "assets_mode must be one of #{ASSETS_MODES.inspect}, got #{value.inspect}" unless ASSETS_MODES.include?(value)

      @assets_mode = value
    end

    def default_variant=(value)
      value = value.to_sym
      raise ArgumentError, "default_variant must be one of #{VARIANTS.inspect}, got #{value.inspect}" unless VARIANTS.include?(value)

      @default_variant = value
    end

    def default_size=(value)
      value = value.to_sym
      raise ArgumentError, "default_size must be one of #{SIZES.inspect}, got #{value.inspect}" unless SIZES.include?(value)

      @default_size = value
    end

    def default_dismissible=(value)
      raise ArgumentError, "default_dismissible must be true or false, got #{value.inspect}" unless [true, false].include?(value)

      @default_dismissible = value
    end

    def max_depth=(value)
      if value.nil?
        @max_depth = nil
        return
      end

      coerced = Integer(value, exception: false)
      raise ArgumentError, "max_depth must be a positive integer or nil, got #{value.inspect}" if coerced.nil? || coerced < 1

      @max_depth = coerced
    end

    def max_depth_strategy=(value)
      value = value.to_sym
      unless MAX_DEPTH_STRATEGIES.include?(value)
        raise ArgumentError,
              "max_depth_strategy must be one of #{MAX_DEPTH_STRATEGIES.inspect}, got #{value.inspect}"
      end

      @max_depth_strategy = value
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
