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

  def setup_layout
    write_file("app/views/layouts/application.html.erb", <<~HTML)
      <!DOCTYPE html>
      <html>
        <head>
          <title>App</title>
        </head>
        <body>
          <%= yield %>
        </body>
      </html>
    HTML
  end

  context "with importmap" do
    before do
      write_file("config/importmap.rb", %(pin "application", preload: true\n))
      write_file("app/javascript/application.js", %(const application = Application.start()\n))
      setup_layout
    end

    it "writes the initializer with the chosen options" do
      run_generator(["--css-provider", "bootstrap"])
      content = read_file("config/initializers/modal_stack.rb")
      expect(content).to include("config.css_provider = :bootstrap")
      expect(content).to include("config.assets_mode = :auto")
      expect(content).to include(%(config.initializer_version = "#{ModalStack::INITIALIZER_VERSION}"))
    end

    it "pins modal_stack in importmap.rb" do
      run_generator
      expect(read_file("config/importmap.rb")).to include('pin "modal_stack", to: "modal_stack.js"')
    end

    it "appends the install call in application.js when that's the only Stimulus entry point" do
      run_generator
      content = read_file("app/javascript/application.js")
      expect(content).to include('import { install as installModalStack } from "modal_stack"')
      expect(content).to include("installModalStack(application)")
    end

    it "prefers app/javascript/controllers/application.js when present (Rails 7+ default)" do
      write_file("app/javascript/controllers/application.js", <<~JS)
        import { Application } from "@hotwired/stimulus"
        const application = Application.start()
        export { application }
      JS
      run_generator
      controllers_app = read_file("app/javascript/controllers/application.js")
      expect(controllers_app).to include('import { install as installModalStack } from "modal_stack"')
      expect(controllers_app).to include("installModalStack(application)")

      base_app = read_file("app/javascript/application.js")
      expect(base_app).not_to include("installModalStack")
    end

    it "injects modal_stack_stylesheet_link_tag in <head>" do
      run_generator
      layout = read_file("app/views/layouts/application.html.erb")
      expect(layout).to match(%r{<%= modal_stack_stylesheet_link_tag %>\s*</head>})
    end

    it "injects modal_stack_dialog_tag before </body>" do
      run_generator
      layout = read_file("app/views/layouts/application.html.erb")
      expect(layout).to match(%r{<%= modal_stack_dialog_tag %>\s*</body>})
    end

    it "is idempotent across all injections" do
      run_generator
      run_generator

      expect(read_file("config/importmap.rb").scan(/pin "modal_stack"/).size).to eq(1)
      expect(read_file("app/javascript/application.js").scan(/from "modal_stack"/).size).to eq(1)
      expect(read_file("app/views/layouts/application.html.erb").scan(/modal_stack_stylesheet_link_tag/).size).to eq(1)
      expect(read_file("app/views/layouts/application.html.erb").scan(/modal_stack_dialog_tag/).size).to eq(1)
    end

    it "honors --skip-layout" do
      run_generator(["--skip-layout"])
      layout = read_file("app/views/layouts/application.html.erb")
      expect(layout).not_to include("modal_stack_stylesheet_link_tag")
      expect(layout).not_to include("modal_stack_dialog_tag")
    end

    it "honors --skip-js" do
      run_generator(["--skip-js"])
      expect(read_file("config/importmap.rb")).not_to include('pin "modal_stack"')
      expect(read_file("app/javascript/application.js")).not_to include("installModalStack")
    end

    it "honors --skip-initializer" do
      run_generator(["--skip-initializer"])
      expect(file_exists?("config/initializers/modal_stack.rb")).to be false
    end

    it "writes css_provider :none when requested" do
      run_generator(["--css-provider", "none"])
      content = read_file("config/initializers/modal_stack.rb")
      expect(content).to include("config.css_provider = :none")
    end
  end

  context "with sprockets" do
    before do
      write_file("app/assets/config/manifest.js", "//= link_tree ../images\n")
      setup_layout
    end

    it "auto-detects sprockets when no importmap or package.json is present" do
      run_generator
      content = read_file("app/assets/config/manifest.js")
      expect(content).to include("//= link modal_stack.js")
      expect(content).to include("//= link modal_stack/tailwind.css")
    end

    it "appends the right css link based on --css-provider" do
      run_generator(["--mode", "sprockets", "--css-provider", "bootstrap"])
      content = read_file("app/assets/config/manifest.js")
      expect(content).to include("//= link modal_stack/bootstrap.css")
    end

    it "skips css link when provider is none" do
      run_generator(["--mode", "sprockets", "--css-provider", "none"])
      content = read_file("app/assets/config/manifest.js")
      expect(content).to include("//= link modal_stack.js")
      expect(content).not_to include("//= link modal_stack/")
    end
  end

  context "with jsbundling (no importmap)" do
    before do
      write_file("package.json", %({"name":"app","scripts":{}}))
      write_file("app/javascript/application.js", "")
      setup_layout
    end

    it "surfaces install hints and wires the install call" do
      output = run_generator(["--mode", "jsbundling"])
      expect(output).to match(/JS bundle/i)
      expect(read_file("app/javascript/application.js")).to include("installModalStack")
    end
  end

  it "rejects unknown --mode without modifying any files" do
    write_file("config/importmap.rb", %(pin "application"\n))
    output = run_generator(["--mode", "wat"])
    expect(output).to match(/mode/i)
    expect(read_file("config/importmap.rb")).not_to include("modal_stack")
  end

  it "rejects unknown --css-provider" do
    write_file("config/importmap.rb", %(pin "application"\n))
    output = run_generator(["--css-provider", "boots"])
    expect(output).to match(/css_provider|css-provider|provider/i)
    expect(read_file("config/importmap.rb")).not_to include("modal_stack")
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
end
