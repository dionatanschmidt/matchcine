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
    await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    }).catch(() => {});
    setSent(true);
    setLoading(false);
    // Fecha o nudge automaticamente após 5 s
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
      <span className="nudge-label">💾 Salvar em qualquer dispositivo?</span>
      <input
        className="nudge-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seu@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
      />
      <button
        className="nudge-send"
        onClick={handleSend}
        disabled={loading || !email.trim()}
      >
        {loading ? '…' : '→'}
      </button>
      <button className="nudge-x" onClick={onDismiss}>×</button>
    </div>
  );
}
