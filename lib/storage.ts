import type { AvaliacaoDB } from './types';

const KEY = 'sessao_anon';

export interface AnonState {
  services:         string[];
  likesPick:        string[];
  favorites:        string[];
  dislikesPick:     string[];
  endings:          string | null;
  localAvaliacoes:  AvaliacaoDB[];
  watchedCount:     number;
  nudgeDismissed:   boolean;
}

export function loadLocal(): AnonState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnonState) : null;
  } catch {
    return null;
  }
}

export function saveLocal(data: AnonState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function clearLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
