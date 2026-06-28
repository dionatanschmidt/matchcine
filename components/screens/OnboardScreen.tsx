'use client';
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import type { AppState, TasteHistoryEntry } from '@/lib/types';
import { SERVICES, POOL, POOL_TV, GRAD } from '@/lib/data';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onFinish: (endings?: string) => void;
  onBack: () => void;
}

const ENOUGH = 5;
const THRESHOLD = 100;
const VELOCITY_THRESHOLD = 0.5;

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

/* ---- Swipeable card stack ---- */

function initTasteBoard(
  state: AppState,
  pool: typeof POOL
): { board: (number | null)[]; queue: number[] } {
  const idx = [...Array(pool.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const taken = new Set([...state.likesPick, ...state.dislikesPick, ...state.favorites, ...state.unseen]);
  const avail = idx.filter(i => !taken.has(pool[i].n));
  return { board: avail.slice(0, 2), queue: avail.slice(2) };
}

type SwipeDir = 'right' | 'left' | 'up' | 'down' | null;

function getDir(dx: number, dy: number): SwipeDir {
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return null;
  if (Math.abs(dy) > Math.abs(dx) * 1.2) return dy < 0 ? 'up' : 'down';
  return dx > 0 ? 'right' : 'left';
}

function StepTaste({ state, onUpdate, onNext }: { state: AppState; onUpdate: (p: Partial<AppState>) => void; onNext: () => void }) {
  const pool = state.mediaType === 'tv' ? POOL_TV : POOL;
  const [images, setImages] = useState<Record<number, string>>({});

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

  // Drag state
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  // 'idle' | 'exiting-right' | 'exiting-left' | 'exiting-up' | 'exiting-down' | 'returning'
  const [animState, setAnimState] = useState<string>('idle');
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLInputElement>(null);

  const rated = history.length;
  const enough = rated >= ENOUGH;
  const favs = state.favorites.length;
  const total = pool.length;

  const frontIdx = board[0];
  const backIdx = board[1] ?? null;

  // Pre-load images for next cards
  useEffect(() => {
    const toPreload = [board[1], board[2] ?? queue[0], queue[1]].filter((v): v is number => v != null);
    toPreload.forEach(i => {
      if (images[i]) {
        const img = new Image();
        img.src = images[i];
      }
    });
  }, [frontIdx, images]); // eslint-disable-line react-hooks/exhaustive-deps

  const performSwipe = useCallback((verdict: 'like' | 'fav' | 'dislike' | 'unseen', dir: SwipeDir) => {
    const idx = board[0];
    if (idx == null) return;

    const name = pool[idx].n;
    const replacement = queue.length ? queue.shift()! : null;
    const entry: TasteHistoryEntry = { cell: 0, idx, verdict, replacedWith: replacement ?? null };
    history.push(entry);

    // Promote back card to front, add replacement at back
    board[0] = board[1] ?? null;
    board[1] = replacement ?? null;

    const newBoard = [...board];
    const newQueue = [...queue];
    const newHistory = [...history];

    if (verdict === 'like') {
      onUpdate({ likesPick: [...state.likesPick, name], board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    } else if (verdict === 'fav') {
      onUpdate({ favorites: [...state.favorites, name], board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    } else if (verdict === 'unseen') {
      onUpdate({ unseen: [...state.unseen, name], board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    } else {
      onUpdate({ dislikesPick: [...state.dislikesPick, name], board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    }

    // Trigger exit animation
    const exitState = dir === 'right' ? 'exiting-right'
      : dir === 'left' ? 'exiting-left'
      : dir === 'up' ? 'exiting-up'
      : 'exiting-down';

    setAnimState(exitState);
    setDrag({ x: 0, y: 0, active: false });

    setTimeout(() => setAnimState('idle'), 320);
  }, [board, queue, history, pool, state, onUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const trySwipe = useCallback((dx: number, dy: number, vx: number, vy: number) => {
    const dir = getDir(dx, dy);
    if (!dir) { setAnimState('returning'); setTimeout(() => setAnimState('idle'), 220); return; }

    const speed = Math.max(Math.abs(vx), Math.abs(vy));
    const dist = Math.max(Math.abs(dx), Math.abs(dy));

    if (dist >= THRESHOLD || speed >= VELOCITY_THRESHOLD) {
      const verdict: 'like' | 'fav' | 'dislike' | 'unseen' =
        dir === 'right' ? 'like'
        : dir === 'left' ? 'dislike'
        : dir === 'up' ? 'fav'
        : 'unseen';
      performSwipe(verdict, dir);
    } else {
      setAnimState('returning');
      setTimeout(() => { setAnimState('idle'); setDrag({ x: 0, y: 0, active: false }); }, 220);
    }
  }, [performSwipe]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (animState !== 'idle' || frontIdx == null) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    setDrag({ x: 0, y: 0, active: true });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.active) return;
    const t = e.touches[0];
    setDrag(d => ({ ...d, x: t.clientX - startRef.current.x, y: t.clientY - startRef.current.y }));
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!drag.active) return;
    const t = e.changedTouches[0];
    const dt = (Date.now() - startRef.current.t) || 1;
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    trySwipe(dx, dy, dx / dt, dy / dt);
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (animState !== 'idle' || frontIdx == null) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setDrag({ x: 0, y: 0, active: true });
  };

  useEffect(() => {
    if (!drag.active) return;
    const onMove = (e: MouseEvent) => {
      setDrag(d => ({ ...d, x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y }));
    };
    const onUp = (e: MouseEvent) => {
      const dt = (Date.now() - startRef.current.t) || 1;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setDrag(d => ({ ...d, active: false }));
      trySwipe(dx, dy, dx / dt, dy / dt);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag.active, trySwipe]);

  const undo = () => {
    if (animState !== 'idle' || !history.length) return;
    const h = history.pop()!;
    const name = pool[h.idx].n;
    // Move current front to back, put undone card back to front
    if (board[1] !== null && h.replacedWith !== null) queue.unshift(h.replacedWith);
    board[1] = board[0];
    board[0] = h.idx;

    const newBoard = [...board];
    const newQueue = [...queue];
    const newHistory = [...history];

    if (h.verdict === 'like') {
      onUpdate({ likesPick: state.likesPick.filter(n => n !== name), board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    } else if (h.verdict === 'fav') {
      onUpdate({ favorites: state.favorites.filter(n => n !== name), board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    } else if (h.verdict === 'unseen') {
      onUpdate({ unseen: state.unseen.filter(n => n !== name), board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
    } else {
      onUpdate({ dislikesPick: state.dislikesPick.filter(n => n !== name), board: newBoard, tasteQueue: newQueue, tasteHistory: newHistory });
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

  // Compute drag-based transform & direction overlay
  const dir = drag.active ? getDir(drag.x, drag.y) : null;
  const dragDist = Math.sqrt(drag.x * drag.x + drag.y * drag.y);
  const overlayOpacity = Math.min(dragDist / THRESHOLD, 1);
  const rotation = drag.active ? (drag.x / 300) * 15 : 0;

  // Front card style
  let frontTransform = `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`;
  let frontTransition = 'none';

  if (animState === 'exiting-right') {
    frontTransform = `translate(120vw, ${drag.y * 0.5}px) rotate(15deg)`;
    frontTransition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
  } else if (animState === 'exiting-left') {
    frontTransform = `translate(-120vw, ${drag.y * 0.5}px) rotate(-15deg)`;
    frontTransition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
  } else if (animState === 'exiting-up') {
    frontTransform = `translate(${drag.x * 0.5}px, -120vh) rotate(${rotation}deg)`;
    frontTransition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
  } else if (animState === 'exiting-down') {
    frontTransform = `translate(${drag.x * 0.5}px, 120vh) rotate(${rotation}deg)`;
    frontTransition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
  } else if (animState === 'returning') {
    frontTransform = 'translate(0px, 0px) rotate(0deg)';
    frontTransition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';
  }

  const isExiting = animState.startsWith('exiting');

  // Direction overlay colors/labels
  const overlayMap: Record<string, { color: string; emoji: string; label: string; position: string }> = {
    right: { color: 'rgba(50,200,80,0.85)', emoji: '❤️', label: 'GOSTEI', position: 'top-left' },
    left:  { color: 'rgba(220,60,60,0.85)',  emoji: '👎', label: 'NÃO CURTI', position: 'top-right' },
    up:    { color: 'rgba(255,177,60,0.85)', emoji: '⭐', label: 'FAVORITO', position: 'top-center' },
    down:  { color: 'rgba(120,120,140,0.85)',emoji: '🤷', label: 'NÃO ASSISTI', position: 'center' },
  };

  const activeOverlay = dir ? overlayMap[dir] : null;

  return (
    <>
      <h1 className="q"><em>Calibrando</em> seu gosto</h1>

      {enough && (
        <div className="tbanner">
          ✅ <b>Já te conheço bem!</b> Pode avançar — ou continue marcando à vontade.
        </div>
      )}

      {/* Card stack */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 8, userSelect: 'none' }}>
        {/* Back card */}
        {backIdx != null && !isExiting && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%) scale(0.95)',
            opacity: 0.6,
            width: '100%',
            maxWidth: 340,
            maxHeight: 440,
            borderRadius: 16,
            overflow: 'hidden',
            pointerEvents: 'none',
            transition: animState === 'idle' ? 'transform 0.3s ease, opacity 0.3s ease' : 'none',
          }}>
            <SwipeCard
              item={pool[backIdx]}
              image={images[backIdx]}
              grad={GRAD[backIdx % GRAD.length]}
              overlay={null}
              overlayOpacity={0}
            />
          </div>
        )}
        {/* Back card promotes when front exits */}
        {backIdx != null && isExiting && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%) scale(1)',
            opacity: 1,
            width: '100%',
            maxWidth: 340,
            maxHeight: 440,
            borderRadius: 16,
            overflow: 'hidden',
            pointerEvents: 'none',
            transition: 'transform 0.3s ease, opacity 0.3s ease',
          }}>
            <SwipeCard
              item={pool[backIdx]}
              image={images[backIdx]}
              grad={GRAD[backIdx % GRAD.length]}
              overlay={null}
              overlayOpacity={0}
            />
          </div>
        )}

        {/* Front card */}
        {frontIdx != null ? (
          <div
            ref={cardRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 340,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              transform: frontTransform,
              transition: frontTransition,
              cursor: drag.active ? 'grabbing' : 'grab',
              touchAction: 'none',
              zIndex: 2,
            }}
          >
            <SwipeCard
              item={pool[frontIdx]}
              image={images[frontIdx]}
              grad={GRAD[frontIdx % GRAD.length]}
              overlay={activeOverlay}
              overlayOpacity={overlayOpacity}
            />
            {/* ⭐ absolute on card bottom-right */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={() => { if (animState === 'idle') performSwipe('fav', 'up'); }}
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255,177,60,0.18)',
                border: '1.5px solid rgba(255,177,60,0.5)',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 5,
              }}
            >
              ⭐
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 340, height: 380, borderRadius: 16, background: 'var(--raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Tudo avaliado!
          </div>
        )}
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 18 }}>
        <ActionBtn emoji="👎" color="rgba(255,255,255,0.08)" size={52} onClick={() => { if (animState === 'idle' && frontIdx != null) performSwipe('dislike', 'left'); }} title="Não curti" />
        <ActionBtn emoji="🤷" color="rgba(255,255,255,0.08)" size={52} onClick={() => { if (animState === 'idle' && frontIdx != null) performSwipe('unseen', 'down'); }} title="Não assisti" />
        <ActionBtn emoji="❤️" color="rgba(255,92,154,0.15)" size={52} onClick={() => { if (animState === 'idle' && frontIdx != null) performSwipe('like', 'right'); }} title="Gostei" />
      </div>

      {/* Undo button — hidden until first swipe */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10, minHeight: 36 }}>
        {rated > 0 && (
          <button
            onClick={undo}
            disabled={animState !== 'idle'}
            title="Desfazer"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 17,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ↩️
          </button>
        )}
      </div>

      {/* Counter */}
      <div className="tcount" style={{ marginTop: 4 }}>
        {rated > 0
          ? <><b>{rated}/{total}</b> avaliados{favs ? ` · ⭐ ${favs} favorito${favs > 1 ? 's' : ''}` : ''}</>
          : <span style={{ fontSize: 11 }}>← arraste ou use os botões →</span>}
      </div>

      {/* Continue button — fixed styling based on enough */}
      <button
        onClick={onNext}
        style={{
          width: '100%',
          marginTop: 14,
          borderRadius: 14,
          padding: '16px',
          fontSize: 15,
          fontFamily: 'var(--body)',
          cursor: 'pointer',
          fontWeight: enough ? 700 : 400,
          background: enough ? '#FFB13C' : 'transparent',
          color: enough ? '#13111C' : 'var(--muted)',
          border: enough ? 'none' : '1.5px dashed var(--line)',
          transition: 'all 0.3s ease',
        }}
      >
        {enough ? 'Já sei o que você gosta ✨ Continuar' : 'Pular etapa (seguir direto)'}
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

/* ---- Single card face ---- */
function SwipeCard({
  item, image, grad, overlay, overlayOpacity,
}: {
  item: { n: string; t: string };
  image: string | undefined;
  grad: [string, string];
  overlay: { color: string; emoji: string; label: string; position: string } | null;
  overlayOpacity: number;
}) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '2/3',
      maxHeight: 440,
      background: `linear-gradient(150deg, ${grad[0]}, ${grad[1]})`,
      overflow: 'hidden',
      borderRadius: 16,
    }}>
      {image && (
        <img
          src={image}
          alt={item.n}
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* Bottom shade + text */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '40px 14px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 2,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 3 }}>
          {item.t}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.25, fontFamily: 'var(--display)' }}>
          {item.n}
        </div>
      </div>

      {/* Direction overlays */}
      {overlay && overlayOpacity > 0.05 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: overlay.color,
          opacity: overlayOpacity * 0.55,
          zIndex: 3,
          borderRadius: 16,
        }} />
      )}
      {overlay && overlayOpacity > 0.1 && (
        <div style={{
          position: 'absolute',
          zIndex: 4,
          ...(overlay.position === 'top-left'   ? { top: 16, left: 16 }   : {}),
          ...(overlay.position === 'top-right'  ? { top: 16, right: 16 }  : {}),
          ...(overlay.position === 'top-center' ? { top: 16, left: '50%', transform: 'translateX(-50%)' } : {}),
          ...(overlay.position === 'center'     ? { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' } : {}),
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 10,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: Math.min(overlayOpacity * 1.5, 1),
        }}>
          <span style={{ fontSize: 18 }}>{overlay.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>{overlay.label}</span>
        </div>
      )}
    </div>
  );
}

/* ---- Action button ---- */
function ActionBtn({ emoji, color, size, onClick, title }: { emoji: string; color: string; size: number; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        border: '1px solid var(--line)',
        fontSize: size * 0.44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {emoji}
    </button>
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
