export type GitHubContentProbe = {
  exists(owner: string, repository: string, path: string): Promise<boolean>;
};

export type RepositoryMetadata = {
  owner: string;
  name: string;
  visibility: 'public' | 'private' | 'internal';
  archived: boolean;
};

export async function classifyRepository(
  repository: RepositoryMetadata,
  probe: GitHubContentProbe,
) {
  const isPublic = repository.visibility === 'public';

  if (!isPublic || repository.archived) {
    return {
      owner: repository.owner,
      name: repository.name,
      isPublic,
      isArchived: repository.archived,
      isNextcloudApp: false,
    };
  }

  const isNextcloudApp = await probe.exists(
    repository.owner,
    repository.name,
    'appinfo/info.xml',
  );

  return {
    owner: repository.owner,
    name: repository.name,
    isPublic,
    isArchived: repository.archived,
    isNextcloudApp,
  };
}
