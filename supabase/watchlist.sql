-- Tabela de filmes salvos para assistir depois
CREATE TABLE watchlist (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  poster_path TEXT,
  ano INTEGER,
  generos TEXT,
  streaming TEXT,
  salvo_em TIMESTAMPTZ DEFAULT NOW(),
  avaliado BOOLEAN DEFAULT FALSE,
  veredito TEXT,
  avaliado_em TIMESTAMPTZ,
  UNIQUE (usuario_id, tmdb_id)
);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_proprio" ON watchlist
  FOR ALL USING (auth.uid() = usuario_id);
