import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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

// IDs de gênero no TMDB
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

// Mapa reverso: ID de gênero → nome (usado para montar o prompt da Claude)
const GENRE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([name, id]) => [id, name])
);

// Cores de fallback por humor (usadas enquanto o pôster carrega)
const MOOD_COLORS: Record<string, [string, string]> = {
  cansado:   ['#1b2436', '#3a3550'],
  agitado:   ['#2a1b36', '#542f3f'],
  entediado: ['#162a2e', '#2f5246'],
  pra_baixo: ['#1a2230', '#445a6e'],
  tranquilo: ['#1e2a22', '#4a6b52'],
  ligado:    ['#2e1414', '#6b2f2f'],
};

// Texto de "porquê" de reserva (quando a Claude não está disponível)
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

// --- Motor de recomendação: pede à Claude para escolher um filme da lista ---
async function askClaude(
  candidates: TMDBMovie[],
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
  }
): Promise<{ tmdb_id_escolhido: number; porque: string } | null> {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey || claudeKey === 'COLOQUE_SUA_CHAVE_AQUI') return null;

  const client = new Anthropic({ apiKey: claudeKey });

  // Formata cada filme em uma linha legível para a Claude
  const movieList = candidates
    .map(m => {
      const genres = m.genre_ids.map(id => GENRE_NAMES[id]).filter(Boolean).join(', ');
      const year = m.release_date ? new Date(m.release_date).getFullYear() : '?';
      const snippet = m.overview
        ? m.overview.slice(0, 130) + (m.overview.length > 130 ? '…' : '')
        : '';
      return `• ID ${m.id}: "${m.title}" (${year}) | Gêneros: ${genres || 'N/A'} | Nota: ${m.vote_average.toFixed(1)} | ${snippet}`;
    })
    .join('\n');

  const prompt = `Você é um curador de filmes especializado em combinar humor, companhia e gênero cinematográfico.

MOMENTO DO USUÁRIO:
- Como está se sentindo: ${ctx.feel ?? '?'}
- Com quem vai assistir: ${ctx.company ?? '?'}
- Fôlego para filme: ${ctx.energy ?? '?'}
- Gênero desejado agora: ${ctx.genre ?? 'sem preferência'}
- Tipo de final preferido: ${ctx.endings ?? 'sem preferência'}
- Títulos/nomes que ama (⭐ peso 5): ${ctx.favorites?.join(', ') || '—'}
- Títulos que curtiu (❤️ peso 2): ${ctx.likesPick?.join(', ') || '—'}
- Títulos que não curtiu (👎 peso -3): ${ctx.dislikesPick?.join(', ') || '—'}
- Filmes amados nesta sessão (❤️ peso 2): ${ctx.loved?.join(', ') || '—'}
- Filmes rejeitados nesta sessão (👎 peso -3): ${ctx.disliked?.join(', ') || '—'}

PESOS DE DECISÃO:
⭐ favorito = +5 | ❤️ gostei = +2 | 👎 não curti = -3
humor + companhia combinados = peso 4 | gênero = peso 3 | fôlego/duração = peso 2

FILMES DISPONÍVEIS:
${movieList}

REGRA ABSOLUTA: escolha SOMENTE um filme da lista acima. Nunca invente nem sugira filmes fora dela.

Responda APENAS com JSON válido, sem markdown, sem texto extra:
{"tmdb_id_escolhido": <id numérico inteiro>, "porque": "<frase de 1-2 linhas em português do Brasil explicando por que esse filme combina com o momento do usuário>"}`;

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
  } = body;

  // --- Monta parâmetros do /discover/movie ---
  const params = new URLSearchParams({
    api_key:            apiKey,
    language:           'pt-BR',
    watch_region:       'BR',
    'vote_average.gte': '6.5',
    'vote_count.gte':   '80',
    sort_by:            'popularity.desc',
    page:               String(Math.floor(Math.random() * 3) + 1), // variedade
  });

  // Provedores selecionados pelo usuário
  if (services.length > 0) {
    const ids = (services as string[]).flatMap(s => PROVIDER_IDS[s] ?? []);
    if (ids.length > 0) {
      params.set('with_watch_providers', ids.join('|'));
    }
  }

  // Fôlego baixo → filmes curtos (≤ 100 min)
  if (energy === 'baixo') {
    params.set('with_runtime.lte', '100');
  }

  // Gênero escolhido pelo usuário
  if (genre && GENRE_IDS[genre]) {
    params.set('with_genres', String(GENRE_IDS[genre]));
  }

  // --- Chamada 1: lista de filmes do TMDB ---
  const discoverRes = await fetch(
    `https://api.themoviedb.org/3/discover/movie?${params}`,
    { next: { revalidate: 300 } }  // cache de 5 min no servidor
  );

  if (!discoverRes.ok) {
    return NextResponse.json({ error: 'Erro ao buscar filmes no TMDB.' }, { status: 502 });
  }

  const discoverData = await discoverRes.json();
  const results: TMDBMovie[] = discoverData.results ?? [];

  if (results.length === 0) {
    return NextResponse.json({ error: 'Nenhum filme encontrado com esses filtros.' }, { status: 404 });
  }

  // Remove filmes já mostrados nesta sessão
  const pool = results.filter(m => !shown.includes(m.title) && !shown.includes(m.original_title));
  const sessionFiltered = pool.length > 0 ? pool : results;

  // Remove filmes já avaliados em sessões anteriores (histórico do banco)
  const historyIds = shownTmdbIds as number[];
  const historyFiltered = historyIds.length > 0
    ? sessionFiltered.filter(m => !historyIds.includes(m.id))
    : sessionFiltered;

  // Garante pelo menos 3 opções para a Claude; se não, ignora o filtro de histórico
  const candidates = (historyFiltered.length >= 3 ? historyFiltered : sessionFiltered).slice(0, 15);

  // --- Fase 3: pede à Claude para escolher o melhor filme ---
  const claudeChoice = await askClaude(candidates, {
    feel, company, energy, genre, endings,
    favorites, likesPick, dislikesPick, loved, disliked,
  });

  // Valida que a Claude devolveu um ID que existe na lista; se não, usa o melhor avaliado
  let pickedId: number;
  let claudePorque: string | undefined;

  if (claudeChoice && candidates.some(m => m.id === claudeChoice.tmdb_id_escolhido)) {
    pickedId = claudeChoice.tmdb_id_escolhido;
    claudePorque = claudeChoice.porque;
  } else {
    // Reserva: filme com maior nota na lista
    pickedId = [...candidates].sort((a, b) => b.vote_average - a.vote_average)[0].id;
  }

  const pick = candidates.find(m => m.id === pickedId) ?? candidates[0];

  // --- Chamada 2: detalhes + provedores do filme escolhido ---
  const detailRes = await fetch(
    `https://api.themoviedb.org/3/movie/${pick.id}?api_key=${apiKey}&language=pt-BR&append_to_response=watch/providers`,
    { next: { revalidate: 3600 } }
  );

  if (!detailRes.ok) {
    return NextResponse.json({ error: 'Erro ao buscar detalhes do filme.' }, { status: 502 });
  }

  const detail: TMDBDetail = await detailRes.json();

  // Descobre em qual streaming do usuário o filme está (BR, flatrate = assinatura)
  const brFlat: TMDBProvider[] = detail['watch/providers']?.results?.BR?.flatrate ?? [];
  const matchedService = (services as string[]).find(s =>
    (PROVIDER_IDS[s] ?? []).some(id => brFlat.some(p => p.provider_id === id))
  );
  const onde_assistir =
    matchedService ??
    brFlat[0]?.provider_name ??
    detail['watch/providers']?.results?.BR?.rent?.[0]?.provider_name ??
    'verifique a disponibilidade';

  const [cor1, cor2] = MOOD_COLORS[feel ?? ''] ?? ['#241B30', '#19131F'];

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
    cor1,
    cor2,
  });
}

// --- Tipos internos do TMDB ---
interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  vote_average: number;
  genre_ids: number[];
  overview: string;
  release_date: string;
}

interface TMDBDetail {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  runtime: number | null;
  overview: string;
  tagline: string;
  poster_path: string | null;
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
