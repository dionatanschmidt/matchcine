// Limitador simples em memória (por processo). Usado como proteção básica
// contra abuso em rotas sem deviceId (oscar, taste-images) — não substitui
// verificarLimite() do /api/recommend, que já usa Supabase por usuário/device.
const hits = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
