'use client';
import { useState, useRef, useEffect } from 'react';
import type { AppState, Movie } from '@/lib/types';
import { FALLBACK, OPPOSITE, MOODCOLORS } from '@/lib/data';
import { supabase, supabaseReady } from '@/lib/supabase';
import { loadProfile, saveProfile, loadAvaliacoes, saveAvaliacao } from '@/lib/db';
import { loadLocal, saveLocal, clearLocal, getOrCreateDeviceId, incrementLocalDailyCount, type AnonState } from '@/lib/storage';
import WelcomeScreen   from './screens/WelcomeScreen';
import LimitScreen     from './screens/LimitScreen';
import OnboardScreen   from './screens/OnboardScreen';
import ContextScreen   from './screens/ContextScreen';
import LoadingScreen   from './screens/LoadingScreen';
import ResultScreen    from './screens/ResultScreen';
import DoneScreen      from './screens/DoneScreen';
import SaveNudge       from './SaveNudge';

const initialState: AppState = {
  view:         'welcome',   // nunca force tela de login
  mediaType:    'movie',
  services:     [],
  likes:        [],
  dislikes:     [],
  likesPick:    [],
  dislikesPick: [],
  favorites:    [],
  endings:      null,
  tasteQueue:   [],
  tasteHistory: [],
  board:        [],
  tasteInit:    false,
  ctx:          { feel: null, company: null, energy: null, genre: null },
  express:      false,
  opposite:     false,
  oppositeOf:   null,
  loved:        [],
  disliked:     [],
  shown:        [],
  shownIds:     [],
  watchedCount: 0,
  current:      null,
  epoch:        null,
  country:      null,
  sortType:     null,
  certification: null,
  step:         0,
  onboardStep:  0,
  commitment:   null,
  unseen:       [],
  userId:           null,
  userEmail:        null,
  profileLoaded:    false,
  historicoDB:      [],
  localAvaliacoes:  [],
  nudgeDismissed:   false,
  limitIsLogged:    false,
};

