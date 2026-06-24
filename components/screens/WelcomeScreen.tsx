'use client';

const VERSION = 'v0.1';

interface Props {
  onStart: () => void;
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
        Diga como você chega. O MatchCine escolhe{' '}
        <strong style={{ color: 'var(--ink)' }}>um</strong> filme pro seu
        momento — e só do que você já assina.
      </p>
      <div className="how">
        <b>como chego</b> <i>→</i> <b>com quem estou</b> <i>→</i> meu filme 🍿
      </div>
      <button className="btn btn-primary" onClick={onStart}>
        Bora começar
      </button>
      <button className="skip" onClick={onSkip}>
        Já me conhece? Pular pro filme
      </button>
      <div className="credit">
        by <b>Dionatan Schmidt</b> · {VERSION}
      </div>
    </>
  );
}