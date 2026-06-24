import { NextRequest, NextResponse } from 'next/server';

interface Item { n: string; t: string; }

async function fetchImageUrl(item: Item, apiKey: string): Promise<string | null> {
  try {
    if (item.t === 'Filme') {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(item.n)}`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) return null;
      const data = await res.json() as { results?: { poster_path?: string | null }[] };
      const path = data.results?.[0]?.poster_path;
      return path ? `https://image.tmdb.org/t/p/w185${path}` : null;
    } else {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(item.n)}`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) return null;
      const data = await res.json() as { results?: { profile_path?: string | null }[] };
      const path = data.results?.[0]?.profile_path;
      return path ? `https://image.tmdb.org/t/p/w185${path}` : null;
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log('[taste-images] API key present:', !!process.env.TMDB_API_KEY);
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.log('[taste-images] TMDB_API_KEY não encontrada — retornando vazio');
    return NextResponse.json({});
  }

  const { items } = await req.json() as { items: Item[] };
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({});

  const entries = await Promise.all(
    items.map(async item => {
      const url = await fetchImageUrl(item, apiKey);
      return [item.n, url] as [string, string | null];
    })
  );

  const map: Record<string, string> = {};
  for (const [name, url] of entries) {
    if (url) map[name] = url;
  }

  console.log(`[taste-images] ${items.length} itens solicitados → ${Object.keys(map).length} imagens encontradas`);
  return NextResponse.json(map);
}
