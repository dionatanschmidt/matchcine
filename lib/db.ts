import { supabase } from './supabase';

export interface PerfilRow {
  streamings: string[];
  ama: string[];
  favoritos: string[];
  evita: string[];
  final_preferido: string | null;
}

export interface AvaliacaoRow {
  tmdb_id: number;
  titulo: string;
  veredito: string;
  humor_no_momento: string | null;
}

export async function loadProfile(userId: string): Promise<PerfilRow | null> {
  try {
    const { data, error } = await supabase
      .from('perfis')
      .select('streamings, ama, favoritos, evita, final_preferido')
      .eq('usuario_id', userId)
      .single();
    if (error || !data) return null;
    return data as PerfilRow;
  } catch {
    return null;
  }
}

export async function saveProfile(userId: string, profile: PerfilRow): Promise<void> {
  try {
    await supabase
      .from('perfis')
      .upsert({ usuario_id: userId, ...profile }, { onConflict: 'usuario_id' });
  } catch {
    // silencioso — não crítico para a experiência
  }
}

export async function loadAvaliacoes(userId: string): Promise<AvaliacaoRow[]> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('tmdb_id, titulo, veredito, humor_no_momento')
      .eq('usuario_id', userId)
      .order('criado_em', { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return data as AvaliacaoRow[];
  } catch {
    return [];
  }
}

export async function saveAvaliacao(
  userId: string,
  data: { tmdb_id: number; titulo: string; veredito: string; humor_no_momento: string | null }
): Promise<void> {
  try {
    await supabase.from('avaliacoes').insert({ usuario_id: userId, ...data });
  } catch {
    // silencioso — não crítico
  }
}

export interface WatchlistItem {
  tmdb_id: number;
  titulo: string;
  poster_path: string | null;
  ano: number | null;
  generos: string | null;
  streaming: string | null;
}

export async function addToWatchlist(userId: string, item: WatchlistItem): Promise<void> {
  try {
    await supabase.from('watchlist').insert({ usuario_id: userId, ...item });
  } catch {}
}

export async function isInWatchlist(userId: string, tmdbId: number): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .eq('usuario_id', userId)
      .eq('tmdb_id', tmdbId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
