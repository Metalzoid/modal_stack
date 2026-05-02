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
end
