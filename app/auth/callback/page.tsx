'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { loadLocal, clearLocal } from '@/lib/storage';
import { loadProfile, saveProfile, saveAvaliacao } from '@/lib/db';

export default function AuthCallback() {
  useEffect(() => {
    const run = async () => {
      // 1. Troca o código pelo token de sessão (fluxo PKCE)
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }

      // 2. Lê a sessão agora ativa
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const userId = session.user.id;

        // 3. Lê dados anônimos salvos no localStorage
        const local = loadLocal();

        if (local) {
          // 3a. Migra preferências → perfil (só se ainda não tiver perfil)
          const existing = await loadProfile(userId);
          if (!existing) {
            await saveProfile(userId, {
              streamings:      local.services        ?? [],
              ama:             local.likesPick        ?? [],
              favoritos:       local.favorites        ?? [],
              evita:           local.dislikesPick     ?? [],
              final_preferido: local.endings          ?? null,
            }).catch(() => {});
          }

          // 3b. Migra avaliações locais → banco (sem deduplica: OK para o uso)
          for (const av of local.localAvaliacoes ?? []) {
            await saveAvaliacao(userId, av).catch(() => {});
          }

          // 3c. Limpa localStorage — dados agora estão no Supabase
          clearLocal();
        }
      }

      // 4. Volta para o app
      window.location.replace('/');
    };

    run();
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#13111C',
      color: '#F6F1EA',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'italic',
    }}>
      Entrando e salvando seu histórico…
    </div>
  );
}
