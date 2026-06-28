'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { AppState, TasteHistoryEntry } from '@/lib/types';
import { SERVICES, POOL, POOL_TV, GRAD } from '@/lib/data';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onFinish: (endings?: string) => void;
  onBack: () => void;
}

const ENOUGH = 6;

export default function OnboardScreen({ state, onUpdate, onFinish, onBack }: Props) {
  const { onboardStep } = state;
  const isTV = state.mediaType === 'tv';
  const total = 2;

  const prog = Array.from({ length: total }, (_, i) => (
    <i key={i} className={i <= onboardStep ? 'done' : ''} />
  ));

  const nextOnboard = () => {
    if (onboardStep < 1) onUpdate({ onboardStep: onboardStep + 1 });
    else onFinish();
  };

  const handleBack = () => {
    if (onboardStep > 0) onUpdate({ onboardStep: onboardStep - 1 });
    else onBack();
  };

  return (
    <>
      <div className="eyebrow">
        <span>Te conhecendo</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleBack}
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
      <div className="prog">{prog}</div>
      {onboardStep === 0 && (
        <StepTaste state={state} onUpdate={onUpdate} onNext={nextOnboard} />
      )}
      {onboardStep === 1 && (
        isTV
          ? <StepCommitment onSelect={(val) => { onUpdate({ commitment: val }); onFinish(); }} />
          : <StepEnding onSelect={onFinish} />
      )}
    </>
  );
}

/* ---- Step 0: Streamings (kept for reference, not used in flow) ---- */
function StepServices({ state, onUpdate, onNext }: { state: AppState; onUpdate: (p: Partial<AppState>) => void; onNext: () => void }) {
  const toggle = (sv: string) => {
    const i = state.services.indexOf(sv);
    const services = i >= 0
      ? state.services.filter((_, idx) => idx !== i)
      : [...state.services, sv];
    onUpdate({ services });
  };

  const selectAll = () => {
    onUpdate({ services: [...SERVICES] });
    onNext();
  };

  return (
    <>
      <h1 className="q">Onde você costuma <em>assistir?</em></h1>
      <p className="sub">Vou priorizar filmes que estão nos seus streamings — nada de indicar algo que você não tem onde ver.</p>
      <button className="card allsvc" onClick={selectAll}>
        <span className="ico">✨</span>
        <div>Pode ser em todos<span className="cap">tenho acesso a tudo — seguir direto</span></div>
      </button>
      <div className="flabel" style={{ marginTop: 16 }}>Ou escolha os seus:</div>
      <div className="genres">
        {SERVICES.map(sv => (
          <button
            key={sv}
            className={`gtag${state.services.includes(sv) ? ' onsvc' : ''}`}
            onClick={() => toggle(sv)}
          >
            {sv}
          </button>
        ))}
      </div>
      <div className="spacer" />
      {state.services.length > 0 && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 16, animation: 'fade .35s ease' }}
          onClick={onNext}
        >
          Continuar
        </button>
      )}
      <button className="skip" onClick={onNext}>Vejo em qualquer um / pular</button>
    </>
  );
}

/* ---- Taste trainer ---- */
type CellAnim = 'idle' | 'chosen-like' | 'chosen-fav' | 'chosen-dislike' | 'leaving';

