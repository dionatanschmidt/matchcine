'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    }).catch(() => {});
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <>
        <div className="glowblob one" />
        <div className="glowblob two" />
        <div className="welcome-logo">MatchCine</div>
        <h1 className="welcome-h1">Verifique<br />seu <em>e-mail.</em></h1>
        <p className="sub">
          Mandamos um link mágico para{' '}
          <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>.
          Clique nele para entrar — sem senha.
        </p>
        <button className="skip" onClick={() => setSent(false)}>← Usar outro e-mail</button>
      </>
    );
  }

  return (
    <>
      <div className="glowblob one" />
      <div className="glowblob two" />
      <div className="welcome-logo">Sessão</div>
      <h1 className="welcome-h1">O filme certo,<br />sem rolar a<br /><em>noite inteira.</em></h1>
      <p className="sub">Entre para a gente lembrar do seu gosto — e acertar cada vez mais.</p>
      <input
        className="auth-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seu@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
      />
      <button
        className="btn btn-primary"
        style={{ marginTop: 12 }}
        onClick={handleSubmit}
        disabled={loading || !email.trim()}
      >
        {loading ? 'Enviando…' : 'Entrar com e-mail mágico ✨'}
      </button>
    </>
  );
}
