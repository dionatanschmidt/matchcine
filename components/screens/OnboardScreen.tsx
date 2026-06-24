'use client';
import { useState, useRef, KeyboardEvent } from 'react';
import type { AppState, TasteHistoryEntry } from '@/lib/types';
import { SERVICES, POOL, GRAD } from '@/lib/data';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onFinish: (endings?: string) => void;
}

const ENOUGH = 6;

export default function OnboardScreen({ state, onUpdate, onFinish }: Props) {
  const { onboardStep } = state;
  const total = 3;

  const prog = Array.from({ length: total }, (_, i) => (
    <i key={i} className={i <= onboardStep ? 'done' : ''} />
  ));

  const nextOnboard = () => {
    if (onboardStep < 2) onUpdate({ onboardStep: onboardStep + 1 });
    else onFinish();
  };

  return (
    <>
      <div className="eyebrow"><span>Te conhecendo</span><span className="dot">●</span></div>
      <div className="prog">{prog}</div>
      {onboardStep === 0 && (
        <StepServices state={state} onUpdate={onUpdate} onNext={nextOnboard} />
      )}
      {onboardStep === 1 && (
        <StepTaste state={state} onUpdate={onUpdate} onNext={nextOnboard} />
      )}
      {onboardStep === 2 && (
        <StepEnding onSelect={onFinish} />
      )}
    </>
  );
}

/* ---- Step 0: Streamings ---- */
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
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onNext}>Continuar</button>
      <button className="skip" onClick={onNext}>Vejo em qualquer um / pular</button>
    </>
  );
}

/* ---- Step 1: Taste trainer ---- */
type CellAnim = 'idle' | 'chosen-like' | 'chosen-fav' | 'chosen-dislike' | 'leaving';

function initTasteBoard(state: AppState): { board: (number | null)[]; queue: number[] } {
  const idx = [...Array(POOL.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const taken = new Set([...state.likesPick, ...state.dislikesPick, ...state.favorites]);
  const avail = idx.filter(i => !taken.has(POOL[i].n));
  return { board: avail.slice(0, 9), queue: avail.slice(9) };
}

function StepTaste({ state, onUpdate, onNext }: { state: AppState; onUpdate: (p: Partial<AppState>) => void; onNext: () => void }) {
  const [cellAnims, setCellAnims] = useState<CellAnim[]>(Array(9).fill('idle'));
  const [isAnimating, setIsAnimating] = useState(false);
  const chipRef = useRef<HTMLInputElement>(null);

  // Initialize taste board on first render
  const boardRef = useRef<{ board: (number | null)[]; queue: number[]; history: TasteHistoryEntry[] } | null>(null);
  if (!boardRef.current) {
    if (state.tasteInit) {
      boardRef.current = { board: [...state.board], queue: [...state.tasteQueue], history: [...state.tasteHistory] };
    } else {
      const { board, queue } = initTasteBoard(state);
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

    const name = POOL[idx].n;
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
    const name = POOL[h.idx].n;
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
      <button className="tback" onClick={undo} disabled={!rated || isAnimating}>↩︎ Desfazer</button>
      <h1 className="q">O que <em>combina</em> com você?</h1>
      <p className="tleg">
        Em cada um: <b style={{ color: 'var(--muted)' }}>👎 não curti</b>,{' '}
        <b style={{ color: 'var(--love)' }}>❤️ gostei</b> ou{' '}
        <b style={{ color: 'var(--amber-soft)' }}>⭐ favorito</b> (quando você ama demais). A cada escolha, entra outro.
      </p>
      {enough && (
        <div className="tbanner">
          ✅ <b>Já te conheço bem!</b> Pode avançar — ou continue marcando à vontade.
        </div>
      )}
      <div className="t9grid">
        {Array.from({ length: 9 }, (_, cell) => {
          const idx = board[cell];
          if (idx == null) return <div key={cell} className="t9card empty" />;
          const item = POOL[idx];
          const grad = GRAD[idx % GRAD.length];
          const anim = cellAnims[cell];
          return (
            <div key={cell} className={`t9card${anim !== 'idle' ? ` ${anim}` : ''}`}>
              <div className="t9art" style={{ background: `linear-gradient(150deg, ${grad[0]}, ${grad[1]})` }}>
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
      <div className="tcount">
        {rated > 0
          ? <><b>{rated}</b> marcado{rated > 1 ? 's' : ''}{favs ? ` · ⭐ ${favs} favorito${favs > 1 ? 's' : ''}` : ''}</>
          : ' '}
      </div>
      <button
        className={`btn btn-primary${enough ? ' glow' : ''}`}
        style={{ marginTop: 14 }}
        onClick={onNext}
      >
        {enough ? 'Avançar' : 'Continuar'}
      </button>
      <div className="flabel" style={{ marginTop: 22 }}>✍️ Quer citar um favorito específico?</div>
      <div className="chipbox" onClick={() => chipRef.current?.focus()}>
        {state.likes.map((t, i) => (
          <span key={i} className="chip">
            <b>{t}</b>
            <button className="chip-x" onClick={() => removeChip('likes', i)}>×</button>
          </span>
        ))}
        <input
          ref={chipRef}
          placeholder="Filme, diretor ou ator…"
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') addChip('likes');
          }}
        />
      </div>
      <div style={{ height: 8 }} />
    </>
  );
}

/* ---- Step 2: Ending ---- */
function StepEnding({ onSelect }: { onSelect: (endings: string) => void }) {
  return (
    <>
      <h1 className="q">Que tipo de final te <em>agrada mais?</em></h1>
      <p className="sub">Sem certo ou errado — é só o seu jeito de gostar.</p>
      <div className="cards">
        <EndCard ico="🌫️" t="Me deixa pensando" c="aberto, ambíguo, fica ecoando" onClick={() => onSelect('aberto')} />
        <EndCard ico="🎀" t="Amarra tudo" c="resolvido, sem pontas soltas" onClick={() => onSelect('resolvido')} />
        <EndCard ico="🔀" t="Me surpreende" c="adoro uma boa reviravolta" onClick={() => onSelect('reviravolta')} />
        <EndCard ico="🤷" t="Tanto faz" c="contanto que seja bom" onClick={() => onSelect('qualquer')} />
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