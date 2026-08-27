export function cacheBustedReleaseUrl(baseUrl, gitSha) {
  if (!/^[a-f0-9]{40}$/.test(gitSha)) throw new Error('Expected a full Git SHA.');
  const url = new URL('/release.json', baseUrl);
  url.searchParams.set('verification', gitSha);
  return url.toString();
}

export function validateReleaseMetadata(value) {
  if (!value || typeof value !== 'object') throw new Error('Release metadata must be an object.');
  if (!/^[a-f0-9]{40}$/.test(value.git_sha)) throw new Error('release.json Git SHA is invalid.');
  if (typeof value.source_clean !== 'boolean') throw new Error('release.json source status is invalid.');
  for (const field of ['catalog_sha256', 'hosting_config_sha256']) {
    if (!/^[a-f0-9]{64}$/.test(value[field])) throw new Error(`release.json ${field} is invalid.`);
  }
  if (Number.isNaN(Date.parse(value.build_timestamp))) {
    throw new Error('release.json build timestamp is invalid.');
  }
  return value;
}
