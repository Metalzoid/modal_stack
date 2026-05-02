import { Application } from "@hotwired/stimulus"
import "@hotwired/turbo-rails"
import { install as installModalStack } from "modal_stack"

const application = Application.start()
installModalStack(application)
