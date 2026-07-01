import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface OscarResult {
  hasOscar: boolean;
  awards?: string;
}

const cache = new Map<string, { result: OscarResult; expiresAt: number }>();
const TTL = 60 * 60 * 1000;

function traduzir(awards: string): string {
  return awards
    .replace(/Won (\d+) Oscar[s]?/gi, 'Venceu $1 Oscar')
    .replace(/Nominated for (\d+) Oscar[s]?/gi, 'Indicado para $1 Oscar')
    .replace(/(\d+) win[s]?/gi, '$1 vitória(s)')
    .replace(/(\d+) nomination[s]?/gi, '$1 indicação(ões)')
    .replace(/& /g, 'e ')
    .replace(/\btotal\b/gi, 'no total')
    .replace(/\banother\b/gi, 'outra(s)')
    .replace(/\bwin\b/gi, 'vitória')
    .replace(/\bnomination\b/gi, 'indicação');
}

async function fetchOmdb(query: string, omdbKey: string): Promise<{ Response: string; Awards?: string } | null> {
  try {
    const res = await fetch(`https://www.omdbapi.com/?${query}&apikey=${omdbKey}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`oscar:${ip}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const titulo = (searchParams.get('titulo') ?? '').slice(0, 200);
  const originalTitle = (searchParams.get('original_title') ?? '').slice(0, 200);
  const rawTmdbId = searchParams.get('tmdb_id') ?? '';
  const tmdbId = /^\d+$/.test(rawTmdbId) ? rawTmdbId : '';

  if (!titulo && !originalTitle) return NextResponse.json({ hasOscar: false });

  const key = `${titulo}|${originalTitle}`.toLowerCase().trim();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.result);
  }

  const omdbKey = process.env.OMDB_API_KEY;
  if (!omdbKey) return NextResponse.json({ hasOscar: false });

  try {
    let data: { Response: string; Awards?: string; imdbID?: string } | null = null;
    let usedTitle = '';

    // 1. Tenta pelo título em português
    if (titulo) {
      data = await fetchOmdb(`t=${encodeURIComponent(titulo)}`, omdbKey);
      if (data?.Response === 'True') {
        usedTitle = titulo;
      } else {
        data = null;
      }
    }

    // 2. Tenta pelo título original em inglês
    if (!data && originalTitle && originalTitle !== titulo) {
      data = await fetchOmdb(`t=${encodeURIComponent(originalTitle)}`, omdbKey);
      if (data?.Response === 'True') {
        usedTitle = originalTitle;
      } else {
        data = null;
      }
    }

    // 3. Tenta pelo imdb_id via TMDB (se tmdb_id disponível)
    if (!data && tmdbId) {
      const tmdbKey = process.env.TMDB_API_KEY;
      if (tmdbKey) {
        const tmdbRes = await fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${tmdbKey}`,
          { next: { revalidate: 3600 } }
        );
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          const imdbId: string = tmdbData.imdb_id ?? '';
          if (imdbId) {
            data = await fetchOmdb(`i=${imdbId}`, omdbKey);
            if (data?.Response === 'True') {
              usedTitle = `imdb:${imdbId}`;
            } else {
              data = null;
            }
          }
        }
      }
    }

    if (!data) {
      const result: OscarResult = { hasOscar: false };
      cache.set(key, { result, expiresAt: Date.now() + TTL });
      return NextResponse.json(result);
    }

    console.log(`[oscar] encontrado via: "${usedTitle}"`);

    const awards: string = data.Awards ?? '';
    const hasOscar = awards !== 'N/A' && /oscar|academy award/i.test(awards);
    const result: OscarResult = hasOscar
      ? { hasOscar: true, awards: traduzir(awards) }
      : { hasOscar: false };

    cache.set(key, { result, expiresAt: Date.now() + TTL });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ hasOscar: false });
  }
}
