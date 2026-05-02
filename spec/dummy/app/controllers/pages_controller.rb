# frozen_string_literal: true

class PagesController < ApplicationController
  modal_stack_layout except: [:index]

  def index; end
  def modal_demo; end
  def modal_drawer; end
  def modal_bottom_sheet; end
  def modal_locked; end
  def wizard_step_1; end
  def wizard_step_2; end

  def advance
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.modal_replace(
          template: "pages/wizard_step_2",
          history: :push,
          url: wizard_step_2_path
        )
      end
    end
  end
end
