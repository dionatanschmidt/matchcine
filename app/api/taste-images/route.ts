import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

interface Item { n: string; t: string; }

const MAX_ITEMS = 60;
const MAX_NAME_LEN = 200;

function isValidItem(v: unknown): v is Item {
  return !!v && typeof v === 'object'
    && typeof (v as Item).n === 'string' && (v as Item).n.length > 0 && (v as Item).n.length <= MAX_NAME_LEN
    && typeof (v as Item).t === 'string';
}

interface TmdbInfo { url: string; tmdb_id: number; }

async function fetchImageUrl(item: Item, apiKey: string): Promise<TmdbInfo | null> {
  try {
    if (item.t === 'Filme') {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(item.n)}`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) return null;
      const data = await res.json() as { results?: { id: number; poster_path?: string | null }[] };
      const first = data.results?.[0];
      return first?.poster_path ? { url: `https://image.tmdb.org/t/p/w185${first.poster_path}`, tmdb_id: first.id } : null;
    } else if (item.t === 'Série') {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(item.n)}`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) return null;
      const data = await res.json() as { results?: { id: number; poster_path?: string | null }[] };
      const first = data.results?.[0];
      return first?.poster_path ? { url: `https://image.tmdb.org/t/p/w185${first.poster_path}`, tmdb_id: first.id } : null;
    } else {
      // Diretor, Ator, Atriz, Showrunner
      const res = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(item.n)}`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) return null;
      const data = await res.json() as { results?: { id: number; profile_path?: string | null }[] };
      const first = data.results?.[0];
      return first?.profile_path ? { url: `https://image.tmdb.org/t/p/w185${first.profile_path}`, tmdb_id: first.id } : null;
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`taste-images:${ip}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  console.log('[taste-images] API key present:', !!process.env.TMDB_API_KEY);
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.log('[taste-images] TMDB_API_KEY não encontrada — retornando vazio');
    return NextResponse.json({});
  }

  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({});
  if (items.length > MAX_ITEMS || !items.every(isValidItem)) {
    return NextResponse.json({ error: 'Payload inválido ou excede o limite permitido.' }, { status: 400 });
  }

  const entries = await Promise.all(
    (items as Item[]).map(async item => {
      const info = await fetchImageUrl(item, apiKey);
      return [item.n, info] as [string, TmdbInfo | null];
    })
  );

  const map: Record<string, TmdbInfo> = {};
  for (const [name, info] of entries) {
    if (info) map[name] = info;
  }

  console.log(`[taste-images] ${items.length} itens solicitados → ${Object.keys(map).length} imagens encontradas`);
  return NextResponse.json(map);
}
