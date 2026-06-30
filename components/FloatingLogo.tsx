'use client';
import { useEffect, useRef, useState } from 'react';

const SIZE = 44;
const EDGE = 10;
const DRAG_THRESHOLD = 5;
const LS_POS = 'floating_logo_pos';
const LS_CLICKED = 'floatingLogoClicked';

interface Pos { top: number; left: number; }

function clamp(pos: Pos): Pos {
  return {
    top:  Math.max(EDGE, Math.min(window.innerHeight - SIZE - EDGE, pos.top)),
    left: Math.max(EDGE, Math.min(window.innerWidth  - SIZE - EDGE, pos.left)),
  };
}

function defaultPos(): Pos {
  return clamp({ top: window.innerHeight - 120 - SIZE, left: window.innerWidth - 12 - SIZE });
}

function loadPos(): Pos | null {
  try { const r = localStorage.getItem(LS_POS); return r ? (JSON.parse(r) as Pos) : null; } catch { return null; }
}

function savePos(pos: Pos) {
  try { localStorage.setItem(LS_POS, JSON.stringify(pos)); } catch {}
}

interface Props { onSkipToResult: () => void; }

export default function FloatingLogo({ onSkipToResult }: Props) {
  const [visible, setVisible]     = useState(false);
  const [pos, setPos]             = useState<Pos>({ top: 0, left: 0 });
  const [showHint, setShowHint]   = useState(false);
  const buttonRef                  = useRef<HTMLButtonElement>(null);
  const dragRef                    = useRef<{ startX: number; startY: number; posX: number; posY: number; moved: boolean } | null>(null);
  const touchHandledRef            = useRef(false);

  useEffect(() => {
    const check = () => setVisible(window.innerHeight >= 700);
    check();
    const saved = loadPos();
    setPos(saved ? clamp(saved) : defaultPos());
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Non-passive touchmove so we can preventDefault and block scroll while dragging
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      const dr = dragRef.current;
      if (!dr) return;
      const t = e.touches[0];
      const dx = t.clientX - dr.startX;
      const dy = t.clientY - dr.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dr.moved = true;
      }
      if (dr.moved) {
        e.preventDefault();
        setPos(clamp({ top: dr.posY + dy, left: dr.posX + dx }));
      }
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, posX: pos.left, posY: pos.top, moved: false };
  };

  const handleTouchEnd = () => {
    const dr = dragRef.current;
    if (!dr) return;
    dragRef.current = null;
    touchHandledRef.current = true;
    setTimeout(() => { touchHandledRef.current = false; }, 400);
    if (!dr.moved) {
      doAction();
    } else {
      setPos(prev => { savePos(prev); return prev; });
    }
  };

  // Desktop click (suppressed after touch)
  const handleClick = () => {
    if (touchHandledRef.current) return;
    doAction();
  };

  const doAction = () => {
    try {
      if (localStorage.getItem(LS_CLICKED)) {
        onSkipToResult();
      } else {
        setShowHint(true);
      }
    } catch {
      onSkipToResult();
    }
  };

  const confirmHint = () => {
    try { localStorage.setItem(LS_CLICKED, '1'); } catch {}
    setShowHint(false);
    onSkipToResult();
  };

  const cancelHint = () => setShowHint(false);

  if (!visible) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        title="Pular para o resultado"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'grab',
          boxShadow: '0 4px 16px rgba(255,177,60,0.35)',
          overflow: 'hidden',
          zIndex: 10,
          background: 'transparent',
          touchAction: 'none',
        }}
      >
        <img
          src="/logo-icon.png.png"
          alt="Ir ao resultado"
          width={SIZE}
          height={SIZE}
          style={{ objectFit: 'cover', display: 'block', borderRadius: '50%', pointerEvents: 'none' }}
          draggable={false}
        />
      </button>

      {showHint && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.55)' }}
          onClick={cancelHint}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 412,
              margin: '0 auto',
              background: '#1E1A2A',
              borderRadius: '20px 20px 0 0',
              padding: '28px 24px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 42, lineHeight: 1 }}>⚡</span>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 500, margin: 0, textAlign: 'center', color: '#F6F1EA' }}>
              Atalho para o filme
            </h3>
            <p style={{ color: '#A79BB8', fontSize: 14, lineHeight: 1.6, textAlign: 'center', margin: 0 }}>
              Você vai direto para a indicação, mas sem muitos filtros na busca. Vale quando você só quer algo bom agora.
            </p>
            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
              <button
                onClick={confirmHint}
                style={{
                  flex: 1,
                  background: '#FFB13C',
                  color: '#13111C',
                  fontWeight: 700,
                  fontSize: 15,
                  borderRadius: 14,
                  padding: '14px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Entendi, ir ao filme →
              </button>
              <button
                onClick={cancelHint}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#F6F1EA',
                  fontWeight: 500,
                  fontSize: 15,
                  borderRadius: 14,
                  padding: '14px 10px',
                  border: '1px solid #373050',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
