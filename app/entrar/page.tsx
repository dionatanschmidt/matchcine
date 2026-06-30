'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { loadLocal, clearLocal } from '@/lib/storage';
import { loadProfile, saveProfile, saveAvaliacao } from '@/lib/db';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

async function migrateLocalData(userId: string) {
  const local = loadLocal();
  if (!local) return;

  const existing = await loadProfile(userId);
  if (!existing) {
    await saveProfile(userId, {
      streamings:      local.services        ?? [],
      ama:             local.likesPick       ?? [],
      favoritos:       local.favorites       ?? [],
      evita:           local.dislikesPick    ?? [],
      final_preferido: local.endings         ?? null,
    }).catch(() => {});
  }

  for (const av of local.localAvaliacoes ?? []) {
    await saveAvaliacao(userId, av).catch(() => {});
  }

  clearLocal();
}

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [code, setCode]         = useState('');
  const [step, setStep]         = useState<'form' | 'otp'>('form');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) { setError('Não foi possível enviar o código. Tente novamente.'); return; }
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmed,
      type: 'email',
    });
    if (err || !data.session) {
      setLoading(false);
      setError('Código inválido ou expirado. Tente novamente.');
      return;
    }
    await migrateLocalData(data.session.user.id);
    router.push('/');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '14px 16px',
    color: 'var(--ink)',
    fontSize: 16,
    fontFamily: 'var(--body)',
    outline: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#13111C',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        {/* Logo */}
        <Image
          src="/logo-main.png.png"
          alt="MatchCine"
          height={80}
          width={240}
          style={{ objectFit: 'contain', marginBottom: 28 }}
          priority
        />

        {/* Título */}
        <h1 style={{
          fontFamily: 'var(--display)',
          fontSize: 24,
          fontWeight: 500,
          color: 'var(--ink)',
          margin: '0 0 8px',
          textAlign: 'center',
        }}>
          Salvar meu progresso
        </h1>
        <p style={{
          color: 'var(--muted)',
          fontSize: 14,
          lineHeight: 1.5,
          textAlign: 'center',
          margin: '0 0 28px',
        }}>
          Suas escolhas ficam salvas em qualquer dispositivo
        </p>

        {/* Botão Google */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#fff',
            color: '#13111C',
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 14,
            padding: '16px',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 20,
            fontFamily: 'var(--body)',
          }}
        >
          <GoogleIcon />
          Continuar com Google
        </button>

        {/* Separador */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        {/* Formulário OTP */}
        {step === 'form' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendOtp(); }}
              style={inputStyle}
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || !email.trim()}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid var(--amber)',
                color: 'var(--amber)',
                borderRadius: 12,
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'var(--body)',
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !email.trim() ? 0.5 : 1,
              }}
            >
              {loading ? 'Enviando…' : 'Receber código'}
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 4px', textAlign: 'center' }}>
              Código enviado para <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyOtp(); }}
              style={{
                ...inputStyle,
                letterSpacing: '0.3em',
                textAlign: 'center',
                fontSize: 22,
              }}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading || code.trim().length !== 6}
              style={{
                width: '100%',
                background: 'var(--amber)',
                color: '#13111C',
                border: 'none',
                borderRadius: 12,
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'var(--body)',
                cursor: loading || code.trim().length !== 6 ? 'not-allowed' : 'pointer',
                opacity: loading || code.trim().length !== 6 ? 0.6 : 1,
              }}
            >
              {loading ? 'Verificando…' : 'Entrar'}
            </button>
            <button
              onClick={() => { setStep('form'); setCode(''); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
            >
              ← Usar outro e-mail
            </button>
          </div>
        )}

        {/* Mensagem de erro */}
        {error && (
          <p style={{ color: 'var(--love)', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
            {error}
          </p>
        )}

        {/* Link de volta */}
        <p style={{ color: 'var(--muted-2)', fontSize: 12, marginTop: 32, textAlign: 'center' }}>
          Sem cadastro?{' '}
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            ← Voltar
          </button>
        </p>
      </div>
    </div>
  );
}
