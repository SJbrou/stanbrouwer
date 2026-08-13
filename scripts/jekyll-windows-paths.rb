# frozen_string_literal: true

# Jekyll 3.10 uses Dir[pattern] to load its extensions. On Windows, Ruby's
# wildcard lookup can return no files when the project path contains spaces.
# Keep the normal lookup and only fall back to an entry-based match when that
# happens, so local Jekyll development also works from this repository path.
class << Dir
  alias_method :stan_original_glob, :[] unless method_defined?(:stan_original_glob)

  def [](*patterns)
    patterns.flat_map do |pattern|
      matches = stan_original_glob(pattern)
      next matches unless matches.empty? && pattern.is_a?(String) && pattern.match?(/[\*\?\[]/)

      directory = File.dirname(pattern)
      basename = File.basename(pattern)
      begin
        Dir.entries(directory)
          .reject { |entry| entry == '.' || entry == '..' }
          .select { |entry| File.fnmatch?(basename, entry) }
          .map { |entry| File.join(directory, entry) }
      rescue Errno::ENOENT, Errno::ENOTDIR
        matches
      end
    end
  end
end
