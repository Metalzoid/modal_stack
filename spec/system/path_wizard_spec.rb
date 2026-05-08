# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Modal path wizard", type: :system, js: true do
  it "advances through frames with modal_path_to and steps back via the back-link helper" do
    visit "/"
    click_link "Path wizard", id: "open-path-wizard"
    expect(page).to have_modal_frames(1)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step A") }

    within_modal_frame { click_button "To B" }
    expect(page).to have_current_path("/path_wizard/step_b")
    expect(page).to have_modal_frames(2)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step B") }

    within_modal_frame { click_button "To C" }
    expect(page).to have_current_path("/path_wizard/step_c")
    expect(page).to have_modal_frames(3)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step C") }

    within_modal_frame { click_button "Back to B", id: "back-to-b" }
    expect(page).to have_modal_frames(2)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step B") }
  end

  it "steps back multiple frames at once with steps:" do
    visit "/"
    click_link "Path wizard", id: "open-path-wizard"
    within_modal_frame { click_button "To B" }
    expect(page).to have_current_path("/path_wizard/step_b")
    within_modal_frame { click_button "To C" }
    expect(page).to have_current_path("/path_wizard/step_c")
    expect(page).to have_modal_frames(3)

    within_modal_frame { click_button "All the way back", id: "back-all-the-way" }
    expect(page).to have_modal_frames(1)
    within_modal_frame { expect(page).to have_css("h2#path-step", text: "Path step A") }
  end

  it "browser back walks through frames one by one" do
    visit "/"
    click_link "Path wizard", id: "open-path-wizard"
    within_modal_frame { click_button "To B" }
    expect(page).to have_current_path("/path_wizard/step_b")
    within_modal_frame { click_button "To C" }
    expect(page).to have_current_path("/path_wizard/step_c")
    expect(page).to have_modal_frames(3)

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
    click_link "Path wizard", id: "open-path-wizard"
    within_modal_frame { click_button "To B" }
    expect(page).to have_current_path("/path_wizard/step_b")
    within_modal_frame { click_button "To C" }
    expect(page).to have_current_path("/path_wizard/step_c")
    expect(page).to have_modal_frames(3)

    close_modal
    expect(page).to have_no_modal_open
    expect(page).to have_current_path("/")
  end
end
