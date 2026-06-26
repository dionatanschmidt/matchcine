import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin, adminReady } from '@/lib/supabase-admin';

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

// Mapa humor → gêneros preferidos para o motor de regras (sem IA)
// Usado quando o perfil está vazio (sem favoritos nem histórico de avaliações)
const MOOD_GENRE_MAP: Record<string, string[]> = {
  cansado:   ['Comédia', 'Animação'],
  agitado:   ['Drama'],
  entediado: ['Ação', 'Suspense', 'Aventura'],
  pra_baixo: ['Comédia', 'Romance', 'Animação'],
  tranquilo: [],  // qualquer gênero
  ligado:    ['Ação', 'Terror'],
};

// Banco de frases variadas por humor — usadas pelo motor de regras e em cache hits
const PORQUE_BANK: Record<string, string[]> = {
  cansado: [
    'Leve e fácil pra desligar a cabeça.',
    'Sem esforço, só pra relaxar.',
    'Perfeito pra quando o cérebro já mandou parar.',
    'Entra fácil e sai com um sorriso.',
  ],
  agitado: [
    'Vai te ajudar a desacelerar sem perceber.',
    'Ritmo que convida a respirar fundo.',
    'Aquele tipo que acalma sem ser chato.',
    'Pra baixar a guarda e deixar fluir.',
  ],
  entediado: [
    'Do tipo que prende do início ao fim.',
    'Impossível olhar pro celular no meio.',
    'Aquela energia que tira você do tédio na hora.',
    'Envolve e não deixa soltar.',
  ],
  pra_baixo: [
    'Vai te fazer sentir — de um jeito bom.',
    'Aquele que deixa um sorriso no rosto.',
    'Reconfortante sem ser piegas.',
    'Levanta o astral do jeito certo.',
  ],
  tranquilo: [
    'Combina com o seu momento aberto de hoje.',
    'Uma boa escolha pra qualquer clima.',
    'Versátil e bem avaliado — vale a pena.',
    'Exatamente o tipo certo pra agora.',
  ],
  ligado: [
    'Adrenalina pura pra quem topa intensidade.',
    'Sem freio do início ao fim.',
    'Intenso exatamente do jeito que você pediu.',
    'Pra quem quer sentir o coração acelerar.',
  ],
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

// Decide o motor de recomendação.
// 'regras': perfil vazio — sem favoritos nem histórico de avaliações pessoais.
//   Escolhe pelo maior rating do TMDB no gênero mapeado ao humor. Sem custo de IA.
// 'claude': perfil rico — tem favoritos ou histórico que permitem personalização.
//   Envia candidatos para a Claude Haiku selecionar e justificar.
function decidirMotor(body: {
  favorites: string[];
  likesPick: string[];
  dislikesPick: string[];
  loved: string[];
  disliked: string[];
}): 'regras' | 'claude' {
  const temFavoritos = body.favorites.length > 0;
  const temHistorico =
    body.likesPick.length > 0 || body.dislikesPick.length > 0 ||
    body.loved.length > 0    || body.disliked.length > 0;
  return (temFavoritos || temHistorico) ? 'claude' : 'regras';
}

// Motor de regras: pega o candidato com maior nota do TMDB que bate com o humor.
// Sem chamada a IA — usa o banco de frases locais.
function escolherPorRegras(
  candidates: CandidateNorm[],
  feel: string,
  isTV: boolean
): { tmdb_id: number; porque: string } {
  const moodGenres  = MOOD_GENRE_MAP[feel] ?? [];
  const genreMap    = isTV ? TV_GENRE_IDS : GENRE_IDS;
  const moodGenreIds = moodGenres.map(g => genreMap[g]).filter(Boolean);

  let pool = moodGenreIds.length > 0
    ? candidates.filter(c => c.genre_ids.some(id => moodGenreIds.includes(id)))
    : candidates;
  if (pool.length === 0) pool = candidates;

  const best = [...pool].sort((a, b) => b.vote_average - a.vote_average)[0];
  const frases = PORQUE_BANK[feel] ?? PORQUE_BANK['tranquilo'];
  const porque = frases[Math.floor(Math.random() * frases.length)];

  return { tmdb_id: best.id, porque };
}

// Gera chave determinística de contexto para o cache.
// Composta por: mediaType | humor | companhia | fôlego | gênero | época | streamings ordenados
function gerarChaveContexto(p: {
  mediaType: string; feel: string; company: string;
  energy: string; genre: string; epoch: string; services: string[];
}): string {
  return [
    p.mediaType, p.feel || '_', p.company || '_',
    p.energy || '_', p.genre || '_', p.epoch || '_',
    [...p.services].sort().join(','),
  ].join('|');
}

// Consulta o cache: retorna o primeiro tmdb_id válido não visto pelo usuário.
// Cache é válido por 7 dias e compartilhado entre todos os usuários.
async function buscarCache(chave: string, shownIds: number[]): Promise<number | null> {
  if (!adminReady) return null;
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from('cache_recomendacoes')
    .select('filmes')
    .eq('chave_contexto', chave)
    .gte('criado_em', seteDiasAtras)
    .maybeSingle();

  if (!Array.isArray(data?.filmes) || data.filmes.length === 0) return null;
  return (data.filmes as number[]).find(id => !shownIds.includes(id)) ?? null;
}

// Adiciona o tmdb_id gerado ao pool de cache para este contexto.
async function salvarNoCache(chave: string, mediaType: string, tmdbId: number): Promise<void> {
  if (!adminReady) return;

  const { data } = await supabaseAdmin
    .from('cache_recomendacoes')
    .select('filmes')
    .eq('chave_contexto', chave)
    .maybeSingle();

  const existentes = Array.isArray(data?.filmes) ? (data.filmes as number[]) : [];
  if (existentes.includes(tmdbId)) return;

  await supabaseAdmin.from('cache_recomendacoes').upsert(
    {
      chave_contexto: chave,
      media_type:     mediaType,
      filmes:         [...existentes, tmdbId],
      criado_em:      new Date().toISOString(),
    },
    { onConflict: 'chave_contexto' }
  );
}

// Verifica o limite diário sem incrementar (consulta antes de gastar tokens).
async function verificarLimite(
  userId?: string,
  deviceId?: string
): Promise<{ ok: boolean; isLogged: boolean }> {
  const isLogged = !!userId;
  if (!adminReady || (!userId && !deviceId)) return { ok: true, isLogged };

  const hoje  = new Date().toISOString().slice(0, 10);
  const limite = isLogged ? 20 : 5;

  const { data } = userId
    ? await supabaseAdmin.from('uso_diario').select('contagem').eq('usuario_id', userId).eq('data', hoje).maybeSingle()
    : await supabaseAdmin.from('uso_diario').select('contagem').eq('device_id', deviceId!).eq('data', hoje).maybeSingle();

  return { ok: (data?.contagem ?? 0) < limite, isLogged };
}

// Incrementa a contagem apenas após geração bem-sucedida de recomendação.
async function incrementarContagem(userId?: string, deviceId?: string): Promise<void> {
  if (!adminReady || (!userId && !deviceId)) return;

  const hoje = new Date().toISOString().slice(0, 10);

  const { data } = userId
    ? await supabaseAdmin.from('uso_diario').select('id, contagem').eq('usuario_id', userId).eq('data', hoje).maybeSingle()
    : await supabaseAdmin.from('uso_diario').select('id, contagem').eq('device_id', deviceId!).eq('data', hoje).maybeSingle();

  if (data?.id) {
    await supabaseAdmin.from('uso_diario').update({ contagem: (data.contagem ?? 0) + 1 }).eq('id', data.id);
  } else if (userId) {
    await supabaseAdmin.from('uso_diario').insert({ usuario_id: userId, data: hoje, contagem: 1 });
  } else if (deviceId) {
    await supabaseAdmin.from('uso_diario').insert({ device_id: deviceId, data: hoje, contagem: 1 });
  }
}

async function askClaude(
  candidates: CandidateNorm[],
  ctx: {
    feel?: string; company?: string; energy?: string; genre?: string; endings?: string;
    favorites?: string[]; likesPick?: string[]; dislikesPick?: string[];
    loved?: string[]; disliked?: string[];
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
      const genres  = m.genre_ids.map(id => genreNamesMap[id]).filter(Boolean).join(', ');
      const year    = m.release_date ? new Date(m.release_date).getFullYear() : '?';
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
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text   = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const {
    services     = [],
    energy,
    genre,
    feel,
    shown        = [],
    shownTmdbIds = [],
    company,
    endings,
    favorites    = [],
    likesPick    = [],
    dislikesPick = [],
    loved        = [],
    disliked     = [],
    epoch,
    mediaType    = 'movie',
    userId,
    deviceId,
  } = body as {
    services?: string[]; energy?: string; genre?: string; feel?: string;
    shown?: string[]; shownTmdbIds?: number[]; company?: string; endings?: string;
    favorites?: string[]; likesPick?: string[]; dislikesPick?: string[];
    loved?: string[]; disliked?: string[]; epoch?: string; mediaType?: string;
    userId?: string; deviceId?: string;
  };

  // --- Verifica limite de uso antes de qualquer chamada externa ---
  const { ok: dentroLimite, isLogged } = await verificarLimite(userId, deviceId);
  if (!dentroLimite) {
    return NextResponse.json({ error: 'limite_atingido', isLogged }, { status: 429 });
  }

  const isTV = mediaType === 'tv';
  console.log(`[recommend] mediaType=${mediaType} | shownTmdbIds (${(shownTmdbIds as number[]).length})`);

  // --- Chave de cache para este contexto ---
  const chaveContexto = gerarChaveContexto({
    mediaType: mediaType ?? 'movie',
    feel:      feel    ?? '',
    company:   company ?? '',
    energy:    energy  ?? '',
    genre:     genre   ?? '',
    epoch:     epoch   ?? '',
    services:  services as string[],
  });

  const historyIds = shownTmdbIds as number[];

  // --- Tenta cache antes de chamar TMDB ou Claude ---
  const cachedId = await buscarCache(chaveContexto, historyIds);
  let pickedId: number | null = cachedId;
  let pickedPorque: string | undefined;

  if (cachedId !== null) {
    console.log(`[recommend] cache hit: tmdb_id=${cachedId}`);
    const frases = PORQUE_BANK[feel ?? ''] ?? PORQUE_BANK['tranquilo'];
    pickedPorque = frases[Math.floor(Math.random() * frases.length)];
  }

  // --- Sem cache: descobre candidatos no TMDB e escolhe via motor ---
  if (pickedId === null) {
    const params = new URLSearchParams({
      api_key:            apiKey,
      language:           'pt-BR',
      watch_region:       'BR',
      'vote_average.gte': '6.5',
      'vote_count.gte':   '80',
      sort_by:            'popularity.desc',
    });

    if ((services as string[]).length > 0) {
      const ids = (services as string[]).flatMap(s => PROVIDER_IDS[s] ?? []);
      if (ids.length > 0) params.set('with_watch_providers', ids.join('|'));
    }

    if (isTV) {
      if (energy === 'ep_curto') params.set('with_runtime.lte', '30');
      else if (energy === 'ep_medio') { params.set('with_runtime.gte', '30'); params.set('with_runtime.lte', '50'); }
      else if (energy === 'ep_longo') params.set('with_runtime.gte', '50');
    } else {
      if (energy === 'baixo') params.set('with_runtime.lte', '100');
    }

    if (genre) {
      const genreId = isTV ? TV_GENRE_IDS[genre] : GENRE_IDS[genre];
      if (genreId) params.set('with_genres', String(genreId));
    }

    const currentYear = new Date().getFullYear();
    const dateGte = isTV ? 'first_air_date.gte' : 'primary_release_date.gte';
    const dateLte = isTV ? 'first_air_date.lte' : 'primary_release_date.lte';

    if (epoch === 'novo')    params.set(dateGte, `${currentYear - 3}-01-01`);
    else if (epoch === '2010s') { params.set(dateGte, '2010-01-01'); params.set(dateLte, '2019-12-31'); }
    else if (epoch === '2000s') { params.set(dateGte, '2000-01-01'); params.set(dateLte, '2009-12-31'); }
    else if (epoch === '90s')   { params.set(dateGte, '1990-01-01'); params.set(dateLte, '1999-12-31'); }
    else if (epoch === 'classico') params.set(dateLte, '1989-12-31');

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

      const pool = allDiscovered.filter(
        m => !(shown as string[]).includes(m.title) && !(shown as string[]).includes(m.original_title)
      );
      const sessionFiltered = pool.length > 0 ? pool : allDiscovered;
      const histFiltered    = historyIds.length > 0
        ? sessionFiltered.filter(m => !historyIds.includes(m.id))
        : sessionFiltered;

      console.log(`[recommend] pg ${page}: ${normalized.length} resultados | histFiltered: ${histFiltered.length}`);

      if (histFiltered.length >= 3) {
        candidates = histFiltered.slice(0, 15);
        break;
      }
    }

    if (candidates.length === 0) {
      const pool = allDiscovered.filter(
        m => !(shown as string[]).includes(m.title) && !(shown as string[]).includes(m.original_title)
      );
      candidates = (pool.length > 0 ? pool : allDiscovered).slice(0, 15);
      console.log(`[recommend] histórico bloqueou todos — usando ${candidates.length} candidatos sem filtro de histórico.`);
    }

    if (candidates.length === 0) {
      console.log('[recommend] zero candidatos — buscando sem filtros restritivos');
      const fallbackParams = new URLSearchParams({
        api_key: apiKey, language: 'pt-BR', watch_region: 'BR',
        'vote_average.gte': '6.5', 'vote_count.gte': '200',
        sort_by: 'popularity.desc', page: '1',
      });
      const fallbackRes = await fetch(`${discoverBase}?${fallbackParams}`, { next: { revalidate: 300 } });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        candidates = ((fallbackData.results ?? []) as Record<string, unknown>[]).slice(0, 15).map(r => ({
          id: r.id as number,
          title: (isTV ? r.name : r.title) as string,
          original_title: (isTV ? r.original_name : r.original_title) as string,
          vote_average: r.vote_average as number,
          genre_ids:    r.genre_ids as number[],
          overview:     r.overview as string,
          release_date: (isTV ? r.first_air_date : r.release_date) as string,
        }));
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'Nenhum resultado encontrado com esses filtros.' }, { status: 404 });
    }

    // Decide o motor baseado no perfil do usuário
    const motor = decidirMotor({ favorites, likesPick, dislikesPick, loved, disliked });
    console.log(`[recommend] motor=${motor}`);

    if (motor === 'claude') {
      const claudeChoice = await askClaude(candidates, {
        feel, company, energy, genre, endings,
        favorites, likesPick, dislikesPick, loved, disliked,
      }, isTV);
      if (claudeChoice && candidates.some(m => m.id === claudeChoice.tmdb_id_escolhido)) {
        pickedId     = claudeChoice.tmdb_id_escolhido;
        pickedPorque = claudeChoice.porque;
      }
    } else {
      const regrasChoice = escolherPorRegras(candidates, feel ?? 'tranquilo', isTV);
      pickedId     = regrasChoice.tmdb_id;
      pickedPorque = regrasChoice.porque;
    }

    // Fallback para o mais bem avaliado se o motor retornou vazio
    if (pickedId === null) {
      pickedId = [...candidates].sort((a, b) => b.vote_average - a.vote_average)[0].id;
    }

    // Persiste no cache (assíncrono — não bloqueia a resposta)
    salvarNoCache(chaveContexto, mediaType ?? 'movie', pickedId).catch(() => {});
  }

  const porque = pickedPorque ?? (() => {
    const frases = PORQUE_BANK[feel ?? ''] ?? PORQUE_BANK['tranquilo'];
    return frases[Math.floor(Math.random() * frases.length)];
  })();

  // --- Busca detalhes completos do título escolhido ---
  const detailUrl = isTV
    ? `https://api.themoviedb.org/3/tv/${pickedId}?api_key=${apiKey}&language=pt-BR&append_to_response=watch/providers`
    : `https://api.themoviedb.org/3/movie/${pickedId}?api_key=${apiKey}&language=pt-BR&append_to_response=watch/providers`;

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

  // Incrementa contador após geração bem-sucedida (não bloqueia resposta)
  incrementarContagem(userId, deviceId).catch(() => {});

  if (isTV) {
    const detail  = detailJson as TMDBTVDetail;
    const runTime = detail.episode_run_time?.[0] ?? 0;
    return NextResponse.json({
      tmdb_id:          detail.id,
      titulo:           detail.name,
      titulo_original:  detail.original_name,
      ano:              detail.first_air_date ? new Date(detail.first_air_date).getFullYear() : null,
      genero:           detail.genres?.map(g => g.name).join(', ') ?? '',
      duracao:          runTime ? `${runTime}min/ep` : '',
      sinopse:          detail.overview ?? '',
      poster_path:      detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
      tagline:          detail.tagline ?? '',
      porque,
      onde_assistir:    matchedService ?? brFlat[0]?.provider_name ?? 'verifique a disponibilidade',
      no_seu_streaming: !!matchedService,
      vote_average:     detail.vote_average ?? 0,
      vote_count:       detail.vote_count ?? 0,
      cor1, cor2,
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
      porque,
      onde_assistir,
      no_seu_streaming: !!matchedService,
      vote_average:     detail.vote_average ?? 0,
      vote_count:       detail.vote_count ?? 0,
      cor1, cor2,
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
