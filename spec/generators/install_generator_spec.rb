# frozen_string_literal: true

require "spec_helper"
require "fileutils"
require "rails/generators"
require "generators/modal_stack/install/install_generator"

RSpec.describe ModalStack::Generators::InstallGenerator do
  let(:tmp_root) { File.expand_path("../tmp/install_generator", __dir__) }

  before do
    FileUtils.rm_rf(tmp_root)
    FileUtils.mkdir_p(tmp_root)
  end

  after { FileUtils.rm_rf(tmp_root) }

  def write_file(path, content = "")
    full = File.join(tmp_root, path)
    FileUtils.mkdir_p(File.dirname(full))
    File.write(full, content)
  end

  def read_file(path)
    File.read(File.join(tmp_root, path))
  end

  def file_exists?(path)
    File.exist?(File.join(tmp_root, path))
  end

  def run_generator(args = [])
    capture_output do
      described_class.start(args, destination_root: tmp_root)
    end
  end

  def capture_output(&block)
    original_stdout = $stdout
    original_stderr = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new
    block.call
    "#{$stdout.string}#{$stderr.string}"
  ensure
    $stdout = original_stdout
    $stderr = original_stderr
  end

  context "with an importmap-based app" do
    before do
      write_file("config/importmap.rb", %(pin "application", preload: true\n))
      write_file("app/javascript/application.js", %(import { Application } from "@hotwired/stimulus"\nconst application = Application.start()\n))
      write_file("app/views/layouts/application.html.erb", <<~HTML)
        <!DOCTYPE html>
        <html>
          <head><title>App</title></head>
          <body>
            <%= yield %>
          </body>
        </html>
      HTML
    end

    it "pins modal_stack in importmap.rb" do
      run_generator
      expect(read_file("config/importmap.rb")).to include('pin "modal_stack", to: "modal_stack.js"')
    end

    it "appends the install call in application.js" do
      run_generator
      expect(read_file("app/javascript/application.js")).to include('import { install as installModalStack } from "modal_stack"')
      expect(read_file("app/javascript/application.js")).to include("installModalStack(application)")
    end

    it "injects the <dialog> root before </body>" do
      run_generator
      layout = read_file("app/views/layouts/application.html.erb")
      expect(layout).to match(%r{<dialog id="modal-stack-root" data-controller="modal-stack"></dialog>\s*</body>})
    end

    it "copies the tailwind preset CSS" do
      run_generator
      expect(file_exists?("app/assets/stylesheets/modal_stack.css")).to be true
      content = read_file("app/assets/stylesheets/modal_stack.css")
      expect(content).to include("modal_stack — Tailwind preset")
      expect(content).to include("--modal-stack-duration")
    end

    it "is idempotent" do
      run_generator
      run_generator

      pins = read_file("config/importmap.rb").scan(/pin "modal_stack"/).size
      expect(pins).to eq(1)

      imports = read_file("app/javascript/application.js").scan(/from "modal_stack"/).size
      expect(imports).to eq(1)

      dialogs = read_file("app/views/layouts/application.html.erb").scan(/modal-stack-root/).size
      expect(dialogs).to eq(1)
    end

    it "skips layout injection with --skip-layout" do
      run_generator(["--skip-layout"])
      layout = read_file("app/views/layouts/application.html.erb")
      expect(layout).not_to include("modal-stack-root")
    end

    it "skips JS wiring with --skip-js" do
      run_generator(["--skip-js"])
      expect(read_file("config/importmap.rb")).not_to include('pin "modal_stack"')
      expect(read_file("app/javascript/application.js")).not_to include("installModalStack")
    end

    it "does not copy CSS when --preset=none" do
      run_generator(["--preset", "none"])
      expect(file_exists?("app/assets/stylesheets/modal_stack.css")).to be false
    end
  end

  context "with a jsbundling app (no importmap)" do
    before do
      write_file("package.json", %({"name":"app","scripts":{}}))
      write_file("app/javascript/application.js", %(const application = Application.start()\n))
      write_file("app/views/layouts/application.html.erb", "<html><body></body></html>")
    end

    it "skips importmap pinning and surfaces a hint instead" do
      output = run_generator
      expect(output).to include("modal_stack JS source lives in")
    end

    it "still injects the dialog and CSS" do
      run_generator
      expect(read_file("app/views/layouts/application.html.erb")).to include("modal-stack-root")
      expect(file_exists?("app/assets/stylesheets/modal_stack.css")).to be true
    end
  end

  context "with no application layout" do
    before do
      write_file("config/importmap.rb")
      write_file("app/javascript/application.js")
    end

    it "warns and continues without crashing" do
      expect { run_generator }.not_to raise_error
    end
  end

  it "rejects unknown --mode without modifying any files" do
    write_file("config/importmap.rb", %(pin "application"\n))
    output = run_generator(["--mode", "wat"])
    expect(output).to match(/mode/i)
    expect(read_file("config/importmap.rb")).not_to include("modal_stack")
  end

  it "rejects unknown --preset without modifying any files" do
    write_file("config/importmap.rb", %(pin "application"\n))
    output = run_generator(["--preset", "boots"])
    expect(output).to match(/preset/i)
    expect(read_file("config/importmap.rb")).not_to include("modal_stack")
  end
end
