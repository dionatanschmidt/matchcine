'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveAvaliacao } from '@/lib/db';

interface WatchlistEntry {
  id: number;
  tmdb_id: number;
  titulo: string;
  poster_path: string | null;
  ano: number | null;
  generos: string | null;
  streaming: string | null;
  salvo_em: string;
  avaliado: boolean;
  veredito: string | null;
  avaliado_em: string | null;
}

type Veredito = 'amei' | 'bom' | 'nao_curti';

const VEREDITO_LABEL: Record<string, string> = {
  amei:      '😍 Amei',
  bom:       '👍 Bom filme',
  nao_curti: '😐 Não curti',
};

export default function PerfilPage() {
  const router = useRouter();
  const [userId, setUserId]       = useState<string | null>(null);
  const [email, setEmail]         = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'quero' | 'assisti'>('quero');
  const [ratingItem, setRatingItem] = useState<WatchlistEntry | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/'); return; }
      setUserId(session.user.id);
      setEmail(session.user.email ?? null);
      fetchWatchlist(session.user.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWatchlist = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('watchlist')
      .select('*')
      .eq('usuario_id', uid)
      .order('salvo_em', { ascending: false });
    setWatchlist((data ?? []) as WatchlistEntry[]);
    setLoading(false);
  };

  const handleRate = async (veredito: Veredito) => {
    if (!ratingItem || !userId) return;
    await supabase.from('watchlist').update({
      avaliado:    true,
      veredito,
      avaliado_em: new Date().toISOString(),
    }).eq('usuario_id', userId).eq('tmdb_id', ratingItem.tmdb_id);

    await saveAvaliacao(userId, {
      tmdb_id:          ratingItem.tmdb_id,
      titulo:           ratingItem.titulo,
      veredito,
      humor_no_momento: null,
    }).catch(() => {});

    setWatchlist(prev => prev.map(w =>
      w.tmdb_id === ratingItem.tmdb_id
        ? { ...w, avaliado: true, veredito, avaliado_em: new Date().toISOString() }
        : w
    ));
    setRatingItem(null);
  };

  const queroAssistir = watchlist.filter(w => !w.avaliado);
  const jaAssisti     = watchlist.filter(w => w.avaliado);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1100px 560px at 50% -8%, #2A1E45 0%, transparent 58%), #0C0A14',
      color: '#F6F1EA',
      fontFamily: 'var(--font-inter, system-ui, sans-serif)',
      padding: '0 0 40px',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', color: '#A79BB8', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >←</button>
          <div style={{ fontSize: 34, lineHeight: 1 }}>👤</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F6F1EA' }}>{email ?? ''}</div>
            <div style={{ fontSize: 12, color: '#A79BB8', marginTop: 2 }}>
              {queroAssistir.length} salvo{queroAssistir.length !== 1 ? 's' : ''} · {jaAssisti.length} avaliado{jaAssisti.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['quero', 'assisti'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 12,
                background: tab === t ? '#1E1A2A' : 'transparent',
                border: tab === t ? '1px solid #FFB13C' : '1px solid #373050',
                color: tab === t ? '#F6F1EA' : '#A79BB8',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font-inter, system-ui)',
              }}
            >
              {t === 'quero' ? '📌 Quero assistir' : '✅ Já assisti'}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ color: '#A79BB8', textAlign: 'center', paddingTop: 60 }}>Carregando...</div>
        ) : tab === 'quero' ? (
          queroAssistir.length === 0 ? (
            <EmptyState text={'Nenhum filme salvo ainda.\nUse o botão 📌 nas recomendações!'} />
          ) : (
            queroAssistir.map(w => (
              <WatchlistCard key={w.id} item={w} onRate={() => setRatingItem(w)} />
            ))
          )
        ) : (
          jaAssisti.length === 0 ? (
            <EmptyState text="Nenhum filme avaliado ainda." />
          ) : (
            jaAssisti.map(w => (
              <WatchedCard key={w.id} item={w} />
            ))
          )
        )}
      </div>

      {/* Rating Sheet */}
      {ratingItem && (
        <div
          onClick={() => setRatingItem(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100,
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: '#1E1A2A', borderRadius: '20px 20px 0 0',
              padding: '24px 20px 40px',
            }}
          >
            <h3 style={{
              fontFamily: 'var(--font-fraunces, Georgia, serif)',
              fontSize: 18, fontWeight: 500, margin: '0 0 20px', color: '#F6F1EA',
            }}>
              O que achou de <em>{ratingItem.titulo}</em>?
            </h3>
            {(['amei', 'bom', 'nao_curti'] as Veredito[]).map((v, i) => (
              <button
                key={v}
                onClick={() => handleRate(v)}
                style={{
                  display: 'block', width: '100%', padding: '14px', borderRadius: 12,
                  background: i === 0 ? '#FFB13C' : 'rgba(255,255,255,0.06)',
                  border: i === 0 ? 'none' : '1px solid #373050',
                  color: i === 0 ? '#13111C' : '#F6F1EA',
                  fontWeight: i === 0 ? 700 : 400,
                  fontSize: 15, cursor: 'pointer',
                  fontFamily: 'var(--font-inter, system-ui)',
                  marginBottom: 8,
                }}
              >
                {VEREDITO_LABEL[v]}
              </button>
            ))}
            <button
              onClick={() => setRatingItem(null)}
              style={{
                display: 'block', width: '100%', padding: '12px', borderRadius: 12,
                background: 'none', border: '1px solid #373050',
                color: '#A79BB8', fontSize: 14, cursor: 'pointer',
                fontFamily: 'var(--font-inter, system-ui)', marginTop: 4,
              }}
            >Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WatchlistCard({ item, onRate }: { item: WatchlistEntry; onRate: () => void }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 0', borderBottom: '1px solid #373050',
    }}>
      {item.poster_path ? (
        <img src={item.poster_path} alt={item.titulo}
          style={{ width: 48, height: 72, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 48, height: 72, borderRadius: 6, background: '#1E1A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>🎬</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#F6F1EA', marginBottom: 2, lineHeight: 1.3 }}>
          {item.titulo}
        </div>
        {item.ano && <div style={{ fontSize: 12, color: '#A79BB8' }}>{item.ano}</div>}
        {item.streaming && <div style={{ fontSize: 12, color: '#A79BB8' }}>{item.streaming}</div>}
      </div>
      <button
        onClick={onRate}
        style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid #373050',
          borderRadius: 8, padding: '7px 10px', fontSize: 12,
          color: '#F6F1EA', cursor: 'pointer',
          fontFamily: 'var(--font-inter, system-ui)', flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >✓ Já assisti</button>
    </div>
  );
}

function WatchedCard({ item }: { item: WatchlistEntry }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 0', borderBottom: '1px solid #373050',
    }}>
      {item.poster_path ? (
        <img src={item.poster_path} alt={item.titulo}
          style={{ width: 48, height: 72, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 48, height: 72, borderRadius: 6, background: '#1E1A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>🎬</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#F6F1EA', marginBottom: 2, lineHeight: 1.3 }}>
          {item.titulo}
        </div>
        {item.ano && <div style={{ fontSize: 12, color: '#A79BB8' }}>{item.ano}</div>}
        {item.veredito && (
          <div style={{ fontSize: 13, color: '#FFB13C', marginTop: 3 }}>
            {VEREDITO_LABEL[item.veredito] ?? item.veredito}
          </div>
        )}
        {item.avaliado_em && (
          <div style={{ fontSize: 11, color: '#6E6588', marginTop: 2 }}>
            {new Date(item.avaliado_em).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ color: '#A79BB8', textAlign: 'center', paddingTop: 60, fontSize: 14, lineHeight: 1.6 }}>
      {text.split('\n').map((line, i) => <p key={i} style={{ margin: '0 0 4px' }}>{line}</p>)}
    </div>
  );
}
