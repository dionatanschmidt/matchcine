'use client';
import { useState } from 'react';
import type { AppState, Movie } from '@/lib/types';
import { GENRE_EMOJI, MOODCOLORS, SERVICES } from '@/lib/data';

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
  const [showStreamSheet, setShowStreamSheet] = useState(false);
  const [tempServices, setTempServices] = useState<string[]>([]);
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
      <div className="eyebrow">
        <span>Em cartaz pra você</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onUpdate({ view: 'context', step: 3 })}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 20,
              color: 'var(--muted)',
              padding: '2px 10px',
              fontSize: 13,
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            ‹ Voltar
          </button>
          <span className="dot">●</span>
        </span>
      </div>

      {/* Pôster */}
      <Poster movie={m} c1={c1} c2={c2} emoji={emoji} height={300} />

      {/* Filtro de época */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {([
          { id: 'novo',    label: '🆕 Lançamento', bg: '#0d3318', border: '#2a7a42', color: '#6effa0' },
          { id: '2000s',   label: '📼 Anos 2000',  bg: '#3a1a00', border: '#a04800', color: '#ffb347' },
          { id: 'classico',label: '🎞️ Clássico',   bg: '#1e0d36', border: '#6b3fa0', color: '#c4a0ff' },
        ] as const).map(opt => {
          const active = state.epoch === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => {
                const next = active ? null : opt.id;
                onRecommend({ epoch: next, opposite: false, shown: [] });
              }}
              style={{
                flex: 1,
                padding: '7px 4px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 10,
                cursor: 'pointer',
                border: `1px solid ${active ? opt.border : 'var(--line)'}`,
                background: active ? opt.bg : 'var(--raised)',
                color: active ? opt.color : 'var(--muted)',
                transition: 'all .18s ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Onde assistir */}
      {hasServices && inSvc ? (
        <div className="where in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ Está no seu <b className="badge">{onde || 'streaming'}</b></span>
          <button
            onClick={() => { setTempServices([]); setShowStreamSheet(true); }}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--muted)',
              padding: '2px 8px',
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 8,
            }}
          >
            ⇄ trocar
          </button>
        </div>
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

      {/* Sheet "Trocar streaming" */}
      {showStreamSheet && (
        <div className="sheet">
          <div className="box">
            <h3>Em qual streaming?</h3>
            <button
              className="card allsvc"
              style={{ marginBottom: 12 }}
              onClick={() => setTempServices([...SERVICES])}
            >
              <span className="ico">✨</span>
              <div>Pode ser em todos<span className="cap">selecionar todos os streamings</span></div>
            </button>
            <div className="genres">
              {SERVICES.map(sv => (
                <button
                  key={sv}
                  className={`gtag${tempServices.includes(sv) ? ' onsvc' : ''}`}
                  onClick={() =>
                    setTempServices(prev =>
                      prev.includes(sv) ? prev.filter(s => s !== sv) : [...prev, sv]
                    )
                  }
                >
                  {sv}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                setShowStreamSheet(false);
                onRecommend({ services: tempServices, opposite: false, shown: [] });
              }}
            >
              Buscar novo filme
            </button>
            <button className="btn btn-ghost" onClick={() => setShowStreamSheet(false)}>
              Cancelar
            </button>
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
      {(m.vote_average ?? 0) > 0 && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 8,
          padding: '4px 8px',
          fontSize: 11,
          color: '#fff',
          fontWeight: 600,
          zIndex: 2,
          lineHeight: 1.3,
        }}>
          ⭐ {m.vote_average!.toFixed(1)}
        </div>
      )}
      <div className="pshade" />
      {m.tagline && <div className="ptag">{m.tagline}</div>}
      <div className="ptitle">{m.titulo}</div>
      <div className="pyear">
        {[m.ano, m.genero, m.duracao].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}