# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Dismissible flag", type: :system, js: true do
  it "ignores ESC and backdrop on a non-dismissible layer" do
    visit "/"
    click_link "Locked modal", id: "open-locked"
    expect(page).to have_modal_open

    close_modal # ESC
    expect(page).to have_modal_open # still open

    page.find("#modal-stack-root").click # backdrop click
    expect(page).to have_modal_open
  end

  it "respects ESC on a dismissible layer" do
    visit "/"
    click_link "Open modal", id: "open-modal"
    expect(page).to have_modal_open

    close_modal
    expect(page).to have_no_modal_open
  end
end
