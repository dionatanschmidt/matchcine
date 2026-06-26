import type { AvaliacaoDB } from './types';

const KEY        = 'sessao_anon';
const DEVICE_KEY = 'device_id';
const DAILY_KEY  = 'uso_diario_anon';

interface DailyCount { data: string; contagem: number; }

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch { return ''; }
}

export function getLocalDailyCount(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as DailyCount;
    return parsed.data === today ? parsed.contagem : 0;
  } catch { return 0; }
}

export function incrementLocalDailyCount(): void {
  if (typeof window === 'undefined') return;
  const today = new Date().toISOString().slice(0, 10);
  const current = getLocalDailyCount();
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({ data: today, contagem: current + 1 }));
  } catch {}
}

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
