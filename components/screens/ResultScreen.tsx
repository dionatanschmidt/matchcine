'use client';
import { useState } from 'react';
import type { AppState, Movie } from '@/lib/types';
import { GENRE_EMOJI, MOODCOLORS } from '@/lib/data';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onRecommend: (overrides?: Partial<AppState>) => void;
  onAvaliacao: (movie: Movie, veredito: string) => void;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function safeColors(m: Movie, feel: string | null): [string, string] {
  const c1 = HEX.test(m.cor1 ?? '') ? m.cor1 : null;
  const c2 = HEX.test(m.cor2 ?? '') ? m.cor2 : null;
  if (c1 && c2) return [c1, c2];
  const f = MOODCOLORS[feel ?? ''] ?? ['#241B30', '#19131F'];
  return [c1 ?? f[0], c2 ?? f[1]];
}

export default function ResultScreen({ state, onUpdate, onRecommend, onAvaliacao }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const m = state.current!;
  const [c1, c2] = safeColors(m, state.ctx.feel);
  const emoji = GENRE_EMOJI[m.genero?.split(',')[0]?.trim() ?? ''] ?? '🎬';

  const loveIt = () => {
    onAvaliacao(m, 'amei');
    onUpdate({ loved: [...state.loved, m.titulo], watchedCount: state.watchedCount + 1, view: 'done' });
  };

  const nextOne = () => {
    onAvaliacao(m, 'nao_curti');
    onRecommend({ opposite: false, disliked: [...state.disliked, m.titulo] });
  };
  const oppositeOne = () => {
    onAvaliacao(m, 'nao_curti');
    onRecommend({ opposite: true, oppositeOf: m.titulo, disliked: [...state.disliked, m.titulo] });
  };

  const rateWatched = (loved: boolean) => {
    setShowSheet(false);
    onAvaliacao(m, loved ? 'amei' : 'nao_curti');
    const overrides: Partial<AppState> = { watchedCount: state.watchedCount + 1 };
    if (loved) overrides.loved = [...state.loved, m.titulo];
    else overrides.disliked = [...state.disliked, m.titulo];
    onRecommend(overrides);
  };

  const hasServices = state.services.length > 0;
  const inSvc = m.no_seu_streaming !== false;
  let onde = m.onde_assistir ?? '';
  if (hasServices && (!onde || /verifique/i.test(onde))) onde = state.services[0];

  return (
    <>
      <div className="eyebrow"><span>Em cartaz pra você</span><span className="dot">●</span></div>

      {/* Pôster */}
      <Poster movie={m} c1={c1} c2={c2} emoji={emoji} height={300} />

      {/* Porquê */}
      <div className="perf">
        <span className="pin">✦</span>
        <p>{m.porque}</p>
      </div>

      {/* Onde assistir */}
      {hasServices && inSvc ? (
        <div className="where in">✓ <span>Está no seu <b className="badge">{onde || 'streaming'}</b></span></div>
      ) : hasServices && !inSvc ? (
        <div className="where out">▸ <span>Fora dos seus streamings — em <b className="badge">{onde || 'outro serviço'}</b></span></div>
      ) : (
        <div className="where">▸ <span>Onde achar: <b className="badge" style={{ color: 'var(--amber-soft)' }}>{m.onde_assistir || 'verifique a disponibilidade'}</b></span></div>
      )}

      {/* Botões */}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={loveIt}>Bora, é esse</button>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setShowSheet(true)}>Já assisti</button>
          <button className="btn btn-ghost" onClick={nextOne}>Mostra outro</button>
        </div>
        <button className="express" onClick={oppositeOne}>Não é minha vibe — me dá o oposto disso 🔄</button>
      </div>

      <div className="learn">
        <span>❤ <b>{state.loved.length}</b> amados</span>
        <span>👁 <b>{state.watchedCount}</b> vistos</span>
        <span>↻ <b>{state.disliked.length}</b> descartados</span>
      </div>

      {m._fallback && (
        <p className="miss">(sugestão da lista local — TMDB indisponível)</p>
      )}

      {/* Sheet "Já assisti" */}
      {showSheet && (
        <div className="sheet">
          <div className="box">
            <h3>E aí, o que achou de <em>{m.titulo}</em>?</h3>
            <button className="btn btn-primary" onClick={() => rateWatched(true)}>Amei esse</button>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => rateWatched(false)}>Não curti muito</button>
              <button className="btn btn-ghost" onClick={() => setShowSheet(false)}>Voltar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---- Componente Poster reutilizável ---- */
export function Poster({ movie: m, c1, c2, emoji, height }: {
  movie: Movie; c1: string; c2: string; emoji: string; height: number;
}) {
  return (
    <div
      className="poster"
      style={{ height, background: `linear-gradient(150deg, ${c1}, ${c2})` }}
    >
      {m.poster_path && (
        <img
          src={m.poster_path}
          alt={m.titulo}
          crossOrigin="anonymous"
          loading="eager"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <div className="pgrain" />
      {!m.poster_path && <div className="pwatermark">{emoji}</div>}
      <div className="pshade" />
      {m.tagline && <div className="ptag">{m.tagline}</div>}
      <div className="ptitle">{m.titulo}</div>
      <div className="pyear">
        {[m.ano, m.genero, m.duracao].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}