export default function SessaoApp() {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = (patch: Partial<AppState>) =>
    setState(prev => ({ ...prev, ...patch }));

  // ── Inicialização: localStorage (anônimo) ou Supabase (logado) ──────────
  useEffect(() => {
    if (!supabaseReady) {
      // Sem Supabase configurado: apenas restaura do localStorage
      const local = loadLocal();
      if (local) applyLocalState(local);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleLogin(session.user.id, session.user.email ?? null);
      } else {
        const local = loadLocal();
        if (local) applyLocalState(local);  // anônimo com dados salvos
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleLogin(session.user.id, session.user.email ?? null);
      }
      if (event === 'SIGNED_OUT') {
        setState({ ...initialState });
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persiste no localStorage sempre que dados relevantes mudarem ─────────
  useEffect(() => {
    if (state.userId) return; // logado → Supabase cuida disso
    saveLocal({
      services:        state.services,
      likesPick:       state.likesPick,
      favorites:       state.favorites,
      dislikesPick:    state.dislikesPick,
      endings:         state.endings,
      localAvaliacoes: state.localAvaliacoes,
      watchedCount:    state.watchedCount,
      nudgeDismissed:  state.nudgeDismissed,
    });
  }, [
    state.services, state.likesPick, state.favorites, state.dislikesPick,
    state.endings, state.localAvaliacoes, state.watchedCount,
    state.nudgeDismissed, state.userId,
  ]);

  // Restaura estado anônimo do localStorage
  const applyLocalState = (local: AnonState) => {
    const hasPrefs = (local.services?.length ?? 0) > 0 || (local.likesPick?.length ?? 0) > 0;
    const loved    = (local.localAvaliacoes ?? []).filter(a => a.veredito === 'amei').map(a => a.titulo);
    const disliked = (local.localAvaliacoes ?? []).filter(a => a.veredito === 'nao_curti').map(a => a.titulo);
    update({
      services:        local.services        ?? [],
      likesPick:       local.likesPick       ?? [],
      favorites:       local.favorites       ?? [],
      dislikesPick:    local.dislikesPick    ?? [],
      endings:         local.endings         ?? null,
      localAvaliacoes: local.localAvaliacoes ?? [],
      watchedCount:    local.watchedCount    ?? 0,
      nudgeDismissed:  local.nudgeDismissed  ?? false,
      loved,
      disliked,
      view: hasPrefs ? 'context' : 'welcome',
      step: 0,
    });
  };

  // Carrega perfil do Supabase após login (inclusive migração pós-nudge)
  const handleLogin = async (userId: string, email?: string | null) => {
    if (stateRef.current.userId === userId) return;
    update({ userId, userEmail: email ?? null, view: 'loading' });
    clearLocal(); // localStorage já migrado pelo callback; limpa de todo jeito

    const [profile, avaliacoes] = await Promise.all([
      loadProfile(userId),
      loadAvaliacoes(userId),
    ]);

    const historicoDB = avaliacoes;
    const dbLoved     = historicoDB.filter(a => a.veredito === 'amei').map(a => a.titulo);
    const dbDisliked  = historicoDB.filter(a => a.veredito === 'nao_curti').map(a => a.titulo);

    if (profile) {
      update({
        userId,
        userEmail:       email ?? null,
        profileLoaded:   true,
        services:        profile.streamings       ?? [],
        likesPick:       profile.ama              ?? [],
        favorites:       profile.favoritos        ?? [],
        dislikesPick:    profile.evita            ?? [],
        endings:         profile.final_preferido  ?? null,
        historicoDB,
        loved:           dbLoved,
        disliked:        dbDisliked,
        localAvaliacoes: [],
        nudgeDismissed:  true,  // logado → nunca mostra o nudge
        view:            'context',
        step:            0,
      });
    } else {
      // Novo usuário no Supabase: vai para o onboarding
      update({
        userId,
        userEmail:       email ?? null,
        profileLoaded:   false,
        historicoDB,
        localAvaliacoes: [],
        nudgeDismissed:  true,
        view:            'welcome',
      });
    }
  };

  // Salva perfil no Supabase ao concluir onboarding
  const finishOnboard = async (endings?: string) => {
    const s = stateRef.current;
    const finalEndings = endings ?? s.endings;
    update({ endings: finalEndings, view: 'context', step: 0 });

    if (s.userId) {
      saveProfile(s.userId, {
        streamings:      s.services,
        ama:             s.likesPick,
        favoritos:       s.favorites,
        evita:           s.dislikesPick,
        final_preferido: finalEndings ?? null,
      }).catch(() => {});
    }
  };

  // Registra avaliação — Supabase se logado, localStorage se anônimo
  const saveRating = (movie: Movie, veredito: string) => {
    if (!movie.tmdb_id) return; // filmes de fallback sem ID não são registrados
    const s = stateRef.current;
    const avaliacao = {
      tmdb_id:          movie.tmdb_id,
      titulo:           movie.titulo,
      veredito,
      humor_no_momento: s.ctx.feel,
    };

    if (s.userId) {
      saveAvaliacao(s.userId, avaliacao).catch(() => {});
    } else {
      update({ localAvaliacoes: [...s.localAvaliacoes, avaliacao] });
    }
  };

  const recommend = async (overrides?: Partial<AppState>) => {
    const s = { ...stateRef.current, ...overrides };
    setState(prev => ({ ...prev, ...overrides, view: 'loading' }));

    let movie: Movie | null = null;

    try {
      const deviceId = getOrCreateDeviceId();

      // Autentica via JWT no header — nunca expõe userId no body
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (supabaseReady) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          reqHeaders['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          services:     s.services,
          energy:       s.ctx.energy,
          genre:        s.ctx.genre,
          feel:         s.ctx.feel,
          company:      s.ctx.company,
          endings:      s.endings,
          commitment:   s.commitment,
          favorites:    s.favorites,
          likesPick:    s.likesPick,
          dislikesPick: s.dislikesPick,
          loved:        s.loved,
          disliked:     s.disliked,
          shown:        s.shown,
          epoch:        s.epoch,
          country:      s.country ?? undefined,
          sortType:     s.sortType ?? undefined,
          certification: s.certification ?? undefined,
          mediaType:    s.mediaType,
          unseen:       s.unseen,
          deviceId:     s.userId ? undefined : deviceId,
          // IDs já vistos: DB + local + session (shownIds acumula todos os filmes exibidos na sessão)
          shownTmdbIds: [...new Set([
            ...s.historicoDB.map(a => a.tmdb_id),
            ...s.localAvaliacoes.map(a => a.tmdb_id),
            ...(s.current?.tmdb_id !== undefined ? [s.current.tmdb_id] : []),
            ...s.shownIds,
          ])],
        }),
      });

      if (res.status === 429) {
        const err = await res.json().catch(() => ({} as Record<string, unknown>));
        setState(prev => ({
          ...prev,
          view:         'limit',
          limitIsLogged: !!(err as { isLogged?: boolean }).isLogged,
        }));
        return;
      }

      if (res.ok) {
        movie = await res.json();
        if (!s.userId) incrementLocalDailyCount();
      }
    } catch {
      // rede indisponível → fallback
    }

    if (!movie) {
      const moodKey = s.opposite
        ? (OPPOSITE[s.ctx.feel ?? ''] ?? 'tranquilo')
        : (s.ctx.feel ?? 'tranquilo');
      const pool: Movie[] = FALLBACK[moodKey] ?? FALLBACK.tranquilo;
      const pick = pool.find(m => !s.shown.includes(m.titulo)) ?? pool[0];
      const [cor1, cor2] = MOODCOLORS[moodKey] ?? ['#241B30', '#19131F'];
      movie = { ...pick, cor1, cor2, _fallback: true };
      if (s.services.length) { movie.onde_assistir = s.services[0]; movie.no_seu_streaming = true; }
    }

    setState(prev => ({
      ...prev,
      view: 'result',
      current: movie!,
      shown: [...prev.shown, movie!.titulo],
      shownIds: movie!.tmdb_id ? [...new Set([...prev.shownIds, movie!.tmdb_id])] : prev.shownIds,
    }));
  };

  const restartSession = () =>
    update({
      ctx: { feel: null, company: null, energy: null, genre: null },
      express: false, opposite: false, oppositeOf: null,
      step: 0, shown: [], shownIds: [], view: 'context',
    });

  // "Recomeçar do zero": preserva perfil se logado
  const hardReset = () => {
    const s = stateRef.current;
    if (s.userId && s.profileLoaded) {
      const dbLoved    = s.historicoDB.filter(a => a.veredito === 'amei').map(a => a.titulo);
      const dbDisliked = s.historicoDB.filter(a => a.veredito === 'nao_curti').map(a => a.titulo);
      setState({
        ...initialState,
        userId: s.userId, profileLoaded: s.profileLoaded,
        services: s.services, likesPick: s.likesPick,
        favorites: s.favorites, dislikesPick: s.dislikesPick,
        endings: s.endings, historicoDB: s.historicoDB,
        loved: dbLoved, disliked: dbDisliked,
        nudgeDismissed: true, view: 'context',
        mediaType: s.mediaType,
      });
    } else {
      setState(initialState);
    }
  };

  // O nudge aparece após 3 avaliações anônimas, em telas não-intro
  const showNudge =
    supabaseReady &&
    state.localAvaliacoes.length >= 3 &&
    !state.userId &&
    !state.nudgeDismissed &&
    !['welcome', 'onboard', 'loading'].includes(state.view);

  const screenClass =
    state.view === 'welcome' ? ' welcome'
    : state.view === 'loading' ? ' loading'
    : '';

  return (
    <div className="stage">
      <div className="app">
        <div className="grain" />
        <div
          className={`screen${screenClass}`}
          style={showNudge ? { paddingBottom: '62px' } : undefined}
        >
          {state.view === 'welcome' && (
            <WelcomeScreen
              onStart={(mediaType) => update({ view: 'onboard', onboardStep: 0, mediaType, tasteInit: false, board: [], tasteQueue: [], tasteHistory: [], commitment: null, unseen: [] })}
              onSkip={() => update({ view: 'context', step: 0 })}
              userId={state.userId}
              userEmail={state.userEmail}
            />
          )}
          {state.view === 'onboard' && (
            <OnboardScreen
              state={state}
              onUpdate={update}
              onFinish={finishOnboard}
              onBack={() => update({ view: 'welcome' })}
            />
          )}
          {state.view === 'context' && (
            <ContextScreen
              state={state}
              onUpdate={update}
              onRecommend={recommend}
              onBack={() => update({ view: 'onboard', onboardStep: 1 })}
            />
          )}
          {state.view === 'loading' && <LoadingScreen />}
          {state.view === 'result' && state.current && (
            <ResultScreen
              state={state}
              onUpdate={update}
              onRecommend={recommend}
              onAvaliacao={saveRating}
            />
          )}
          {state.view === 'done' && state.current && (
            <DoneScreen
              state={state}
              onRestart={restartSession}
              onReset={hardReset}
            />
          )}
          {state.view === 'limit' && (
            <LimitScreen
              isLogged={state.limitIsLogged}
              onBack={() => update({ view: 'context' })}
            />
          )}
        </div>

        {showNudge && (
          <SaveNudge onDismiss={() => update({ nudgeDismissed: true })} />
        )}
      </div>
    </div>
  );
}
