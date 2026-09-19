// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type RepositorySummary = {
  name: string;
  archived: boolean;
};

export async function discoverPublicRepositories(
  organization: string,
  fetchImpl: typeof fetch = fetch,
  apiBase = 'https://api.github.com',
): Promise<string[]> {
  const repositories = new Set<string>();

  for (let page = 1; ; page += 1) {
    const response = await fetchImpl(
      `${apiBase}/orgs/${encodeURIComponent(organization)}/repos?type=public&per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          'User-Agent': 'github-governance',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub repository discovery failed: HTTP ${response.status}`);
    }

    const pageItems = (await response.json()) as RepositorySummary[];

    for (const repository of pageItems) {
      if (!repository.archived) {
        repositories.add(repository.name);
      }
    }

    if (pageItems.length < 100) {
      break;
    }
  }

  return [...repositories].sort((left, right) => left.localeCompare(right));
}
