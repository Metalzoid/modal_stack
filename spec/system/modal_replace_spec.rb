# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Modal replace", type: :system, js: true do
  it "morphs the top layer in place via turbo_stream.modal_replace with history: :push" do
    visit "/"
    click_link "Wizard step 1", id: "open-wizard"
    within_modal { expect(page).to have_css("#wizard-step", text: "Step 1") }
    expect(page).to have_current_path("/wizard/step_1")

    within_modal { click_button "Advance", id: "wizard-advance" }

    # Don't scope via within_modal here: morphTopLayer calls layer.replaceChildren
    # mid-test, which races with within()'s cached node reference under Cuprite
    # (NodeNotFoundError on slow CI). Asserting at page level lets Capybara's
    # built-in matcher retry against fresh DOM each tick.
    expect(page).to have_modal_stack(depth: 1) # still one layer — replaced, not pushed
    expect(page).to have_current_path("/wizard/step_2")
    expect(page).to have_css('[data-modal-stack-target="layer"] #wizard-step', text: "Step 2")
  end
end
