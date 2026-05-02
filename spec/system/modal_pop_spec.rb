# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Modal pop", type: :system, js: true do
  it "closes the layer when ESC is pressed on a dismissible modal" do
    visit "/"
    click_link "Open modal", id: "open-modal"
    expect(page).to have_modal_open

    close_modal

    expect(page).to have_no_modal_open
    expect(page).to have_current_path("/")
  end

  it "closes when the backdrop is clicked on a dismissible modal" do
    visit "/"
    click_link "Open modal", id: "open-modal"
    expect(page).to have_modal_open

    # Dispatch the click directly on the <dialog> so event.target === the
    # dialog (matches the runtime's backdrop check). A Capybara `.click` lands
    # on the centered panel child, which is not what a real backdrop click is.
    page.execute_script(
      "document.getElementById('modal-stack-root').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
    )
    expect(page).to have_no_modal_open
  end
end
