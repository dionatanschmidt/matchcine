'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  isLogged: boolean;
  pendingEmail?: string | null;
  onBack: () => void;
}

export default function LimitScreen({ isLogged, pendingEmail, onBack }: Props) {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, gap: 16, padding: '0 8px', textAlign: 'center',
    }}>
      {isLogged ? (
        <>
          <span style={{ fontSize: 52, lineHeight: 1 }}>🌙</span>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, margin: 0 }}>
            Limite de hoje atingido
          </h2>
          <p className="sub" style={{ margin: 0 }}>
            Você usou suas 50 buscas de hoje.<br />Volte amanhã para continuar!
          </p>
        </>
      ) : pendingEmail ? (
        <>
          <span style={{ fontSize: 52, lineHeight: 1 }}>📩</span>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, margin: 0 }}>
            Limite de hoje atingido
          </h2>
          <p className="sub" style={{ margin: 0 }}>
            Enviamos um link para <b>{pendingEmail}</b>.<br />
            Abra seu e-mail para confirmar e continuar usando o MatchCine.
          </p>
        </>
      ) : sent ? (
        <>
          <span style={{ fontSize: 52, lineHeight: 1 }}>✉️</span>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, margin: 0 }}>
            Link enviado!
          </h2>
          <p className="sub" style={{ margin: 0 }}>
            Confira seu e-mail para ativar sua conta<br />e ter 50 buscas por dia.
          </p>
        </>
      ) : (
        <>
          <span style={{ fontSize: 52, lineHeight: 1 }}>💾</span>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, margin: 0 }}>
            Você usou suas 10 buscas de hoje!
          </h2>
          <p className="sub" style={{ margin: 0 }}>
            Cadastre seu e-mail para ter 50 por dia
          </p>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', maxWidth: 320, marginTop: 8 }}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              className="nudge-input"
              style={{ flex: 1, padding: '16px', fontSize: 16, borderRadius: 14 }}
            />
            <button
              className="nudge-send"
              onClick={handleSend}
              disabled={loading || !email.trim()}
              style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, padding: 0, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {loading ? '…' : '→'}
            </button>
          </div>
        </>
      )}

      <button className="skip" onClick={onBack} style={{ marginTop: 20 }}>
        ← Voltar
      </button>
    </div>
  );
}
