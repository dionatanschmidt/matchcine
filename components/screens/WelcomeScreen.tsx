'use client';

const VERSION = 'v0.1';

interface Props {
  onStart: (mediaType: 'movie' | 'tv') => void;
  onSkip: () => void;
}

export default function WelcomeScreen({ onStart, onSkip }: Props) {
  return (
    <>
      <div className="glowblob one" />
      <div className="glowblob two" />
      <div className="welcome-logo">
        MatchCine <span className="welcome-ver">{VERSION}</span>
      </div>
      <h1 className="welcome-h1">
        O filme certo,<br />sem rolar a<br /><em>noite inteira.</em>
      </h1>
      <p className="sub">
        Responda 3 perguntas rápidas e descubra o que assistir agora —
        {' '}filme ou série, só no que você já tem.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => onStart('movie')}
        >
          🎬 FILMES
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => onStart('tv')}
        >
          📺 SÉRIES
        </button>
      </div>
      <button className="skip" onClick={onSkip}>
        Já me conhece? Pular pro filme
      </button>
      <div className="credit">
        by <b>Dionatan Schmidt</b> · {VERSION}
      </div>
    </>
  );
}
