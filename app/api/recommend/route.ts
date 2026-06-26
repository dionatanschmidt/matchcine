import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// IDs dos provedores de streaming no TMDB para o Brasil
const PROVIDER_IDS: Record<string, number[]> = {
  'Netflix':       [8],
  'Prime Video':   [119],
  'Max':           [384, 1899],   // 384 = HBO Max (legado), 1899 = Max
  'Disney+':       [337],
  'Globoplay':     [307],
  'Apple TV+':     [350],
  'Paramount+':    [531],
  'Pluto TV':      [300],
  'YouTube':       [192],
};

// IDs de gênero no TMDB — filmes
const GENRE_IDS: Record<string, number> = {
  'Ação':          28,
  'Terror':        27,
  'Comédia':       35,
  'Drama':         18,
  'Ficção':        878,
  'Romance':       10749,
  'Suspense':      53,
  'Animação':      16,
  'Documentário':  99,
  'Aventura':      12,
};

// IDs de gênero no TMDB — séries
const TV_GENRE_IDS: Record<string, number> = {
  'Ação':          10759, // Action & Adventure
  'Terror':        9648,  // Mystery
  'Comédia':       35,
  'Drama':         18,
  'Ficção':        10765, // Sci-Fi & Fantasy
  'Romance':       10749,
  'Suspense':      80,    // Crime
  'Animação':      16,
  'Documentário':  99,
};

// Mapa reverso ID → nome (filmes)
const GENRE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([name, id]) => [id, name])
);

// Mapa reverso ID → nome (séries)
const TV_GENRE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(TV_GENRE_IDS).map(([name, id]) => [id, name])
);

// Cores de fallback por humor
const MOOD_COLORS: Record<string, [string, string]> = {
  cansado:   ['#1b2436', '#3a3550'],
  agitado:   ['#2a1b36', '#542f3f'],
  entediado: ['#162a2e', '#2f5246'],
  pra_baixo: ['#1a2230', '#445a6e'],
  tranquilo: ['#1e2a22', '#4a6b52'],
  ligado:    ['#2e1414', '#6b2f2f'],
};

const PORQUE_MAP: Record<string, string> = {
  cansado:   'Ideal pra desligar a cabeça — não exige nada, só entrega.',
  agitado:   'Vai te ajudar a desacelerar sem perceber.',
  entediado: 'Do tipo que prende do início ao fim.',
  pra_baixo: 'Vai te fazer sentir — de um jeito bom.',
  tranquilo: 'Combina com o seu momento aberto de hoje.',
  ligado:    'Sem freio. Exatamente o que você pediu.',
};

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

// Candidato normalizado (funciona para filme e série)
interface CandidateNorm {
  id: number;
  title: string;
  original_title: string;
  vote_average: number;
  genre_ids: number[];
  overview: string;
  release_date: string;
}

