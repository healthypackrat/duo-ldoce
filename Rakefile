require 'cgi/util'
require 'erb'
require 'json'
require 'open-uri'
require 'pathname'

require 'bundler/setup'
require 'nokogiri'
require 'tilt'

WORD_PATTERN = /[A-Za-z]+(?:'[A-Za-z]+)?/

class RenderingContext
  include ERB::Util

  def link_to_search_on_ldoce(text)
    text.gsub(WORD_PATTERN) do |word|
      %(<a href="https://www.ldoceonline.com/search/english/direct/?q=#{h(CGI.escape(word))}">#{h(word)}</a>)
    end
  end

  def link_to_ldoce(word_text, word_slug)
    %(<a href="https://www.ldoceonline.com/dictionary/#{word_slug}">#{h(word_text)}</a>)
  end
end

def erb(template_path, locals = {})
  template = Tilt.new(template_path, trim: '-')
  template.render(RenderingContext.new, locals) { yield if block_given? }
end

def parse_phrases(path)
  File.readlines(path).map do |line|
    phrase_text, _, memo = line.chomp.split(/\t/, 3)

    section_number = memo[/\d+\z/].to_i

    words = phrase_text.scan(WORD_PATTERN).select do |word_text|
      word_text.size >= 3
    end.map do |word_text|
      { 'text' => word_text, 'entries' => nil }
    end

    { 'text' => phrase_text, 'section_number' => section_number, 'words' => words }
  end
end

def load_response_body(slug)
  path = Pathname.new("tmp/res/#{slug}.html")
  path.exist? ? path.read : nil
end

def dump_response_body(slug, body)
  path = Pathname.new("tmp/res/#{slug}.html")
  path.parent.mkpath
  path.write(body)
end

def load_json(path, default=nil)
  File.exist?(path) ? JSON.parse(File.read(path)) : default
end

def dump_json(path, obj)
  open(path, 'w') {|io| io << JSON.pretty_generate(obj) }
end

task :default => :build_html

task :build_html => [:build_index, :build_sections]

task :build_index do
  phrases = load_json('data/phrases.json')

  locals = {}

  locals[:section_numbers] = phrases.map {|p| p['section_number'] }.sort.uniq

  locals[:title] = locals[:brand] = 'DUO 3.0 LDOCE'

  html = erb('views/layout.erb', locals) do
    erb('views/index.erb', locals)
  end

  open('docs/index.html', 'w') {|io| io << html }
end

task :build_sections do
  phrases = load_json('data/phrases.json')

  groups = phrases.group_by {|p| p['section_number'] }

  groups.each do |section_number, members|
    locals = {}

    word2slug = load_json('data/word2slug.json', {})

    members.each do |phrase|
      phrase['words'].each do |word|
        word['slug'] = word2slug[word['text']]
      end
    end

    locals[:phrases] = members

    locals[:brand] = 'DUO 3.0 LDOCE'

    locals[:title] = "SECTION #{section_number}"

    html = erb('views/layout.erb', locals) do
      erb('views/section.erb', locals)
    end

    open('docs/%02d.html' % section_number, 'w') {|io| io << html }
  end
end

task :scrape => 'data/phrases.json'

task 'data/phrases.json' => 'data/word2slug.json' do |t|
  word2slug = load_json(t.prerequisites.first, {})

  phrases = parse_phrases('data/phrases.txt')

  phrases.each do |phrase|
    section_number = phrase['section_number']

    phrase['words'].each do |word|
      word_text = word['text']

      word_slug = word2slug.fetch(word_text)

      next unless word_slug

      body = load_response_body(word_slug)

      unless body
        request_url = "https://www.ldoceonline.com/dictionary/#{word_slug}"

        sleep 1

        warn "[SECTION #{section_number}] GET: #{request_url}"

        body = open(request_url) {|res| res.read }

        dump_response_body(word_slug, body)
      end

      warn "[SECTION #{section_number}] SCRAPE: #{word_slug}"

      doc = Nokogiri::HTML(body)

      entries = doc.search('.Head > .speaker.amefile').map do |speaker_node|
        pronunciation_url = speaker_node['data-src-mp3']

        phonetic_node = speaker_node.parent.at('./span[@class="PronCodes"]')
        phonetic_text = phonetic_node && phonetic_node.text.gsub(/\s+/, ' ').strip

        categories = speaker_node.parent.search('./span[@class="POS"]').map {|node| node.text.gsub(/\W+/, ' ').strip }
        categories = nil if categories.empty?

        { 'pronunciation_url' => pronunciation_url, 'phonetic_text' => phonetic_text, 'categories' => categories }
      end.select do |entry|
        entry['pronunciation_url']
      end

      word['entries'] = entries if entries.any?
    end
  end

  dump_json(t.name, phrases)
end

task 'data/word2slug.json' do |t|
  word2slug = load_json(t.name, {})

  words = parse_phrases('data/phrases.txt').map do |phrase|
    phrase['words'].map {|word| word['text'] }
  end.flatten.sort.uniq

  total = words.size

  words.each.with_index(1) do |word, index|
    if word2slug.has_key?(word)
      warn "[#{index}/#{total}] CACHE: #{word}"
    else
      search_url = "https://www.ldoceonline.com/search/english/direct/?q=#{CGI.escape(word)}"

      sleep 1

      warn "[#{index}/#{total}] GET: #{search_url}"

      open(search_url) do |res|
        if %r{\A/dictionary/([^/]+)\z} =~ res.base_uri.request_uri
          slug = $1

          body = res.read

          doc = Nokogiri::HTML(body)

          if doc.at('.Head > .speaker.amefile')
            word2slug[word] = slug

            dump_response_body(slug, body)
          else
            word2slug[word] = nil
          end
        else
          word2slug[word] = nil
        end
      end

      dump_json(t.name, word2slug)
    end
  end
end
