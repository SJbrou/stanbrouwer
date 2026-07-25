source "https://rubygems.org"

# Use the github-pages gem, which bundles the correct version of Jekyll and related plugins
gem "github-pages", group: :jekyll_plugins

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.6"
  gem "jekyll-sitemap"
end

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: [:mingw, :mswin, :x64_mingw, :jruby]

# Performance-booster for watching directories on Windows
# `wdm` is only used for filesystem watching during local Windows development.
# Version 0.1.1 does not compile on Ruby 3.3+, while Jekyll builds work without it.
gem "wdm", "~> 0.1.0" if Gem.win_platform? && RUBY_VERSION < "3.2"
