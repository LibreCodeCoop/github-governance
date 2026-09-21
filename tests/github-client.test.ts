// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { GitHubClient } from '../src/github-client.js';
import { protectedBranchesFixture } from './ruleset-fixtures.js';

type ExpectedRequest = {
  url: string;
  method?: string;
  response: Response;
};

function fakeFetch(expectations: ExpectedRequest[]): typeof fetch {
  return async (input, init) => {
    const next = expectations.shift();
    if (!next) {
      throw new Error(`Unexpected request: ${String(input)}`);
    }

    expect(String(input)).toBe(next.url);
    expect(init?.method ?? 'GET').toBe(next.method ?? 'GET');
    return next.response;
  };
}

describe('GitHubClient', () => {
  it('loads repository metadata for repository-scoped execution', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/ExampleOrg/project',
        response: Response.json({
          name: 'project',
          owner: { login: 'ExampleOrg' },
          visibility: 'public',
          archived: false,
          description: 'Project description',
          homepage: 'https://example.test',
          topics: ['existing-topic'],
        }),
      },
    ];

    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(
      client.getRepository('ExampleOrg', 'project'),
    ).resolves.toEqual({
      owner: 'ExampleOrg',
      name: 'project',
      visibility: 'public',
      archived: false,
      description: 'Project description',
      homepage: 'https://example.test',
      topics: ['existing-topic'],
    });
    expect(requests).toHaveLength(0);
  });

  it('lists only public non-archived repositories from the selected organization', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/installation/repositories?per_page=100&page=1',
        response: Response.json({
          repositories: [
            {
              name: 'project',
              owner: { login: 'ExampleOrg' },
              visibility: 'public',
              archived: false,
              description: null,
              homepage: null,
              topics: [],
            },
            {
              name: 'archive',
              owner: { login: 'ExampleOrg' },
              visibility: 'public',
              archived: true,
              description: null,
              homepage: null,
              topics: [],
            },
            {
              name: 'private',
              owner: { login: 'ExampleOrg' },
              visibility: 'private',
              archived: false,
              description: null,
              homepage: null,
              topics: [],
            },
            {
              name: 'other',
              owner: { login: 'OtherOrg' },
              visibility: 'public',
              archived: false,
              description: null,
              homepage: null,
              topics: [],
            },
          ],
        }),
      },
    ];

    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(client.listManagedRepositories('ExampleOrg')).resolves.toEqual([
      {
        owner: 'ExampleOrg',
        name: 'project',
        visibility: 'public',
        archived: false,
        description: null,
        homepage: null,
        topics: [],
      },
    ]);
    expect(requests).toHaveLength(0);
  });

  it('returns false only for a 404 content probe', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/ExampleOrg/documentation/contents/appinfo/info.xml',
        response: new Response('', { status: 404 }),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(
      client.exists('ExampleOrg', 'documentation', 'appinfo/info.xml'),
    ).resolves.toBe(false);
  });

  it('fails closed for unexpected content probe errors', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/ExampleOrg/project/contents/appinfo/info.xml',
        response: new Response('', { status: 403 }),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(
      client.exists('ExampleOrg', 'project', 'appinfo/info.xml'),
    ).rejects.toThrow('HTTP 403');
  });

  it('loads repository ruleset details and ignores organization-sourced rulesets', async () => {
    const rulesetResponse = {
      id: 7,
      name: protectedBranchesFixture.name,
      target: protectedBranchesFixture.target,
      enforcement: protectedBranchesFixture.enforcement,
      bypass_actors: [
        {
          actor_id: null,
          actor_type: 'OrganizationAdmin',
          bypass_mode: 'pull_request',
        },
      ],
      conditions: protectedBranchesFixture.conditions,
      rules: protectedBranchesFixture.rules,
    };
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/ExampleOrg/project/rulesets?per_page=100',
        response: Response.json([
          { id: 7, source_type: 'Repository' },
          { id: 8, source_type: 'Organization' },
        ]),
      },
      {
        url: 'https://api.github.test/repos/ExampleOrg/project/rulesets/7',
        response: Response.json(rulesetResponse),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    const rulesets = await client.list('ExampleOrg', 'project');

    expect(rulesets).toHaveLength(1);
    expect(rulesets[0]).toMatchObject({
      id: 7,
      name: protectedBranchesFixture.name,
      bypass_actors: [
        {
          actor_id: 0,
          actor_type: 'OrganizationAdmin',
          bypass_mode: 'pull_request',
        },
      ],
    });
  });

  it('creates and updates repository rulesets with JSON bodies', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/ExampleOrg/project/rulesets',
        method: 'POST',
        response: Response.json({}, { status: 201 }),
      },
      {
        url: 'https://api.github.test/repos/ExampleOrg/project/rulesets/9',
        method: 'PUT',
        response: Response.json({}),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await client.create('ExampleOrg', 'project', protectedBranchesFixture);
    await client.update('ExampleOrg', 'project', 9, protectedBranchesFixture);

    expect(requests).toHaveLength(0);
  });

  it('updates repository description and preserves merged topics supplied by the planner', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/ExampleOrg/project',
        method: 'PATCH',
        response: Response.json({}),
      },
      {
        url: 'https://api.github.test/repos/ExampleOrg/project/topics',
        method: 'PUT',
        response: Response.json({ names: ['existing-topic', 'hacktoberfest'] }),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await client.updateRepositoryMetadata('ExampleOrg', 'project', {
      description: 'Project description',
      topics: ['existing-topic', 'hacktoberfest'],
    });

    expect(requests).toHaveLength(0);
  });

});
