# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Boot", type: :system, js: true do
  it "renders the dummy app's home page" do
    visit "/"
    expect(page).to have_css("h1", text: "Home")
    expect(page).to have_no_modal_open
  end
end
