# frozen_string_literal: true

require "spec_helper"
require "fileutils"
require "rails/generators"
require "generators/modal_stack/views/views_generator"

RSpec.describe ModalStack::Generators::ViewsGenerator do
  let(:tmp_root) { File.expand_path("../tmp/views_generator", __dir__) }

  before do
    FileUtils.rm_rf(tmp_root)
    FileUtils.mkdir_p(tmp_root)
  end

  after { FileUtils.rm_rf(tmp_root) }

  def file_exists?(path)
    File.exist?(File.join(tmp_root, path))
  end

  def read_file(path)
    File.read(File.join(tmp_root, path))
  end

  def run_generator(args = [])
    original_stdout = $stdout
    original_stderr = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new
    described_class.start(args, destination_root: tmp_root)
  ensure
    $stdout = original_stdout
    $stderr = original_stderr
  end

  it "copies both partials by default" do
    run_generator
    expect(file_exists?("app/views/modal_stack/_panel.html.erb")).to be true
    expect(file_exists?("app/views/modal_stack/_dialog.html.erb")).to be true
  end

  it "panel partial contains wrapper_attrs and content locals" do
    run_generator
    content = read_file("app/views/modal_stack/_panel.html.erb")
    expect(content).to include("wrapper_attrs")
    expect(content).to include("content")
    expect(content).to include("back_button")
  end

  it "dialog partial contains dialog_attrs local" do
    run_generator
    content = read_file("app/views/modal_stack/_dialog.html.erb")
    expect(content).to include("dialog_attrs")
    expect(content).to include("<dialog")
  end

  it "--panel copies only the panel partial" do
    run_generator(["--panel"])
    expect(file_exists?("app/views/modal_stack/_panel.html.erb")).to be true
    expect(file_exists?("app/views/modal_stack/_dialog.html.erb")).to be false
  end

  it "--dialog copies only the dialog partial" do
    run_generator(["--dialog"])
    expect(file_exists?("app/views/modal_stack/_panel.html.erb")).to be false
    expect(file_exists?("app/views/modal_stack/_dialog.html.erb")).to be true
  end
end
