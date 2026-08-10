const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateAvatarFile(file) {
  if (!file || typeof file !== 'object') return 'Selecciona una imagen para tu avatar.';
  if (!AVATAR_TYPES.has(file.type)) return 'Usa una imagen JPG, PNG o WebP.';
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > AVATAR_MAX_BYTES) return 'La imagen debe pesar como máximo 5 MiB.';
  return null;
}

export function createAvatarService(client) {
  const objectPath = (userId) => `${userId}/avatar`;
  const publicUrl = (userId) => client?.storage?.from(AVATAR_BUCKET).getPublicUrl(objectPath(userId))?.data?.publicUrl || null;

  return {
    async uploadAvatar(userId, file) {
      const validationError = validateAvatarFile(file);
      if (validationError) return { url: null, error: validationError };
      if (!client || !userId) return { url: null, error: 'La subida de avatares aún no está disponible.' };
      const { error } = await client.storage.from(AVATAR_BUCKET).upload(objectPath(userId), file, {
        cacheControl: '3600', contentType: file.type, upsert: true,
      });
      if (error) return { url: null, error: 'No pudimos subir el avatar. Inténtalo de nuevo.' };
      const url = publicUrl(userId);
      return url ? { url: `${url}?v=${Date.now()}`, error: null } : { url: null, error: 'No pudimos preparar el avatar.' };
    },

    async removeAvatar(userId) {
      if (!client || !userId) return { error: null };
      const { error } = await client.storage.from(AVATAR_BUCKET).remove([objectPath(userId)]);
      return { error: error ? 'No pudimos retirar el avatar anterior.' : null };
    },

    isManagedAvatarUrl(userId, value) {
      const expected = publicUrl(userId);
      if (!expected || !value) return false;
      try {
        const actualUrl = new URL(value);
        const expectedUrl = new URL(expected);
        return actualUrl.origin === expectedUrl.origin && actualUrl.pathname === expectedUrl.pathname;
      } catch {
        return false;
      }
    },
  };
}
