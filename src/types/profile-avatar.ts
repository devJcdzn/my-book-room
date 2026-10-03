export type ProfileAvatar = {
  source: 'custom' | 'provider' | 'none';
  version: string;
  localUri?: string;
  storagePath?: string;
  providerUrl?: string;
  pending?: boolean;
  previousPath?: string;
};

export const normalizeAvatar = (value: unknown): ProfileAvatar | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const avatar = value as Partial<ProfileAvatar>;
  if (!['custom', 'provider', 'none'].includes(avatar.source ?? '') || typeof avatar.version !== 'string' || !/^[a-zA-Z0-9-]{1,120}$/.test(avatar.version)) return undefined;
  return {
    source: avatar.source!, version: avatar.version,
    localUri: typeof avatar.localUri === 'string' && avatar.localUri.startsWith('file://') ? avatar.localUri : undefined,
    storagePath: typeof avatar.storagePath === 'string' && /^[a-f0-9-]+\/[a-zA-Z0-9-]+\.jpg$/.test(avatar.storagePath) ? avatar.storagePath : undefined,
    providerUrl: typeof avatar.providerUrl === 'string' && avatar.providerUrl.startsWith('https://') ? avatar.providerUrl : undefined,
    pending: avatar.pending === true,
    previousPath: typeof avatar.previousPath === 'string' && /^[a-f0-9-]+\/[a-zA-Z0-9-]+\.jpg$/.test(avatar.previousPath) ? avatar.previousPath : undefined,
  };
};

export const cloudAvatar = (avatar?: ProfileAvatar): ProfileAvatar | undefined => avatar ? {
  source: avatar.source, version: avatar.version,
  ...(avatar.source === 'custom' && avatar.storagePath ? { storagePath: avatar.storagePath } : {}),
  ...(avatar.source === 'provider' && avatar.providerUrl ? { providerUrl: avatar.providerUrl } : {}),
} : undefined;
