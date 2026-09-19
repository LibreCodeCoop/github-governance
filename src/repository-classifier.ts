// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type GitHubContentProbe = {
  exists(owner: string, repository: string, path: string): Promise<boolean>;
};

export type RepositoryMetadata = {
  owner: string;
  name: string;
  visibility: 'public' | 'private' | 'internal';
  archived: boolean;
};
