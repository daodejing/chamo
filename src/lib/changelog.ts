/**
 * Changelog utility for loading and typing changelog data
 */

export interface ChangelogChanges {
  features: string[];
  fixes: string[];
  improvements: string[];
}

export interface ChangelogVersion {
  version: string;
  date: string;
  changes: ChangelogChanges;
}

export interface Changelog {
  versions: ChangelogVersion[];
}

/**
 * Load changelog data from the generated JSON file
 * Returns empty changelog if file not found or invalid
 */
export function loadChangelog(): Changelog {
  try {
    // Dynamic import of generated changelog
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require("@/data/changelog.json") as Changelog;
    return data;
  } catch {
    // Return empty changelog if file doesn't exist (e.g., in dev before first build)
    return {
      versions: [
        {
          version: "1.0.0",
          date: new Date().toISOString().split("T")[0],
          changes: {
            features: ["Initial release"],
            fixes: [],
            improvements: [],
          },
        },
      ],
    };
  }
}

/**
 * Get the current app version from changelog (first entry)
 */
export function getCurrentVersion(): string {
  const changelog = loadChangelog();
  return changelog.versions[0]?.version ?? "1.0.0";
}

/**
 * Get the current release date from changelog (first entry)
 */
export function getCurrentReleaseDate(): string {
  const changelog = loadChangelog();
  return changelog.versions[0]?.date ?? new Date().toISOString().split("T")[0];
}

/**
 * Check if a version has any changes
 */
export function hasChanges(version: ChangelogVersion): boolean {
  const { features, fixes, improvements } = version.changes;
  return features.length > 0 || fixes.length > 0 || improvements.length > 0;
}
