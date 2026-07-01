'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const VERSION = 'v0.4';

interface Props {
  onStart: (mediaType: 'movie' | 'tv') => void;
  onSkip: () => void;
  userId?: string | null;
  userEmail?: string | null;
}

export default function WelcomeScreen({ onStart, onSkip, userId, userEmail }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <div className="glowblob one" />
      <div className="glowblob two" />
      {userId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button
            onClick={() => router.push('/perfil')}
            title="Meu perfil"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--line)',
              color: 'var(--muted)', fontSize: 16,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >👤</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 12 }}>
        <Image
          src="/logo-main.png.png"
          alt="MatchCine"
          height={120}
          width={240}
          style={{ objectFit: 'contain', height: 120, width: 'auto', maxWidth: 180 }}
          priority
        />
      </div>
      <div className="welcome-logo">
        MatchCine <span className="welcome-ver">{VERSION}</span>
      </div>
      <h1 className="welcome-h1">
        Escolha seu próximo filme<br />em menos de <em>1 minuto</em>
      </h1>
      <p className="sub">
        Mais de 500 mil títulos de todos os streamings, sem precisar rolar a noite inteira
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

      {/* Botão salvar progresso / estado logado */}
      {userId ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginTop: 12,
        }}>
          <span style={{ color: 'var(--ok)', fontSize: 13 }}>
            ✓ Progresso salvo · {userEmail ?? ''}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted-2)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Sair
          </button>
        </div>
      ) : (
        <button
          onClick={() => router.push('/entrar')}
          style={{
            marginTop: 12,
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '10px 20px',
            color: 'var(--muted)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--body)',
            width: '100%',
          }}
        >
          💾 Salvar meu progresso
        </button>
      )}

      <button className="skip" onClick={onSkip}>
        Já me conhece? Pular pro filme
      </button>
      <div className="credit">
        by <b>Dionatan Schmidt</b> · {VERSION}
      </div>
    </>
  );
}
