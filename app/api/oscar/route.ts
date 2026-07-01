import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface OscarResult {
  hasOscar: boolean;
  awards?: string;
}

// Cache em memória: título → resultado com TTL de 1h
const cache = new Map<string, { result: OscarResult; expiresAt: number }>();
const TTL = 60 * 60 * 1000; // 1 hora

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const titulo = searchParams.get('titulo') ?? '';
  if (!titulo) return NextResponse.json({ hasOscar: false });

  const key = titulo.toLowerCase().trim();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.result);
  }

  const omdbKey = process.env.OMDB_API_KEY;
  if (!omdbKey) return NextResponse.json({ hasOscar: false });

  try {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(titulo)}&apikey=${omdbKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ hasOscar: false });

    const data = await res.json();
    const awards: string = data.Awards ?? '';

    const hasOscar = awards !== 'N/A' && /oscar|academy award/i.test(awards);
    const result: OscarResult = hasOscar ? { hasOscar: true, awards } : { hasOscar: false };

    cache.set(key, { result, expiresAt: Date.now() + TTL });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ hasOscar: false });
  }
}
