import { describe, expect, it } from 'vitest';
import { GitHubClient } from '../src/github-client.js';
import { baseRuleset } from '../src/policies.js';

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
        url: 'https://api.github.test/repos/LibreSign/libresign',
        response: Response.json({
          name: 'libresign',
          owner: { login: 'LibreSign' },
          visibility: 'public',
          archived: false,
        }),
      },
    ];

    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(
      client.getRepository('LibreSign', 'libresign'),
    ).resolves.toEqual({
      owner: 'LibreSign',
      name: 'libresign',
      visibility: 'public',
      archived: false,
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
              name: 'libresign',
              owner: { login: 'LibreSign' },
              visibility: 'public',
              archived: false,
            },
            {
              name: 'archive',
              owner: { login: 'LibreSign' },
              visibility: 'public',
              archived: true,
            },
            {
              name: 'private',
              owner: { login: 'LibreSign' },
              visibility: 'private',
              archived: false,
            },
            {
              name: 'other',
              owner: { login: 'OtherOrg' },
              visibility: 'public',
              archived: false,
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

    await expect(client.listManagedRepositories('LibreSign')).resolves.toEqual([
      {
        owner: 'LibreSign',
        name: 'libresign',
        visibility: 'public',
        archived: false,
      },
    ]);
    expect(requests).toHaveLength(0);
  });

  it('returns false only for a 404 content probe', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/LibreSign/documentation/contents/appinfo/info.xml',
        response: new Response('', { status: 404 }),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(
      client.exists('LibreSign', 'documentation', 'appinfo/info.xml'),
    ).resolves.toBe(false);
  });

  it('fails closed for unexpected content probe errors', async () => {
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/LibreSign/libresign/contents/appinfo/info.xml',
        response: new Response('', { status: 403 }),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await expect(
      client.exists('LibreSign', 'libresign', 'appinfo/info.xml'),
    ).rejects.toThrow('HTTP 403');
  });

  it('loads repository ruleset details and ignores organization-sourced rulesets', async () => {
    const rulesetResponse = {
      id: 7,
      name: baseRuleset.name,
      target: baseRuleset.target,
      enforcement: baseRuleset.enforcement,
      bypass_actors: [
        {
          actor_id: null,
          actor_type: 'OrganizationAdmin',
          bypass_mode: 'pull_request',
        },
      ],
      conditions: baseRuleset.conditions,
      rules: baseRuleset.rules,
    };
    const requests: ExpectedRequest[] = [
      {
        url: 'https://api.github.test/repos/LibreSign/libresign/rulesets?per_page=100',
        response: Response.json([
          { id: 7, source_type: 'Repository' },
          { id: 8, source_type: 'Organization' },
        ]),
      },
      {
        url: 'https://api.github.test/repos/LibreSign/libresign/rulesets/7',
        response: Response.json(rulesetResponse),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    const rulesets = await client.list('LibreSign', 'libresign');

    expect(rulesets).toHaveLength(1);
    expect(rulesets[0]).toMatchObject({
      id: 7,
      name: baseRuleset.name,
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
        url: 'https://api.github.test/repos/LibreSign/libresign/rulesets',
        method: 'POST',
        response: Response.json({}, { status: 201 }),
      },
      {
        url: 'https://api.github.test/repos/LibreSign/libresign/rulesets/9',
        method: 'PUT',
        response: Response.json({}),
      },
    ];
    const client = new GitHubClient(
      'token',
      fakeFetch(requests),
      'https://api.github.test',
    );

    await client.create('LibreSign', 'libresign', baseRuleset);
    await client.update('LibreSign', 'libresign', 9, baseRuleset);

    expect(requests).toHaveLength(0);
  });
});
