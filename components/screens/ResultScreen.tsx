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

const GENRES = ['Ação', 'Terror', 'Comédia', 'Drama', 'Ficção', 'Romance', 'Suspense', 'Animação', 'Documentário'];

interface EpochOption { id: string | null; label: string; }
const EPOCH_OPTIONS: EpochOption[] = [
  { id: null,        label: 'Qualquer época' },
  { id: 'novo',      label: 'Lançamentos (últimos 3 anos)' },
  { id: '2010s',     label: 'Anos 2010' },
  { id: '2000s',     label: 'Anos 2000' },
  { id: '90s',       label: 'Anos 90' },
  { id: 'classico',  label: 'Clássicos (antes de 1990)' },
];

export default function ResultScreen({ state, onUpdate, onRecommend, onAvaliacao }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [showStreamSheet, setShowStreamSheet] = useState(false);
  const [showGenreSheet, setShowGenreSheet] = useState(false);
  const [showEpochMenu, setShowEpochMenu] = useState(false);
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

  // Mudança 4: três níveis de veredito
  const rateWatched = (veredito: 'amei' | 'bom' | 'nao_curti') => {
    setShowSheet(false);
    onAvaliacao(m, veredito);
    const overrides: Partial<AppState> = { watchedCount: state.watchedCount + 1 };
    if (veredito === 'amei') overrides.loved = [...state.loved, m.titulo];
    else if (veredito === 'nao_curti') overrides.disliked = [...state.disliked, m.titulo];
    onRecommend(overrides);
  };

  const hasServices = state.services.length > 0;
  const inSvc = m.no_seu_streaming !== false;
  let onde = m.onde_assistir ?? '';
  if (hasServices && (!onde || /verifique/i.test(onde))) onde = state.services[0];

  const currentEpochLabel = EPOCH_OPTIONS.find(o => o.id === state.epoch)?.label ?? 'Qualquer época';

  return (
    <>
      <div className="eyebrow">
        <span>Em cartaz pra você</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onUpdate({ view: 'context', step: 0 })}
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

      {/* Mudança 5: dropdown de época discreto no canto */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, position: 'relative' }}>
        <button
          onClick={() => setShowEpochMenu(v => !v)}
          style={{
            background: state.epoch ? 'var(--raised)' : 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 20,
            color: state.epoch ? 'var(--ink)' : 'var(--muted)',
            padding: '4px 14px',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: state.epoch ? 600 : 400,
          }}
        >
          {currentEpochLabel} ▾
        </button>
        {showEpochMenu && (
          <>
            {/* overlay para fechar ao clicar fora */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 19 }}
              onClick={() => setShowEpochMenu(false)}
            />
            <div style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              background: 'var(--card-bg, #1a1a2e)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              overflow: 'hidden',
              zIndex: 20,
              minWidth: 230,
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              {EPOCH_OPTIONS.map((opt, i) => (
                <button
                  key={String(opt.id)}
                  onClick={() => {
                    setShowEpochMenu(false);
                    onRecommend({ epoch: opt.id, opposite: false, shown: [] });
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: state.epoch === opt.id ? 'var(--raised)' : 'transparent',
                    border: 'none',
                    borderBottom: i < EPOCH_OPTIONS.length - 1 ? '1px solid var(--line)' : 'none',
                    color: state.epoch === opt.id ? 'var(--ink)' : 'var(--muted)',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: state.epoch === opt.id ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mudança 6: botão ⇄ trocar sempre visível quando há serviços */}
      {hasServices ? (
        <div
          className={`where ${inSvc ? 'in' : 'out'}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
            {inSvc
              ? <>✓ Está no seu <b className="badge">{onde || 'streaming'}</b></>
              : <>▸ Fora dos seus streamings — em <b className="badge">{onde || 'outro serviço'}</b></>
            }
          </span>
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
              whiteSpace: 'nowrap',
            }}
          >
            ⇄ trocar
          </button>
        </div>
      ) : (
        <div className="where">▸ <span>Onde achar: <b className="badge" style={{ color: 'var(--amber-soft)' }}>{m.onde_assistir || 'verifique a disponibilidade'}</b></span></div>
      )}

      {/* Botões — Mudança 3: sem "oposto", com "escolher gênero" */}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={loveIt}>Bora, é esse</button>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setShowSheet(true)}>Já assisti</button>
          <button className="btn btn-ghost" onClick={nextOne}>Mostra outro</button>
        </div>
        <button className="express" onClick={() => setShowGenreSheet(true)}>🎬 Escolher por gênero</button>
      </div>

      <div className="learn">
        <span>❤ <b>{state.loved.length}</b> amados</span>
        <span>👁 <b>{state.watchedCount}</b> vistos</span>
        <span>↻ <b>{state.disliked.length}</b> descartados</span>
      </div>

      {m._fallback && (
        <p className="miss">(sugestão da lista local — TMDB indisponível)</p>
      )}

      {/* Mudança 4: sheet "Já assisti" com 3 níveis */}
      {showSheet && (
        <div className="sheet">
          <div className="box">
            <h3>E aí, o que achou de <em>{m.titulo}</em>?</h3>
            <button className="btn btn-primary" onClick={() => rateWatched('amei')}>Amei</button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => rateWatched('bom')}>Bom filme</button>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => rateWatched('nao_curti')}>Não curti muito</button>
              <button className="btn btn-ghost" onClick={() => setShowSheet(false)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* Mudança 3: sheet de gênero */}
      {showGenreSheet && (
        <div className="sheet">
          <div className="box">
            <h3>Escolha um gênero</h3>
            <div className="genres">
              {GENRES.map(g => (
                <button
                  key={g}
                  className="gtag"
                  onClick={() => {
                    setShowGenreSheet(false);
                    onRecommend({ ctx: { ...state.ctx, genre: g }, opposite: false, shown: [] });
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 16 }}
              onClick={() => setShowGenreSheet(false)}
            >
              Cancelar
            </button>
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
              {state.mediaType === 'tv' ? 'Buscar nova série' : 'Buscar novo filme'}
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
        {[
          m.ano,
          m.genero,
          m.duracao,
          m.media_type === 'tv' && m.seasons ? `${m.seasons} TEMP.` : null,
        ].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}
