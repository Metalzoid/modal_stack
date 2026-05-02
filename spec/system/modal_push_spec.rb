# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Modal push", type: :system, js: true do
  it "opens the dialog and pushes a single layer" do
    visit "/"
    click_link "Open modal", id: "open-modal"

    expect(page).to have_modal_open
    expect(page).to have_modal_stack(depth: 1)
    within_modal { expect(page).to have_css("#modal-title", text: "Edit thing") }
    expect(page).to have_current_path("/modal_demo")
  end

  it "stacks a second layer on top while keeping the first inert" do
    visit "/"
    click_link "Open modal", id: "open-modal"
    within_modal { click_link "Push another", id: "open-nested" }

    expect(page).to have_modal_stack(depth: 2)
    # bottom layer becomes inert when a nested layer is mounted
    expect(page).to have_css('[data-modal-stack-target="layer"][data-depth="1"][inert]')
  end
end
