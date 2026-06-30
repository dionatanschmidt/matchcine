import type { Metadata } from 'next';
import Image from 'next/image';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

const STREAMING_LINKS: Record<string, string> = {
  'Netflix': 'https://netflix.com',
  'Amazon Prime Video': 'https://primevideo.com',
  'Prime Video': 'https://primevideo.com',
  'Disney+': 'https://disneyplus.com',
  'Disney Plus': 'https://disneyplus.com',
  'Max': 'https://max.com',
  'HBO Max': 'https://max.com',
  'Apple TV+': 'https://tv.apple.com',
  'Globoplay': 'https://globoplay.globo.com',
  'Paramount+': 'https://paramountplus.com',
  'Mubi': 'https://mubi.com',
};

async function fetchTMDB(id: string, type: string) {
  const key = process.env.TMDB_API_KEY ?? '';
  const mediaType = type === 'tv' ? 'tv' : 'movie';

  const [detailsRes, providersRes] = await Promise.all([
    fetch(`${TMDB_BASE}/${mediaType}/${id}?language=pt-BR&api_key=${key}`, { next: { revalidate: 3600 } }),
    fetch(`${TMDB_BASE}/${mediaType}/${id}/watch/providers?api_key=${key}`, { next: { revalidate: 3600 } }),
  ]);

  const details = detailsRes.ok ? await detailsRes.json() : null;
  const providersData = providersRes.ok ? await providersRes.json() : null;
  const brProviders: Array<{ provider_name: string }> = providersData?.results?.BR?.flatrate ?? [];

  return { details, brProviders };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { type = 'movie' } = await searchParams;
  const { details } = await fetchTMDB(id, type);
  if (!details) return { title: 'MatchCine' };

  const titulo = details.title ?? details.name ?? 'Filme';
  const poster = details.poster_path ? `${TMDB_IMG}/w500${details.poster_path}` : undefined;

  return {
    title: `${titulo} — via MatchCine`,
    description: 'Eu escolhi esse filme com o MatchCine. E você, o que vai assistir hoje?',
    openGraph: {
      title: `${titulo} — via MatchCine`,
      description: 'Eu escolhi esse filme com o MatchCine. E você, o que vai assistir hoje?',
      images: poster ? [{ url: poster }] : [],
    },
  };
}

export default async function VitrinePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type = 'movie' } = await searchParams;
  const { details: data, brProviders } = await fetchTMDB(id, type);

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#13111C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A79BB8', fontFamily: 'system-ui, sans-serif' }}>
        Filme não encontrado.
      </div>
    );
  }

  const titulo = data.title ?? data.name ?? '';
  const anoRaw = new Date(data.release_date ?? data.first_air_date ?? '').getFullYear();
  const ano = isNaN(anoRaw) ? null : anoRaw;
  const genero = (data.genres ?? []).slice(0, 2).map((g: { name: string }) => g.name).join(', ');
  const duracao = type === 'tv'
    ? `${data.number_of_seasons} temporada${data.number_of_seasons !== 1 ? 's' : ''}`
    : data.runtime ? `${data.runtime} min` : '';
  const sinopse: string = data.overview ?? '';
  const poster = data.poster_path ? `${TMDB_IMG}/w500${data.poster_path}` : null;
  const nota: string | null = (data.vote_average ?? 0) > 0 ? Number(data.vote_average).toFixed(1) : null;

  const firstProvider = brProviders[0] ?? null;
  const streamingUrl = firstProvider ? (STREAMING_LINKS[firstProvider.provider_name] ?? null) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#13111C', color: '#F6F1EA', fontFamily: 'system-ui, sans-serif', padding: '32px 20px' }}>
      <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <Image src="/logo-main.png.png" alt="MatchCine" height={60} width={180} style={{ objectFit: 'contain' }} priority />
        </div>

        {/* Poster */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 280, marginBottom: 20 }}>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={titulo} style={{ width: '100%', borderRadius: 16, display: 'block' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2/3', background: '#2A2440', borderRadius: 16 }} />
          )}
          {nota && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
              ⭐ {nota}
            </div>
          )}
        </div>

        {/* Info */}
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 500, textAlign: 'center', margin: '0 0 8px', lineHeight: 1.2 }}>
          {titulo}
        </h1>
        <p style={{ color: '#A79BB8', fontSize: 14, textAlign: 'center', margin: '0 0 16px' }}>
          {[ano, genero, duracao].filter(Boolean).join(' · ')}
        </p>
        {sinopse && (
          <p style={{ color: '#A79BB8', fontSize: 14, lineHeight: 1.6, textAlign: 'center', margin: '0 0 28px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {sinopse}
          </p>
        )}

        {/* CTA principal */}
        <a
          href="https://matchcine.vercel.app"
          style={{ display: 'block', width: '100%', textAlign: 'center', background: '#FFB13C', color: '#13111C', fontWeight: 700, fontSize: 16, borderRadius: 14, padding: '16px', textDecoration: 'none', marginBottom: 12 }}
        >
          🎬 Descobrir o meu filme
        </a>

        {/* CTA streaming */}
        {streamingUrl && firstProvider && (
          <a
            href={streamingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', width: '100%', textAlign: 'center', background: 'transparent', color: '#F6F1EA', fontWeight: 600, fontSize: 15, borderRadius: 14, padding: '14px', textDecoration: 'none', border: '1px solid #373050' }}
          >
            ▶ Assistir no {firstProvider.provider_name}
          </a>
        )}
      </div>
    </div>
  );
}
