'use client';
import type { AppState } from '@/lib/types';
import { GENRE_EMOJI, MOODCOLORS } from '@/lib/data';
import { Poster } from './ResultScreen';

interface Props {
  state: AppState;
  onRestart: () => void;
  onReset: () => void;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export default function DoneScreen({ state, onRestart, onReset }: Props) {
  const m = state.current!;
  const c1raw = HEX.test(m.cor1 ?? '') ? m.cor1 : null;
  const c2raw = HEX.test(m.cor2 ?? '') ? m.cor2 : null;
  const f = MOODCOLORS[state.ctx.feel ?? ''] ?? ['#241B30', '#19131F'];
  const c1 = c1raw ?? f[0];
  const c2 = c2raw ?? f[1];
  const emoji = GENRE_EMOJI[m.genero?.split(',')[0]?.trim() ?? ''] ?? '🎬';

  return (
    <>
      <div className="eyebrow"><span>Boa sessão</span><span className="dot">●</span></div>

      <Poster movie={m} c1={c1} c2={c2} emoji={emoji} height={340} />

      <p className="sub" style={{ textAlign: 'center', margin: '18px auto 4px' }}>
        Aproveita 🍿 Vou lembrar que você curtiu isso pra acertar ainda mais da próxima.
      </p>

      <div className="spacer" />

      <button className="btn btn-primary" onClick={onRestart}>Quero outro filme</button>
      <button className="skip" onClick={onReset}>Recomeçar do zero</button>
    </>
  );
}