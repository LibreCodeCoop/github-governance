// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type ReleaseValidationInput = {
  requestedVersion: string;
  packageVersion: string;
  tagExists: boolean;
};

export function validateRelease({
  requestedVersion,
  packageVersion,
  tagExists,
}: ReleaseValidationInput): void {
  if (!/^v\d+\.\d+\.\d+$/.test(requestedVersion)) {
    throw new Error('Version must use the vMAJOR.MINOR.PATCH format.');
  }

  if (requestedVersion !== `v${packageVersion}`) {
    throw new Error(
      `Requested version ${requestedVersion} does not match package.json version v${packageVersion}.`,
    );
  }

  if (tagExists) {
    throw new Error(`Tag ${requestedVersion} already exists.`);
  }
}
