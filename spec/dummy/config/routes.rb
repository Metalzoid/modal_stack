# frozen_string_literal: true

Rails.application.routes.draw do
  root "pages#index"
  get "/modal_demo",          to: "pages#modal_demo"
  get "/modal_drawer/:side",  to: "pages#modal_drawer", as: :modal_drawer
  get "/modal_bottom_sheet",  to: "pages#modal_bottom_sheet"
  get "/modal_locked",        to: "pages#modal_locked"
  get "/wizard/step_1",       to: "pages#wizard_step_1", as: :wizard_step_1
  get "/wizard/step_2",       to: "pages#wizard_step_2", as: :wizard_step_2
  post "/wizard/advance",     to: "pages#advance",       as: :wizard_advance

  # Path-based wizard (modal_path_to / modal_path_back).
  get "/path_wizard/step_a",  to: "pages#path_step_a", as: :path_wizard_step_a
  get "/path_wizard/step_b",  to: "pages#path_step_b", as: :path_wizard_step_b
  get "/path_wizard/step_c",  to: "pages#path_step_c", as: :path_wizard_step_c
  post "/path_wizard/to_b",   to: "pages#path_to_b",   as: :path_wizard_to_b
  post "/path_wizard/to_c",   to: "pages#path_to_c",   as: :path_wizard_to_c
end