function initTasteBoard(
  state: AppState,
  pool: typeof POOL
): { board: (number | null)[]; queue: number[] } {
  const idx = [...Array(pool.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const taken = new Set([...state.likesPick, ...state.dislikesPick, ...state.favorites]);
  const avail = idx.filter(i => !taken.has(pool[i].n));
  return { board: avail.slice(0, 9), queue: avail.slice(9) };
}

function StepTaste({ state, onUpdate, onNext }: { state: AppState; onUpdate: (p: Partial<AppState>) => void; onNext: () => void }) {
  const pool = state.mediaType === 'tv' ? POOL_TV : POOL;

  const [cellAnims, setCellAnims] = useState<CellAnim[]>(Array(9).fill('idle'));
  const [isAnimating, setIsAnimating] = useState(false);
  const [images, setImages] = useState<Record<number, string>>({});
  const chipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/taste-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: pool.map(item => ({ n: item.n, t: item.t })) }),
    })
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        const byIdx: Record<number, string> = {};
        pool.forEach((item, i) => { if (data[item.n]) byIdx[i] = data[item.n]; });
        setImages(byIdx);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const boardRef = useRef<{ board: (number | null)[]; queue: number[]; history: TasteHistoryEntry[] } | null>(null);
  if (!boardRef.current) {
    if (state.tasteInit) {
      boardRef.current = { board: [...state.board], queue: [...state.tasteQueue], history: [...state.tasteHistory] };
    } else {
      const { board, queue } = initTasteBoard(state, pool);
      boardRef.current = { board, queue, history: [] };
      onUpdate({ board, tasteQueue: queue, tasteHistory: [], tasteInit: true });
    }
  }

  const { board, queue, history } = boardRef.current;
  const rated = history.length;
  const enough = rated >= ENOUGH;
  const favs = state.favorites.length;

  const rate = (cell: number, verdict: 'like' | 'fav' | 'dislike') => {
    if (isAnimating) return;
    const idx = board[cell];
    if (idx == null) return;

    const name = pool[idx].n;
    const replacement = queue.length ? queue.shift()! : null;
    const entry: TasteHistoryEntry = { cell, idx, verdict, replacedWith: replacement ?? null };
    history.push(entry);
    board[cell] = replacement ?? null;

    if (verdict === 'like') {
      onUpdate({ likesPick: [...state.likesPick, name], board: [...board], tasteQueue: [...queue], tasteHistory: [...history] });
    } else if (verdict === 'fav') {
      onUpdate({ favorites: [...state.favorites, name], board: [...board], tasteQueue: [...queue], tasteHistory: [...history] });
    } else {
      onUpdate({ dislikesPick: [...state.dislikesPick, name], board: [...board], tasteQueue: [...queue], tasteHistory: [...history] });
    }

    setIsAnimating(true);
    setCellAnims(prev => { const a = [...prev]; a[cell] = `chosen-${verdict}` as CellAnim; return a; });

    setTimeout(() => {
      setCellAnims(prev => { const a = [...prev]; a[cell] = 'leaving'; return a; });
      setTimeout(() => {
        setIsAnimating(false);
        setCellAnims(prev => { const a = [...prev]; a[cell] = 'idle'; return a; });
      }, 360);
    }, 560);
  };

  const undo = () => {
    if (isAnimating || !history.length) return;
    const h = history.pop()!;
    const name = pool[h.idx].n;
    if (h.replacedWith != null) queue.unshift(h.replacedWith);
    board[h.cell] = h.idx;
    if (h.verdict === 'like') {
      onUpdate({ likesPick: state.likesPick.filter(n => n !== name), board: [...board], tasteQueue: [...queue], tasteHistory: [...history] });
    } else if (h.verdict === 'fav') {
      onUpdate({ favorites: state.favorites.filter(n => n !== name), board: [...board], tasteQueue: [...queue], tasteHistory: [...history] });
    } else {
      onUpdate({ dislikesPick: state.dislikesPick.filter(n => n !== name), board: [...board], tasteQueue: [...queue], tasteHistory: [...history] });
    }
  };

  const addChip = (key: 'likes' | 'dislikes') => {
    const inp = chipRef.current;
    if (!inp || !inp.value.trim()) return;
    onUpdate({ [key]: [...state[key], inp.value.trim()] });
    inp.value = '';
  };

  const removeChip = (key: 'likes' | 'dislikes', idx: number) => {
    onUpdate({ [key]: state[key].filter((_, i) => i !== idx) });
  };

  return (
    <>
      <h1 className="q"><em>Calibrando</em> seu gosto</h1>
      <p className="tleg">👎 não curti   🩷 gostei   ⭐ favorito</p>
      {enough && (
        <div className="tbanner">
          ✅ <b>Já te conheço bem!</b> Pode avançar — ou continue marcando à vontade.
        </div>
      )}
      <div style={{ position: 'relative' }}>
        {rated > 0 && (
          <button
            onClick={undo}
            disabled={isAnimating}
            title="Desfazer"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              lineHeight: 1,
            }}
          >
            ↩️
          </button>
        )}
        <div className="t9grid">
          {Array.from({ length: 9 }, (_, cell) => {
            const idx = board[cell];
            if (idx == null) return <div key={cell} className="t9card empty" />;
            const item = pool[idx];
            const grad = GRAD[idx % GRAD.length];
            const anim = cellAnims[cell];
            return (
              <div key={cell} className={`t9card${anim !== 'idle' ? ` ${anim}` : ''}`}>
                <div className="t9art" style={{ background: `linear-gradient(150deg, ${grad[0]}, ${grad[1]})` }}>
                  {images[idx] && (
                    <img
                      src={images[idx]}
                      alt={item.n}
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <span className="t9stamp s-dislike">👎</span>
                  <span className="t9stamp s-like">❤️</span>
                  <span className="t9stamp s-fav">⭐</span>
                  <div className="t9type">{item.t}</div>
                  <div className="t9name">{item.n}</div>
                </div>
                <div className="t9acts">
                  <button className="t9btn b-dislike" onClick={() => rate(cell, 'dislike')} title="Não curti">👎</button>
                  <button className="t9btn b-like" onClick={() => rate(cell, 'like')} title="Gostei">❤️</button>
                  <button className="t9btn b-fav" onClick={() => rate(cell, 'fav')} title="Favorito">⭐</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="tcount">
        {rated > 0
          ? <><b>{rated}</b> marcado{rated > 1 ? 's' : ''}{favs ? ` · ⭐ ${favs} favorito${favs > 1 ? 's' : ''}` : ''}</>
          : ' '}
      </div>
      <button
        className={`btn btn-primary${enough ? ' glow' : ''}`}
        style={{ marginTop: 14 }}
        onClick={onNext}
      >
        {enough ? 'Avançar' : 'Continuar'}
      </button>
      <div className="flabel" style={{ marginTop: 22 }}>
        {state.mediaType === 'tv' ? '✍️ Quer citar uma série específica?' : '✍️ Quer citar um favorito específico?'}
      </div>
      <div className="chipbox" onClick={() => chipRef.current?.focus()}>
        {state.likes.map((t, i) => (
          <span key={i} className="chip">
            <b>{t}</b>
            <button className="chip-x" onClick={() => removeChip('likes', i)}>×</button>
          </span>
        ))}
        <input
          ref={chipRef}
          placeholder={state.mediaType === 'tv' ? 'Série, showrunner ou ator…' : 'Filme, diretor ou ator…'}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') addChip('likes');
          }}
        />
      </div>
      <div style={{ height: 8 }} />
    </>
  );
}

/* ---- StepEnding (filmes) ---- */
function StepEnding({ onSelect }: { onSelect: (endings: string) => void }) {
  return (
    <>
      <h1 className="q">Como você quer <em>sair dessa história?</em></h1>
      <p className="sub">Sem certo ou errado, é o seu gosto</p>
      <div className="cards">
        <EndCard ico="🌫️" t="Me deixa pensando" c="aberto, ambíguo, fica ecoando" onClick={() => onSelect('aberto')} />
        <EndCard ico="🎀" t="Amarra tudo" c="resolvido, sem pontas soltas" onClick={() => onSelect('resolvido')} />
        <EndCard ico="🔀" t="Me surpreende" c="adoro uma boa reviravolta" onClick={() => onSelect('reviravolta')} />
        <EndCard ico="🤷" t="Tanto faz" c="contanto que seja bom" onClick={() => onSelect('qualquer')} />
      </div>
    </>
  );
}

/* ---- StepCommitment (séries) ---- */
function StepCommitment({ onSelect }: { onSelect: (commitment: string) => void }) {
  return (
    <>
      <h1 className="q">Qual o seu nível de <em>compromisso?</em></h1>
      <p className="sub">Sem certo ou errado, é o seu gosto</p>
      <div className="cards">
        <EndCard ico="🎯" t="Vapt-vupt" c="Minissérie, começo, meio e fim rápido" onClick={() => onSelect('mini')} />
        <EndCard ico="🏔️" t="Longa jornada" c="Várias temporadas, pra morar no universo" onClick={() => onSelect('longa')} />
        <EndCard ico="🔄" t="Caso da semana" c="Dá pra pular episódio sem se perder" onClick={() => onSelect('procedural')} />
        <EndCard ico="🤷" t="Tanto faz" c="Contanto que seja boa" onClick={() => onSelect('qualquer')} />
      </div>
    </>
  );
}

function EndCard({ ico, t, c, onClick }: { ico: string; t: string; c: string; onClick: () => void }) {
  return (
    <button className="card" onClick={onClick}>
      <span className="ico">{ico}</span>
      <div>{t}<span className="cap">{c}</span></div>
    </button>
  );
}
