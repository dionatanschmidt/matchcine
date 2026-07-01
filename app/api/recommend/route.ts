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

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const limite = isLogged ? 50 : 10;

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
    commitment?: string;
    favorites?: string[]; likesPick?: string[]; dislikesPick?: string[];
    loved?: string[]; disliked?: string[];
    recentGenres?: number[];
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

  const feelLine = isTV
    ? `- Como está se sentindo: não informado (recomende com base em companhia + compromisso + episódio)`
    : `- Como está se sentindo: ${ctx.feel ?? '?'}`;

  const prefsLine = isTV
    ? `- Nível de compromisso: ${ctx.commitment ?? 'qualquer'}`
    : `- Tipo de final preferido: ${ctx.endings ?? 'sem preferência'}`;

  const prompt = `Você é um curador de ${mediaWord} especializado em combinar perfil, companhia e gênero.

MOMENTO DO USUÁRIO:
${feelLine}
- Com quem vai assistir: ${ctx.company ?? '?'}
- ${isTV ? 'Tamanho do episódio' : 'Nível de energia/fôlego'}: ${ctx.energy ?? '?'}
- Gênero desejado agora: ${ctx.genre ?? 'sem preferência'}
${prefsLine}
- Títulos/nomes que ama (⭐ peso 5): ${ctx.favorites?.join(', ') || '—'}
- Títulos que curtiu (❤️ peso 2): ${ctx.likesPick?.join(', ') || '—'}
- Títulos que não curtiu (👎 peso -3): ${ctx.dislikesPick?.join(', ') || '—'}
- ${isTV ? 'Séries' : 'Filmes'} amados nesta sessão (❤️ peso 2): ${ctx.loved?.join(', ') || '—'}
- ${isTV ? 'Séries' : 'Filmes'} rejeitados nesta sessão (👎 peso -3): ${ctx.disliked?.join(', ') || '—'}
${ctx.recentGenres?.length ? `- Gêneros das últimas recomendações (IDs TMDB, evite repetir): ${ctx.recentGenres.join(', ')}` : ''}

PESOS DE DECISÃO:
⭐ favorito = +5 | ❤️ gostei = +2 | 👎 não curti = -3
companhia + compromisso = peso 4 | gênero = peso 3 | duração do episódio = peso 2

${isTV ? 'SÉRIES' : 'FILMES'} DISPONÍVEIS:
${movieList}

INSTRUÇÃO DE DIVERSIDADE: Priorize DIVERSIDADE de gênero. Se o usuário gosta de ação, considere também aventura, suspense e ficção. Se os gêneros recentes forem repetidos, escolha algo diferente desta vez. Prefira títulos menos óbvios dentro do estilo do usuário.
INSTRUÇÃO DE LINGUAGEM: NUNCA use travessão (—) nas frases que gerar. Use ponto, vírgula, dois pontos ou reescreva a frase sem ele.

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
      const porque = parsed.porque.replace(/—/g, ',').replace(/–/g, ',');
      return { tmdb_id_escolhido: parsed.tmdb_id_escolhido, porque };
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

  // --- Autenticação via JWT (Authorization: Bearer <token>) ---
  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (!adminReady) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 401 });
    }
    userId = user.id;
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
    commitment,
    favorites    = [],
    likesPick    = [],
    dislikesPick = [],
    loved        = [],
    disliked     = [],
    epoch,
    country,
    sortType,
    certification,
    mediaType    = 'movie',
    deviceId,
    recentGenres = [],
    oscarFilter  = 'none',
  } = body as {
    services?: string[]; energy?: string; genre?: string; feel?: string;
    shown?: string[]; shownTmdbIds?: number[]; company?: string; endings?: string;
    commitment?: string;
    favorites?: string[]; likesPick?: string[]; dislikesPick?: string[];
    loved?: string[]; disliked?: string[]; epoch?: string;
    country?: string; sortType?: string; certification?: string;
    mediaType?: string; deviceId?: string; recentGenres?: number[];
    oscarFilter?: string;
  };

  // --- Exige deviceId para usuários anônimos ---
  if (userId === null && !deviceId) {
    return NextResponse.json({ error: 'deviceId obrigatório para usuários anônimos.' }, { status: 400 });
  }

  // --- Verifica limite de uso antes de qualquer chamada externa ---
  const { ok: dentroLimite, isLogged } = await verificarLimite(userId ?? undefined, deviceId);
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
      if (energy === 'curtinho') params.set('with_runtime.lte', '25');
      else if (energy === 'padrao') { params.set('with_runtime.gte', '25'); params.set('with_runtime.lte', '55'); }
      else if (energy === 'longo') params.set('with_runtime.gte', '55');
      // 'qualquer' → sem filtro de runtime
      if (commitment === 'mini') params.set('with_type', '2');
    } else {
      if (energy === 'baixo') params.set('with_runtime.lte', '90');
      else if (energy === 'medio') { params.set('with_runtime.gte', '90'); params.set('with_runtime.lte', '150'); }
      // 'alto' → sem filtro de runtime
    }

    if (genre) {
      const genreId = isTV ? TV_GENRE_IDS[genre] : GENRE_IDS[genre];
      if (genreId) params.set('with_genres', String(genreId));
    } else if (!isTV && feel) {
      // Sem gênero manual → humor define o filtro de gênero no TMDB (| = OR)
      const moodGenreIds: Record<string, string> = {
        cansado:   '35|10751|12|16', // comédia, família, aventura, animação
        agitado:   '18|36',       // drama, história
        entediado: '28|12|878',   // ação, aventura, ficção
        pra_baixo: '10751|35',    // família, comédia
        tranquilo: '',
        ligado:    '27|53',       // terror, suspense
      };
      const ids = moodGenreIds[feel];
      if (ids) params.set('with_genres', ids);
    }

    const currentYear = new Date().getFullYear();
    const dateGte = isTV ? 'first_air_date.gte' : 'primary_release_date.gte';
    const dateLte = isTV ? 'first_air_date.lte' : 'primary_release_date.lte';

    if (epoch === 'novo')    params.set(dateGte, `${currentYear - 3}-01-01`);
    else if (epoch === '2010s') { params.set(dateGte, '2010-01-01'); params.set(dateLte, '2019-12-31'); }
    else if (epoch === '2000s') { params.set(dateGte, '2000-01-01'); params.set(dateLte, '2009-12-31'); }
    else if (epoch === '90s')   { params.set(dateGte, '1990-01-01'); params.set(dateLte, '1999-12-31'); }
    else if (epoch === 'classico') params.set(dateLte, '1989-12-31');

    // Filtros adicionais do ⚙️
    if (country) {
      params.set('with_origin_country', country === 'EU' ? 'FR|DE|ES|IT|GB' : country);
    }

    if (sortType === 'pearl') {
      params.set('sort_by', 'vote_average.desc');
      params.set('vote_count.lte', '500');
      params.set('vote_count.gte', '50');
    }

    if ((company === 'familia_kids' || company === 'familia_criancas') && !certification) {
      params.set('certification_country', 'BR');
      params.set('certification.lte', '12');
    }

    if (certification) {
      params.set('certification_country', 'BR');
      params.set('certification.lte', certification);
    }

    const discoverBase = isTV
      ? 'https://api.themoviedb.org/3/discover/tv'
      : 'https://api.themoviedb.org/3/discover/movie';

    console.log('[recommend] TMDB params:', Object.fromEntries(params.entries()));

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
      console.log(`[recommend] pg ${page}: ${normalized.length} resultados | total: ${allDiscovered.length}`);
    }

    // Build candidates: filtrar histórico, embaralhar e pegar até 40 para diversidade
    {
      const pool = allDiscovered.filter(
        m => !(shown as string[]).includes(m.title) && !(shown as string[]).includes(m.original_title)
      );
      const sessionFiltered = pool.length > 0 ? pool : allDiscovered;
      const histFiltered    = historyIds.length > 0
        ? sessionFiltered.filter(m => !historyIds.includes(m.id))
        : sessionFiltered;
      const candidatePool   = histFiltered.length > 0 ? histFiltered : sessionFiltered;
      candidates = shuffleArray(candidatePool).slice(0, 40);
      console.log(`[recommend] candidatos após shuffle: ${candidates.length}`);
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
        candidates = ((fallbackData.results ?? []) as Record<string, unknown>[]).slice(0, 20).map(r => ({
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

    // Filtro Oscar via OMDB (limitado a 10 candidatos para não estourar quota)
    if (oscarFilter && oscarFilter !== 'none' && candidates.length > 0) {
      const omdbKey = process.env.OMDB_API_KEY;
      if (omdbKey) {
        const toCheck = candidates.slice(0, 10);
        const results = await Promise.all(
          toCheck.map(async c => {
            try {
              const res = await fetch(
                `https://www.omdbapi.com/?t=${encodeURIComponent(c.title)}&apikey=${omdbKey}`,
                { next: { revalidate: 3600 } }
              );
              const data = await res.json();
              const awards: string = data.Awards ?? '';
              if (oscarFilter === 'winner') return /won\s+\d*\s*oscar|won\s+\d*\s*academy award/i.test(awards) ? c : null;
              if (oscarFilter === 'nominated') return /oscar|academy award/i.test(awards) ? c : null;
              return c;
            } catch {
              return c;
            }
          })
        );
        const filtered = results.filter(Boolean) as typeof candidates;
        if (filtered.length > 0) {
          candidates = filtered;
          console.log(`[recommend] filtro Oscar (${oscarFilter}): ${candidates.length} candidatos`);
        }
      }
    }

    // Decide o motor baseado no perfil do usuário
    const motor = decidirMotor({ favorites, likesPick, dislikesPick, loved, disliked });
    console.log(`[recommend] motor=${motor}`);

    if (motor === 'claude') {
      const claudeChoice = await askClaude(candidates, {
        feel, company, energy, genre, endings, commitment,
        favorites, likesPick, dislikesPick, loved, disliked,
        recentGenres: recentGenres as number[],
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
  incrementarContagem(userId ?? undefined, deviceId).catch(() => {});

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
      seasons:          detail.number_of_seasons ?? null,
      genre_ids:        detail.genres?.map(g => g.id) ?? [],
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
      genre_ids:        detail.genres?.map(g => g.id) ?? [],
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
  number_of_seasons: number;
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
