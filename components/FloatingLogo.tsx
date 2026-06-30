'use client';

interface Props {
  onSkipToResult: () => void;
}

export default function FloatingLogo({ onSkipToResult }: Props) {
  return (
    <button
      onClick={onSkipToResult}
      title="Pular para o resultado"
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(255,177,60,0.35)',
        overflow: 'hidden',
        zIndex: 100,
        background: 'transparent',
      }}
    >
      <img
        src="/logo-icon.png.png"
        alt="Ir ao resultado"
        width={52}
        height={52}
        style={{ objectFit: 'cover', display: 'block', borderRadius: '50%' }}
      />
    </button>
  );
}
