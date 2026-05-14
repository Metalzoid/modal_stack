# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Modal path wizard", type: :system, js: true do
  # Shared helper: navigate the wizard to step B (frame-depth 2).
  # Returns when the DOM confirms frame-depth 2 is active.
  def wizard_to_b
    click_link "Path wizard", id: "open-path-wizard"
    within_modal_frame { click_button "To B" }
    expect(page).to have_modal_frames(2)
  end

  # Navigate to step C and wait for the DOM to confirm frame-depth 3.
  def wizard_to_c
    within_modal_frame { click_button "To C" }
    expect(page).to have_modal_frames(3)
  end

  it "advances through frames and steps back via the back-link helper" do
    visit "/"
    wizard_to_b
    expect(page).to have_current_path("/path_wizard/step_b")
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step B") }

    wizard_to_c
    expect(page).to have_current_path("/path_wizard/step_c")
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step C") }

    within_modal_frame { click_button "Back to B", id: "back-to-b" }
    expect(page).to have_modal_frames(2)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step B") }
  end

  it "steps back multiple frames at once with steps:" do
    visit "/"
    wizard_to_b
    wizard_to_c
    expect(page).to have_current_path("/path_wizard/step_c")

    within_modal_frame { click_button "All the way back", id: "back-all-the-way" }
    expect(page).to have_modal_frames(1)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step A") }
  end

  it "browser back walks through frames one by one" do
    visit "/"
    wizard_to_b
    wizard_to_c

    page.go_back
    expect(page).to have_modal_frames(2)
    within_modal_frame { expect(page).to have_css("h2", text: "Path step B") }

    page.go_back
    expect(page).to have_modal_frames(1)
    within_modal_frame { expect(page).to have_css("h2", text: "Path step A") }

    page.go_back
    expect(page).to have_no_modal_open
    expect(page).to have_current_path("/")
  end

  it "ESC closes the whole layer at once, even mid-path" do
    visit "/"
    wizard_to_b  # being at frame-depth 2 is sufficient to prove "mid-path"

    close_modal
    expect(page).to have_no_modal_open
    expect(page).to have_current_path("/")
  end
end
