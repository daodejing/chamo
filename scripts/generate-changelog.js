#!/usr/bin/env node
/**
 * Generate Changelog Script
 *
 * Generates changelog.json from git history by parsing conventional commits.
 * Runs at build time via prebuild hook.
 *
 * Usage: node scripts/generate-changelog.js
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.join(__dirname, "../src/data/changelog.json");
const PACKAGE_JSON_PATH = path.join(__dirname, "../package.json");

/**
 * Execute git command safely using execFileSync (no shell injection risk)
 * @param {string[]} args - Git command arguments
 * @returns {string} Command output or empty string on error
 */
function execGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

/**
 * Get all git tags sorted by version (descending)
 * @returns {string[]} Array of tag names
 */
function getTags() {
  const output = execGit(["tag", "--sort=-version:refname"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

/**
 * Get date of a git tag
 * @param {string} tag - Tag name
 * @returns {string} Date in YYYY-MM-DD format
 */
function getTagDate(tag) {
  const output = execGit(["log", "-1", "--format=%ai", tag]);
  return output ? output.split(" ")[0] : new Date().toISOString().split("T")[0];
}

/**
 * Get commits between two refs
 * @param {string | null} from - Starting ref (exclusive)
 * @param {string} to - Ending ref (inclusive)
 * @returns {string[]} Array of commit messages
 */
function getCommitsBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  const output = execGit(["log", range, "--pretty=format:%s"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

/**
 * Parse conventional commit message
 * @param {string} message - Commit message
 * @returns {{ type: string, scope: string | null, description: string } | null}
 */
function parseConventionalCommit(message) {
  // Match: type(scope): description or type: description
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!match) return null;

  return {
    type: match[1].toLowerCase(),
    scope: match[2] || null,
    description: match[3],
  };
}

/**
 * Categorize commits into features, fixes, improvements
 * @param {string[]} commits - Array of commit messages
 * @returns {{ features: string[], fixes: string[], improvements: string[] }}
 */
function categorizeCommits(commits) {
  const categories = {
    features: [],
    fixes: [],
    improvements: [],
  };

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit);
    if (!parsed) continue;

    // Skip non-user-facing commits
    if (["chore", "docs", "test", "ci", "build", "style"].includes(parsed.type)) {
      continue;
    }

    const description = parsed.scope
      ? `${parsed.description} (${parsed.scope})`
      : parsed.description;

    switch (parsed.type) {
      case "feat":
        categories.features.push(description);
        break;
      case "fix":
        categories.fixes.push(description);
        break;
      case "perf":
      case "refactor":
        categories.improvements.push(description);
        break;
    }
  }

  return categories;
}

/**
 * Get current version from package.json
 * @returns {string}
 */
function getCurrentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Generate changelog data
 * @returns {{ versions: Array<{ version: string, date: string, changes: object }> }}
 */
function generateChangelog() {
  const tags = getTags();
  const versions = [];

  // If we have tags, generate changelog from tag history
  if (tags.length > 0) {
    for (let i = 0; i < tags.length; i++) {
      const currentTag = tags[i];
      const previousTag = tags[i + 1] || null;

      const commits = getCommitsBetween(previousTag, currentTag);
      const changes = categorizeCommits(commits);

      // Only include versions with user-facing changes
      if (changes.features.length || changes.fixes.length || changes.improvements.length) {
        versions.push({
          version: currentTag.replace(/^v/, ""),
          date: getTagDate(currentTag),
          changes,
        });
      }
    }
  }

  // Add unreleased changes from HEAD if any
  const currentVersion = getCurrentVersion();
  const latestTag = tags[0] || null;
  const unreleasedCommits = getCommitsBetween(latestTag, "HEAD");
  const unreleasedChanges = categorizeCommits(unreleasedCommits);

  if (
    unreleasedChanges.features.length ||
    unreleasedChanges.fixes.length ||
    unreleasedChanges.improvements.length
  ) {
    // Insert at beginning (most recent first)
    versions.unshift({
      version: currentVersion,
      date: new Date().toISOString().split("T")[0],
      changes: unreleasedChanges,
    });
  }

  // If no versions at all, create a placeholder
  if (versions.length === 0) {
    versions.push({
      version: currentVersion,
      date: new Date().toISOString().split("T")[0],
      changes: {
        features: ["Initial release"],
        fixes: [],
        improvements: [],
      },
    });
  }

  return { versions };
}

// Main execution
function main() {
  console.log("Generating changelog from git history...");

  const changelog = generateChangelog();

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write changelog
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(changelog, null, 2));

  console.log(`Changelog generated: ${OUTPUT_PATH}`);
  console.log(`  - ${changelog.versions.length} version(s) documented`);
}

main();
