'use client';
import type { AppState } from '@/lib/types';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onRecommend: (overrides?: Partial<AppState>) => void;
}

const GENRES = ['Ação', 'Terror', 'Comédia', 'Drama', 'Ficção', 'Romance', 'Suspense', 'Animação', 'Documentário'];

export default function ContextScreen({ state, onUpdate, onRecommend }: Props) {
  const { step, ctx } = state;

  const setCtx = (key: keyof typeof ctx, value: string) => {
    onUpdate({ ctx: { ...ctx, [key]: value }, step: step + 1 });
  };

  const expressGo = () => {
    onRecommend({ express: true, opposite: false, shown: [] });
  };

  const prog = [0, 1, 2, 3].map(i => (
    <i key={i} className={i <= step ? 'done' : ''} />
  ));

  let body: React.ReactNode;

  if (step === 0) {
    body = (
      <>
        <h1 className="q">Como você chega pro filme <em>hoje?</em></h1>
        <p className="sub">Me diz como você está agora — eu decido se combino com o clima ou se te levanto.</p>
        <div className="cards">
          <FCard v="cansado" ico="😮‍💨" t="Cansado" c="quero desligar a cabeça" onClick={() => setCtx('feel', 'cansado')} />
          <FCard v="agitado" ico="🌀" t="Agitado, ansioso" c="preciso desacelerar" onClick={() => setCtx('feel', 'agitado')} />
          <FCard v="entediado" ico="🥱" t="Entediado" c="me fisga, por favor" onClick={() => setCtx('feel', 'entediado')} />
          <FCard v="pra_baixo" ico="🌧️" t="Meio pra baixo" c="algo que me levante ou me deixe sentir" onClick={() => setCtx('feel', 'pra_baixo')} />
          <FCard v="tranquilo" ico="🍃" t="Tranquilo" c="aberto a qualquer coisa boa" onClick={() => setCtx('feel', 'tranquilo')} />
          <FCard v="ligado" ico="🔥" t="A fim de intensidade" c="pode vir pesado" onClick={() => setCtx('feel', 'ligado')} />
        </div>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <h1 className="q">Com quem <em>você está?</em></h1>
        <p className="sub">Muda bastante o que cai bem.</p>
        <div className="cards">
          <CCard k="company" v="sozinho" ico="🛋️" t="Sozinho, no meu canto" onClick={() => setCtx('company', 'sozinho')} />
          <CCard k="company" v="dois" ico="💑" t="A dois" onClick={() => setCtx('company', 'dois')} />
          <CCard k="company" v="amigos" ico="🍻" t="Com amigos" onClick={() => setCtx('company', 'amigos')} />
          <CCard k="company" v="familia_kids" ico="👨‍👩‍👧" t="Família, com crianças" onClick={() => setCtx('company', 'familia_kids')} />
          <CCard k="company" v="familia" ico="🧑‍🤝‍🧑" t="Família, só gente grande" onClick={() => setCtx('company', 'familia')} />
        </div>
        <button className="express" onClick={expressGo}>Já chega — me dá o filme ⚡</button>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <h1 className="q">Quanto <em>fôlego</em> você tem?</h1>
        <p className="sub">De algo curto pra deixar rolando a um filme que exige você inteiro.</p>
        <div className="cards">
          <CCard k="energy" v="baixo" ico="🪫" t="Pouco" c="algo leve e curto, dá pra mexer no celular" onClick={() => setCtx('energy', 'baixo')} />
          <CCard k="energy" v="medio" ico="🔋" t="Médio" c="quero curtir, mas sem esforço" onClick={() => setCtx('energy', 'medio')} />
          <CCard k="energy" v="alto" ico="⚡" t="Total" c="me dá algo denso e longo, presto atenção em tudo" onClick={() => setCtx('energy', 'alto')} />
        </div>
        <button className="express" onClick={expressGo}>Já chega — me dá o filme ⚡</button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="q">Tem um <em>gênero</em> na cabeça?</h1>
        <p className="sub">Ou deixa comigo — escolho pelo seu momento.</p>
        <button
          className="card"
          style={{ marginBottom: 16 }}
          onClick={() => onRecommend({ ctx: { ...ctx, genre: null }, express: false, opposite: false, shown: [] })}
        >
          <span className="ico">🎲</span>
          <div>
            Escolhe por mim<span className="cap">o melhor pro seu estado agora</span>
          </div>
        </button>
        <div className="genres">
          {GENRES.map(g => (
            <button
              key={g}
              className={`gtag${ctx.genre === g ? ' on' : ''}`}
              onClick={() => onUpdate({ ctx: { ...ctx, genre: g } })}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => onRecommend({ express: false, opposite: false, shown: [] })}
        >
          Me dá um filme
        </button>
      </>
    );
  }

  return (
    <>
      <div className="eyebrow">
        <span>Agora há pouco</span><span className="dot">●</span>
      </div>
      <div className="prog">{prog}</div>
      {body}
    </>
  );
}

function FCard({ ico, t, c, onClick }: { v: string; ico: string; t: string; c: string; onClick: () => void }) {
  return (
    <button className="card" onClick={onClick}>
      <span className="ico">{ico}</span>
      <div>{t}<span className="cap">{c}</span></div>
    </button>
  );
}

function CCard({ ico, t, c, onClick }: { k: string; v: string; ico: string; t: string; c?: string; onClick: () => void }) {
  return (
    <button className="card" onClick={onClick}>
      <span className="ico">{ico}</span>
      <div>{t}{c && <span className="cap">{c}</span>}</div>
    </button>
  );
}