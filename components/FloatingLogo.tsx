'use client';
import { useEffect, useState } from 'react';

interface Props {
  onSkipToResult: () => void;
}

export default function FloatingLogo({ onSkipToResult }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(window.innerHeight >= 700);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={onSkipToResult}
      title="Pular para o resultado"
      style={{
        position: 'fixed',
        bottom: 120,
        right: 12,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(255,177,60,0.35)',
        overflow: 'hidden',
        zIndex: 10,
        background: 'transparent',
      }}
    >
      <img
        src="/logo-icon.png.png"
        alt="Ir ao resultado"
        width={44}
        height={44}
        style={{ objectFit: 'cover', display: 'block', borderRadius: '50%' }}
      />
    </button>
  );
}
