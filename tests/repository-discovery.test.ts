// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { discoverPublicRepositories } from '../src/repository-discovery.js';

function fakeFetch(pages: unknown[][]): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get('page'));
    return Response.json(pages[page - 1] ?? []);
  };
}

describe('discoverPublicRepositories', () => {
  it('returns public non-archived repositories in stable order', async () => {
    const repositories = await discoverPublicRepositories(
      'ExampleOrg',
      undefined,
      fakeFetch([
        [
          { name: 'zeta', archived: false },
          { name: 'archive', archived: true },
          { name: 'alpha', archived: false },
        ],
      ]),
      'https://api.github.test',
    );

    expect(repositories).toEqual(['alpha', 'zeta']);
  });

  it('paginates until GitHub returns fewer than 100 repositories', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      name: `repo-${String(index).padStart(3, '0')}`,
      archived: false,
    }));

    const repositories = await discoverPublicRepositories(
      'ExampleOrg',
      undefined,
      fakeFetch([
        firstPage,
        [
          { name: 'repo-100', archived: false },
          { name: 'repo-101', archived: false },
        ],
      ]),
      'https://api.github.test',
    );

    expect(repositories).toHaveLength(102);
    expect(repositories.at(-1)).toBe('repo-101');
  });

  it('fails closed when GitHub returns an error', async () => {
    const failingFetch: typeof fetch = async () =>
      new Response('', { status: 403 });

    await expect(
      discoverPublicRepositories(
        'ExampleOrg',
        failingFetch,
        'https://api.github.test',
      ),
    ).rejects.toThrow('HTTP 403');
  });
});


it('sends bearer authentication when a token is provided', async () => {
  let authorization: string | null = null;

  const authenticatedFetch: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    authorization = headers.get('authorization');
    return Response.json([]);
  };

  await discoverPublicRepositories(
    'ExampleOrg',
    'token-value',
    authenticatedFetch,
    'https://api.github.test',
  );

  expect(authorization).toBe('Bearer token-value');
});
