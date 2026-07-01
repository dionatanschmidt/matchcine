'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  onDismiss: () => void;
}

export default function SaveNudge({ onDismiss }: Props) {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    if (typeof window !== 'undefined') localStorage.setItem('pendingEmail', trimmed);
    await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    }).catch(() => {});
    setSent(true);
    setLoading(false);
    setTimeout(onDismiss, 5000);
  };

  if (sent) {
    return (
      <div className="save-nudge sent">
        <span className="nudge-msg">
          ✓ Link enviado para <b>{email.trim()}</b> — confira seu e-mail.
        </span>
        <button className="nudge-x" onClick={onDismiss}>×</button>
      </div>
    );
  }

  return (
    <div className="save-nudge">
      <button className="nudge-x" onClick={onDismiss}>×</button>
      <span className="nudge-label">💾 Salvar em qualquer dispositivo?</span>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          style={{
            flex: 1,
            padding: '14px 16px',
            fontSize: 16,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--line)',
            color: 'white',
            outline: 'none',
            fontFamily: 'var(--body)',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !email.trim()}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: loading || !email.trim() ? 'rgba(255,177,60,0.5)' : '#FFB13C',
            color: '#13111C',
            fontSize: 20,
            flexShrink: 0,
            border: 'none',
            cursor: loading || !email.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >→</button>
      </div>
    </div>
  );
}
