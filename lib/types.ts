export type ViewType = 'auth' | 'welcome' | 'onboard' | 'context' | 'loading' | 'result' | 'done';

export interface AvaliacaoDB {
  tmdb_id: number;
  titulo: string;
  veredito: string;
  humor_no_momento: string | null;
}

export interface Movie {
  tmdb_id?: number;
  titulo: string;
  titulo_original?: string;
  ano: number;
  genero: string;
  duracao: string;
  sinopse?: string;
  tagline: string;
  porque: string;
  onde_assistir: string;
  no_seu_streaming: boolean;
  cor1: string;
  cor2: string;
  poster_path?: string | null;
  _fallback?: boolean;
}

export interface CtxState {
  feel: string | null;
  company: string | null;
  energy: string | null;
  genre: string | null;
}

export interface TasteHistoryEntry {
  cell: number;
  idx: number;
  verdict: 'like' | 'fav' | 'dislike';
  replacedWith: number | null;
}

export interface AppState {
  view: ViewType;
  services: string[];
  likes: string[];
  dislikes: string[];
  likesPick: string[];
  dislikesPick: string[];
  favorites: string[];
  endings: string | null;
  tasteQueue: number[];
  tasteHistory: TasteHistoryEntry[];
  board: (number | null)[];
  tasteInit: boolean;
  ctx: CtxState;
  express: boolean;
  opposite: boolean;
  oppositeOf: string | null;
  loved: string[];
  disliked: string[];
  shown: string[];
  watchedCount: number;
  current: Movie | null;
  step: number;
  onboardStep: number;
  userId: string | null;
  profileLoaded: boolean;
  historicoDB: AvaliacaoDB[];
  localAvaliacoes: AvaliacaoDB[];
  nudgeDismissed: boolean;
}