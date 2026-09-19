// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import {
  classifyRepository,
  type GitHubContentProbe,
} from '../src/repository-classifier.js';

class FakeProbe implements GitHubContentProbe {
  constructor(
    private readonly result: boolean | Error,
  ) {}

  async exists(): Promise<boolean> {
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

describe('classifyRepository', () => {
  it('detects a Nextcloud app from appinfo/info.xml', async () => {
    await expect(
      classifyRepository(
        {
          owner: 'LibreSign',
          name: 'libresign',
          visibility: 'public',
          archived: false,
        },
        new FakeProbe(true),
      ),
    ).resolves.toMatchObject({
      isPublic: true,
      isArchived: false,
      isNextcloudApp: true,
    });
  });

  it('treats a missing appinfo/info.xml as a non-Nextcloud repository', async () => {
    await expect(
      classifyRepository(
        {
          owner: 'LibreSign',
          name: 'documentation',
          visibility: 'public',
          archived: false,
        },
        new FakeProbe(false),
      ),
    ).resolves.toMatchObject({
      isNextcloudApp: false,
    });
  });

  it('fails closed when Nextcloud detection fails unexpectedly', async () => {
    await expect(
      classifyRepository(
        {
          owner: 'LibreSign',
          name: 'libresign',
          visibility: 'public',
          archived: false,
        },
        new FakeProbe(new Error('HTTP 403')),
      ),
    ).rejects.toThrow('HTTP 403');
  });
});