async function askClaude(
  candidates: CandidateNorm[],
  ctx: {
    feel?: string;
    company?: string;
    energy?: string;
    genre?: string;
    endings?: string;
    favorites?: string[];
    likesPick?: string[];
    dislikesPick?: string[];
    loved?: string[];
    disliked?: string[];
  },
  isTV = false
): Promise<{ tmdb_id_escolhido: number; porque: string } | null> {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey || claudeKey === 'COLOQUE_SUA_CHAVE_AQUI') return null;

  const client = new Anthropic({ apiKey: claudeKey });
  const genreNamesMap = isTV ? TV_GENRE_NAMES : GENRE_NAMES;
  const mediaWord = isTV ? 'séries' : 'filmes';
  const itemWord  = isTV ? 'série'  : 'filme';

  const movieList = candidates
    .map(m => {
      const genres = m.genre_ids.map(id => genreNamesMap[id]).filter(Boolean).join(', ');
      const year = m.release_date ? new Date(m.release_date).getFullYear() : '?';
      const snippet = m.overview
        ? m.overview.slice(0, 130) + (m.overview.length > 130 ? '…' : '')
        : '';
      return `• ID ${m.id}: "${m.title}" (${year}) | Gêneros: ${genres || 'N/A'} | Nota: ${m.vote_average.toFixed(1)} | ${snippet}`;
    })
    .join('\n');

  const prompt = `Você é um curador de ${mediaWord} especializado em combinar humor, companhia e gênero.

MOMENTO DO USUÁRIO:
- Como está se sentindo: ${ctx.feel ?? '?'}
- Com quem vai assistir: ${ctx.company ?? '?'}
- Fôlego/tempo de episódio: ${ctx.energy ?? '?'}
- Gênero desejado agora: ${ctx.genre ?? 'sem preferência'}
- Tipo de final preferido: ${ctx.endings ?? 'sem preferência'}
- Títulos/nomes que ama (⭐ peso 5): ${ctx.favorites?.join(', ') || '—'}
- Títulos que curtiu (❤️ peso 2): ${ctx.likesPick?.join(', ') || '—'}
- Títulos que não curtiu (👎 peso -3): ${ctx.dislikesPick?.join(', ') || '—'}
- ${isTV ? 'Séries' : 'Filmes'} amados nesta sessão (❤️ peso 2): ${ctx.loved?.join(', ') || '—'}
- ${isTV ? 'Séries' : 'Filmes'} rejeitados nesta sessão (👎 peso -3): ${ctx.disliked?.join(', ') || '—'}

PESOS DE DECISÃO:
⭐ favorito = +5 | ❤️ gostei = +2 | 👎 não curti = -3
humor + companhia combinados = peso 4 | gênero = peso 3 | fôlego/duração = peso 2

${isTV ? 'SÉRIES' : 'FILMES'} DISPONÍVEIS:
${movieList}

REGRA ABSOLUTA: escolha SOMENTE um ${itemWord} da lista acima. Nunca invente nem sugira ${mediaWord} fora dela.

Responda APENAS com JSON válido, sem markdown, sem texto extra:
{"tmdb_id_escolhido": <id numérico inteiro>, "porque": "<frase de 1-2 linhas em português do Brasil explicando por que esse ${itemWord} combina com o momento do usuário>"}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const parsed = JSON.parse(text) as { tmdb_id_escolhido: unknown; porque: unknown };

    if (typeof parsed.tmdb_id_escolhido === 'number' && typeof parsed.porque === 'string') {
      return { tmdb_id_escolhido: parsed.tmdb_id_escolhido, porque: parsed.porque };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY não configurada.' }, { status: 500 });
  }

  const body = await req.json();
  const {
    services = [],
    energy,
    genre,
    feel,
    shown = [],
    shownTmdbIds = [],
    company,
    endings,
    favorites = [],
    likesPick = [],
    dislikesPick = [],
    loved = [],
    disliked = [],
    epoch,
    mediaType = 'movie',
  } = body;

  const isTV = mediaType === 'tv';

  console.log(`[recommend] mediaType=${mediaType} shownTmdbIds (${(shownTmdbIds as number[]).length}):`, shownTmdbIds);

  // --- Monta parâmetros do /discover ---
  const params = new URLSearchParams({
    api_key:            apiKey,
    language:           'pt-BR',
    watch_region:       'BR',
    'vote_average.gte': '6.5',
    'vote_count.gte':   '80',
    sort_by:            'popularity.desc',
  });

  if (services.length > 0) {
    const ids = (services as string[]).flatMap(s => PROVIDER_IDS[s] ?? []);
    if (ids.length > 0) params.set('with_watch_providers', ids.join('|'));
  }

  // Filtro de duração (diferente para série e filme)
  if (isTV) {
    if (energy === 'ep_curto') {
      params.set('with_runtime.lte', '30');
    } else if (energy === 'ep_medio') {
      params.set('with_runtime.gte', '30');
      params.set('with_runtime.lte', '50');
    } else if (energy === 'ep_longo') {
      params.set('with_runtime.gte', '50');
    }
  } else {
    if (energy === 'baixo') params.set('with_runtime.lte', '100');
  }

  // Filtro de gênero
  if (genre) {
    const genreId = isTV ? TV_GENRE_IDS[genre] : GENRE_IDS[genre];
    if (genreId) params.set('with_genres', String(genreId));
  }

  // Filtro de época — parâmetros de data diferem entre filme e série
  const currentYear = new Date().getFullYear();
  const dateGte = isTV ? 'first_air_date.gte' : 'primary_release_date.gte';
  const dateLte = isTV ? 'first_air_date.lte' : 'primary_release_date.lte';

  if (epoch === 'novo') {
    params.set(dateGte, `${currentYear - 3}-01-01`);
  } else if (epoch === '2010s') {
    params.set(dateGte, '2010-01-01');
    params.set(dateLte, '2019-12-31');
  } else if (epoch === '2000s') {
    params.set(dateGte, '2000-01-01');
    params.set(dateLte, '2009-12-31');
  } else if (epoch === '90s') {
    params.set(dateGte, '1990-01-01');
    params.set(dateLte, '1999-12-31');
  } else if (epoch === 'classico') {
    params.set(dateLte, '1989-12-31');
  }

  const historyIds = shownTmdbIds as number[];
  const discoverBase = isTV
    ? 'https://api.themoviedb.org/3/discover/tv'
    : 'https://api.themoviedb.org/3/discover/movie';

  const startPage = Math.floor(Math.random() * 3) + 1;
  const pageOrder = [startPage, ...[1, 2, 3].filter(p => p !== startPage)];

  let allDiscovered: CandidateNorm[] = [];
  let candidates: CandidateNorm[] = [];

  for (const page of pageOrder) {
    params.set('page', String(page));
    const res = await fetch(`${discoverBase}?${params}`, { next: { revalidate: 300 } });
    if (!res.ok) break;

    const data = await res.json();
    // Normaliza campos de série (name/first_air_date) para o formato unificado
    const normalized: CandidateNorm[] = (data.results ?? []).map((r: Record<string, unknown>) => ({
      id:             r.id as number,
      title:          (isTV ? r.name : r.title) as string,
      original_title: (isTV ? r.original_name : r.original_title) as string,
      vote_average:   r.vote_average as number,
      genre_ids:      r.genre_ids as number[],
      overview:       r.overview as string,
      release_date:   (isTV ? r.first_air_date : r.release_date) as string,
    }));

    allDiscovered = [...allDiscovered, ...normalized];

    const pool = allDiscovered.filter(m => !shown.includes(m.title) && !shown.includes(m.original_title));
    const sessionFiltered = pool.length > 0 ? pool : allDiscovered;
    const histFiltered = historyIds.length > 0
      ? sessionFiltered.filter(m => !historyIds.includes(m.id))
      : sessionFiltered;

    console.log(`[recommend] página ${page}: ${normalized.length} resultados | histFiltered: ${histFiltered.length} | acumulado: ${allDiscovered.length}`);

    if (histFiltered.length >= 3) {
      candidates = histFiltered.slice(0, 15);
      break;
    }
  }

  if (candidates.length === 0) {
    const pool = allDiscovered.filter(m => !shown.includes(m.title) && !shown.includes(m.original_title));
    const sessionFiltered = pool.length > 0 ? pool : allDiscovered;
    candidates = sessionFiltered.slice(0, 15);
    console.log(`[recommend] histórico bloqueou todos — filtro removido, usando ${candidates.length} candidatos.`);
  }

  if (candidates.length === 0) {
    console.log('[recommend] zero candidatos — buscando sem filtros restritivos');
    const fallbackParams = new URLSearchParams({
      api_key:            apiKey,
      language:           'pt-BR',
      watch_region:       'BR',
      'vote_average.gte': '6.5',
      'vote_count.gte':   '200',
      sort_by:            'popularity.desc',
      page:               '1',
    });
    const fallbackRes = await fetch(`${discoverBase}?${fallbackParams}`, { next: { revalidate: 300 } });
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      candidates = ((fallbackData.results ?? []) as Record<string, unknown>[]).slice(0, 15).map(r => ({
        id:             r.id as number,
        title:          (isTV ? r.name : r.title) as string,
        original_title: (isTV ? r.original_name : r.original_title) as string,
        vote_average:   r.vote_average as number,
        genre_ids:      r.genre_ids as number[],
        overview:       r.overview as string,
        release_date:   (isTV ? r.first_air_date : r.release_date) as string,
      }));
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Nenhum resultado encontrado com esses filtros.' }, { status: 404 });
  }

  // --- Pede à Claude para escolher ---
  const claudeChoice = await askClaude(candidates, {
    feel, company, energy, genre, endings,
    favorites, likesPick, dislikesPick, loved, disliked,
  }, isTV);

  let pickedId: number;
  let claudePorque: string | undefined;

  if (claudeChoice && candidates.some(m => m.id === claudeChoice.tmdb_id_escolhido)) {
    pickedId = claudeChoice.tmdb_id_escolhido;
    claudePorque = claudeChoice.porque;
  } else {
    pickedId = [...candidates].sort((a, b) => b.vote_average - a.vote_average)[0].id;
  }

  const pick = candidates.find(m => m.id === pickedId) ?? candidates[0];

  // --- Busca detalhes ---
  const detailUrl = isTV
    ? `https://api.themoviedb.org/3/tv/${pick.id}?api_key=${apiKey}&language=pt-BR&append_to_response=watch/providers`
    : `https://api.themoviedb.org/3/movie/${pick.id}?api_key=${apiKey}&language=pt-BR&append_to_response=watch/providers`;

  const detailRes = await fetch(detailUrl, { next: { revalidate: 3600 } });

  if (!detailRes.ok) {
    return NextResponse.json({ error: 'Erro ao buscar detalhes.' }, { status: 502 });
  }

  const detailJson = await detailRes.json();
  const [cor1, cor2] = MOOD_COLORS[feel ?? ''] ?? ['#241B30', '#19131F'];

  const brFlat: TMDBProvider[] = detailJson['watch/providers']?.results?.BR?.flatrate ?? [];
  const matchedService = (services as string[]).find(s =>
    (PROVIDER_IDS[s] ?? []).some(id => brFlat.some((p: TMDBProvider) => p.provider_id === id))
  );

  if (isTV) {
    const detail = detailJson as TMDBTVDetail;
    const runTime = detail.episode_run_time?.[0] ?? 0;
    const duracao = runTime ? `${runTime}min/ep` : '';
    const onde_assistir = matchedService ?? brFlat[0]?.provider_name ?? 'verifique a disponibilidade';

    return NextResponse.json({
      tmdb_id:          detail.id,
      titulo:           detail.name,
      titulo_original:  detail.original_name,
      ano:              detail.first_air_date ? new Date(detail.first_air_date).getFullYear() : null,
      genero:           detail.genres?.map(g => g.name).join(', ') ?? '',
      duracao,
      sinopse:          detail.overview ?? '',
      poster_path:      detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
      tagline:          detail.tagline ?? '',
      porque:           claudePorque ?? PORQUE_MAP[feel ?? ''] ?? 'Uma ótima escolha pro seu momento.',
      onde_assistir,
      no_seu_streaming: !!matchedService,
      vote_average:     detail.vote_average ?? 0,
      vote_count:       detail.vote_count ?? 0,
      cor1,
      cor2,
      media_type:       'tv',
    });
  } else {
    const detail = detailJson as TMDBDetail;
    const onde_assistir =
      matchedService ??
      brFlat[0]?.provider_name ??
      detail['watch/providers']?.results?.BR?.rent?.[0]?.provider_name ??
      'verifique a disponibilidade';

    return NextResponse.json({
      tmdb_id:          detail.id,
      titulo:           detail.title,
      titulo_original:  detail.original_title,
      ano:              detail.release_date ? new Date(detail.release_date).getFullYear() : null,
      genero:           detail.genres?.map(g => g.name).join(', ') ?? '',
      duracao:          detail.runtime ? formatRuntime(detail.runtime) : '',
      sinopse:          detail.overview ?? '',
      poster_path:      detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
      tagline:          detail.tagline ?? '',
      porque:           claudePorque ?? PORQUE_MAP[feel ?? ''] ?? 'Uma ótima escolha pro seu momento.',
      onde_assistir,
      no_seu_streaming: !!matchedService,
      vote_average:     detail.vote_average ?? 0,
      vote_count:       detail.vote_count ?? 0,
      cor1,
      cor2,
      media_type:       'movie',
    });
  }
}

// --- Tipos internos ---
interface TMDBDetail {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  runtime: number | null;
  overview: string;
  tagline: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  'watch/providers'?: {
    results?: {
      BR?: {
        flatrate?: TMDBProvider[];
        rent?: TMDBProvider[];
        buy?: TMDBProvider[];
      };
    };
  };
}

interface TMDBTVDetail {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  episode_run_time: number[];
  overview: string;
  tagline: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  'watch/providers'?: {
    results?: {
      BR?: {
        flatrate?: TMDBProvider[];
        rent?: TMDBProvider[];
        buy?: TMDBProvider[];
      };
    };
  };
}

interface TMDBProvider {
  provider_id: number;
  provider_name: string;
}
