# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Browser history back", type: :system, js: true do
  it "pops layers one-by-one with browser back, then returns to the page" do
    visit "/"
    click_link "Open modal", id: "open-modal"
    within_modal { click_link "Push another", id: "open-nested" }
    expect(page).to have_modal_stack(depth: 2)

    page.go_back
    expect(page).to have_modal_stack(depth: 1)

    page.go_back
    expect(page).to have_no_modal_open
    expect(page).to have_current_path("/")
  end
end
