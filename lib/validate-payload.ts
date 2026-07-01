export const MAX_STRING_LEN = 200;

const STRING_ARRAY_LIMITS: Record<string, number> = {
  services:     20,
  shown:        500,
  favorites:    300,
  likesPick:    300,
  dislikesPick: 300,
  loved:        300,
  disliked:     300,
};

const NUMBER_ARRAY_LIMITS: Record<string, number> = {
  shownTmdbIds: 500,
  recentGenres: 10,
};

const STRING_FIELDS = [
  'energy', 'genre', 'feel', 'company', 'endings', 'commitment',
  'epoch', 'country', 'sortType', 'certification', 'mediaType',
  'deviceId', 'oscarFilter',
] as const;

// Valida tamanhos de arrays e strings do body antes de qualquer chamada
// externa (TMDB/Claude/OMDB) ou consulta ao Supabase.
export function validarPayload(body: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  for (const [field, max] of Object.entries(STRING_ARRAY_LIMITS)) {
    const v = body[field];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length > max || !v.every(item => typeof item === 'string' && item.length <= MAX_STRING_LEN)) {
      return { ok: false, error: `Campo "${field}" inválido ou excede o limite permitido.` };
    }
  }

  for (const [field, max] of Object.entries(NUMBER_ARRAY_LIMITS)) {
    const v = body[field];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length > max || !v.every(item => typeof item === 'number' && Number.isFinite(item))) {
      return { ok: false, error: `Campo "${field}" inválido ou excede o limite permitido.` };
    }
  }

  for (const field of STRING_FIELDS) {
    const v = body[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' || v.length > MAX_STRING_LEN) {
      return { ok: false, error: `Campo "${field}" inválido.` };
    }
  }

  return { ok: true };
}

// Retorna o valor apenas se estiver na whitelist; caso contrário, ignora (undefined).
export function inWhitelist<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
