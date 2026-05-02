# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Drawer sides", type: :system, js: true do
  %i[left right top bottom].each do |side|
    it "mounts a drawer with data-side=#{side}" do
      visit "/"
      click_link "Drawer #{side}", id: "open-drawer-#{side}"

      expect(page).to have_modal_open
      expect(page).to have_css(
        %([data-modal-stack-target="layer"][data-variant="drawer"][data-side="#{side}"])
      )
    end
  end
end
