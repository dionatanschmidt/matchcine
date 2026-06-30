'use client';
import { useState, useEffect } from 'react';
import type { AppState, Movie } from '@/lib/types';
import { GENRE_EMOJI, MOODCOLORS, SERVICES } from '@/lib/data';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onRecommend: (overrides?: Partial<AppState>) => void;
  onAvaliacao: (movie: Movie, veredito: string) => void;
  onReset: () => void;
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

const SITE_URL = 'https://matchcine.vercel.app';

export default function ResultScreen({ state, onUpdate, onRecommend, onAvaliacao, onReset }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showStreamSheet, setShowStreamSheet] = useState(false);
  const [showEpochMenu, setShowEpochMenu] = useState(false);
  const [showSinopse, setShowSinopse] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Filtros locais no sheet ⚙️ — inicializados ao abrir
  const [filterGenre, setFilterGenre] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  const [filterSortType, setFilterSortType] = useState<string | null>(null);
  const [filterCert, setFilterCert] = useState<string | null>(null);
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

  const handleShare = async () => {
    if (!m.tmdb_id) return;
    const mediaType = m.media_type ?? 'movie';
    const url = `${SITE_URL}/filme/${m.tmdb_id}${mediaType === 'tv' ? '?type=tv' : ''}`;
    const text = `Hoje vou assistir "${m.titulo}" 🎬 E você? Descubra o seu filme:`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: m.titulo, text, url }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => {});
      setToastMsg('Link copiado!');
      setTimeout(() => setToastMsg(''), 2500);
    }
  };

  // Inicializa filtros com valores atuais do state ao abrir o sheet
  useEffect(() => {
    if (showSettings) {
      setFilterGenre(state.ctx.genre);
      setFilterCountry(state.country ?? null);
      setFilterSortType(state.sortType ?? null);
      setFilterCert(state.certification ?? null);
    }
  }, [showSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySettings = () => {
    setShowSettings(false);
    onRecommend({
      ctx: { ...state.ctx, genre: filterGenre },
      country: filterCountry,
      sortType: filterSortType,
      certification: filterCert,
      opposite: false,
    });
  };

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

      {/* Mudança 5: dropdown de época + botão Sinopse lado a lado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, position: 'relative', gap: 8 }}>
        {/* Botão Sinopse — pill esquerdo */}
        {m.sinopse && (
          <button
            onClick={() => setShowSinopse(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--body)', flexShrink: 0 }}
          >
            Sinopse
          </button>
        )}
        <div style={{ flex: 1 }} />
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
            flexShrink: 0,
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
                    onRecommend({ epoch: opt.id, opposite: false });
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

      {/* Streaming — botão ⇄ trocar sempre visível */}
      {hasServices ? (
        <div
          className={`where ${inSvc ? 'in' : 'out'}`}
          style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {inSvc
              ? <>✓ Está no seu <b className="badge">{onde || 'streaming'}</b></>
              : <>▸ Fora dos seus streamings — em <b className="badge">{onde || 'outro serviço'}</b></>
            }
          </span>
          <button
            onClick={() => { setTempServices([]); setShowStreamSheet(true); }}
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--muted)', padding: '2px 8px', fontSize: 12, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            ⇄ trocar
          </button>
        </div>
      ) : (
        <div className="where" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            ▸ Onde achar: <b className="badge" style={{ color: 'var(--amber-soft)' }}>{m.onde_assistir || 'verifique a disponibilidade'}</b>
          </span>
          <button
            onClick={() => { setTempServices([]); setShowStreamSheet(true); }}
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--muted)', padding: '2px 8px', fontSize: 12, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            ⇄ trocar
          </button>
        </div>
      )}

      {/* Botões principais */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <button
            onClick={() => setShowSheet(true)}
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'var(--body)' }}
          >
            Já assisti
          </button>
          <button
            onClick={nextOne}
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'var(--body)' }}
          >
            Mostra outro
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Refinar busca"
            style={{ width: 52, borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >⚙️</button>
        </div>

        {/* Botões discretos */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 14 }}>
          <button
            onClick={onReset}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--body)', padding: 0 }}
          >
            🔄 Recomeçar a escolha
          </button>
          <button
            onClick={handleShare}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--body)', padding: 0 }}
          >
            📤 Compartilhar
          </button>
        </div>

        {/* Toast de confirmação */}
        {toastMsg && (
          <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--ok)', fontSize: 13 }}>
            {toastMsg}
          </div>
        )}
      </div>

      <div className="learn">
        <span>❤ <b>{state.loved.length}</b> amados</span>
        <span>👁 <b>{state.watchedCount}</b> vistos</span>
        <span>↻ <b>{state.disliked.length}</b> descartados</span>
      </div>

      {m._fallback && (
        <p className="miss">(sugestão da lista local — TMDB indisponível)</p>
      )}

      {/* Mudança 8: sheet ⚙️ Refinar busca */}
      {showSettings && (
        <div className="sheet">
          <div className="box">
            <h3>⚙️ Refinar busca</h3>
            <FilterRow label="🎬 Gênero">
              <select value={filterGenre ?? ''} onChange={e => setFilterGenre(e.target.value || null)} style={selectStyle}>
                <option value="">Qualquer</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </FilterRow>
            <FilterRow label="🌍 País">
              <select value={filterCountry ?? ''} onChange={e => setFilterCountry(e.target.value || null)} style={selectStyle}>
                <option value="">Qualquer</option>
                <option value="BR">Brasileiro</option>
                <option value="US">Americano</option>
                <option value="KR">Coreano</option>
                <option value="EU">Europeu</option>
              </select>
            </FilterRow>
            <FilterRow label="🔥 Tipo">
              <select value={filterSortType ?? ''} onChange={e => setFilterSortType(e.target.value || null)} style={selectStyle}>
                <option value="">Popular</option>
                <option value="pearl">Pérola escondida</option>
              </select>
            </FilterRow>
            <FilterRow label="🔞 Classificação">
              <select value={filterCert ?? ''} onChange={e => setFilterCert(e.target.value || null)} style={selectStyle}>
                <option value="">Sem restrição</option>
                <option value="L">Livre</option>
                <option value="14">Até 14 anos</option>
              </select>
            </FilterRow>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={applySettings}>
              Aplicar e buscar novo
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setShowSettings(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Mudança 5: sheet de sinopse */}
      {showSinopse && (
        <div className="sheet">
          <div className="box">
            <h3><em>{m.titulo}</em></h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', marginBottom: 16 }}>{m.sinopse}</p>
            <button className="btn btn-ghost" onClick={() => setShowSinopse(false)}>Fechar</button>
          </div>
        </div>
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
                onRecommend({ services: tempServices, opposite: false });
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

const selectStyle: React.CSSProperties = {
  background: 'var(--raised)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--ink)',
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'var(--body)',
  cursor: 'pointer',
  minWidth: 140,
};

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{label}</span>
      {children}
    </div>
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
