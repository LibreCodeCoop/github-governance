// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { validateRelease } from '../src/release-validator.js';

describe('validateRelease', () => {
  it('accepts a new version that matches package.json', () => {
    expect(() =>
      validateRelease({
        requestedVersion: 'v0.1.0',
        packageVersion: '0.1.0',
        tagExists: false,
      }),
    ).not.toThrow();
  });

  it.each([
    '0.1.0',
    'v0.1',
    'v0.1.0-beta.1',
    'latest',
  ])('rejects unsupported version format: %s', (requestedVersion) => {
    expect(() =>
      validateRelease({
        requestedVersion,
        packageVersion: '0.1.0',
        tagExists: false,
      }),
    ).toThrow('vMAJOR.MINOR.PATCH');
  });

  it('rejects a version that does not match package.json', () => {
    expect(() =>
      validateRelease({
        requestedVersion: 'v0.2.0',
        packageVersion: '0.1.0',
        tagExists: false,
      }),
    ).toThrow('does not match package.json version v0.1.0');
  });

  it('rejects an existing tag', () => {
    expect(() =>
      validateRelease({
        requestedVersion: 'v0.1.0',
        packageVersion: '0.1.0',
        tagExists: true,
      }),
    ).toThrow('already exists');
  });
});
