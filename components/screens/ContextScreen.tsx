'use client';
import type { AppState } from '@/lib/types';

interface Props {
  state: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onRecommend: (overrides?: Partial<AppState>) => void;
  onBack: () => void;
}

export default function ContextScreen({ state, onUpdate, onRecommend, onBack }: Props) {
  const { step, ctx } = state;
  const isTV = state.mediaType === 'tv';

  const totalSteps = isTV ? 2 : 3;

  const handleBack = () => {
    if (step > 0) onUpdate({ step: step - 1 });
    else onBack();
  };

  const prog = Array.from({ length: totalSteps }, (_, i) => (
    <i key={i} className={i <= step ? 'done' : ''} />
  ));

  // Company step shared between TV (step 0) and movie (step 1)
  const isCompanyStep = (isTV && step === 0) || (!isTV && step === 1);
  // Energy/episode step: TV step 1 or movie step 2
  const isEnergyStep = (isTV && step === 1) || (!isTV && step === 2);

  let body: React.ReactNode;

  if (!isTV && step === 0) {
    // Movie only: mood/feel step
    const setCtx = (key: keyof typeof ctx, value: string) => {
      onUpdate({ ctx: { ...ctx, [key]: value }, step: step + 1 });
    };
    body = (
      <>
        <h1 className="q">Qual a sua <em>vibe hoje?</em></h1>
        <p className="sub">Me diz como você está agora</p>
        <div className="cards">
          <FCard v="cansado"   ico="😮‍💨" t="Cansado"              c="quero desligar a cabeça"                    onClick={() => setCtx('feel', 'cansado')} />
          <FCard v="agitado"   ico="🌀"  t="Agitado, ansioso"     c="preciso desacelerar"                        onClick={() => setCtx('feel', 'agitado')} />
          <FCard v="entediado" ico="🥱"  t="Entediado"            c="me fisga, por favor"                        onClick={() => setCtx('feel', 'entediado')} />
          <FCard v="pra_baixo" ico="🌧️" t="Meio pra baixo"       c="algo que me levante ou me deixe sentir"     onClick={() => setCtx('feel', 'pra_baixo')} />
          <FCard v="tranquilo" ico="🍃"  t="Tranquilo"            c="aberto a qualquer coisa boa"                onClick={() => setCtx('feel', 'tranquilo')} />
          <FCard v="ligado"    ico="🔥"  t="A fim de intensidade" c="pode vir pesado"                            onClick={() => setCtx('feel', 'ligado')} />
        </div>
      </>
    );
  } else if (isCompanyStep) {
    const defaultEnergy = isTV ? 'padrao' : 'medio';

    const selectCompany = (value: string) => {
      onUpdate({ ctx: { ...ctx, company: value } });
    };

    const goToResult = () => {
      onRecommend({
        ctx: { ...ctx, energy: ctx.energy || defaultEnergy },
        express: false,
        opposite: false,
        shown: [],
      });
    };

    const goToEnergy = () => {
      onUpdate({ step: step + 1 });
    };

    body = (
      <>
        <h1 className="q">Com quem <em>você está?</em></h1>
        <p className="sub">Muda bastante o que cai bem.</p>
        <div className="cards">
          <CCard k="company" v="sozinho"      ico="🛋️"        t="Sozinho, no meu canto"      selected={ctx.company === 'sozinho'}      onClick={() => selectCompany('sozinho')} />
          <CCard k="company" v="dois"         ico="💑"         t="A dois"                     selected={ctx.company === 'dois'}         onClick={() => selectCompany('dois')} />
          <CCard k="company" v="amigos"       ico="🍻"         t="Com amigos"                 selected={ctx.company === 'amigos'}       onClick={() => selectCompany('amigos')} />
          <CCard k="company" v="familia_kids" ico="👨‍👩‍👧"  t="Família, com crianças"     selected={ctx.company === 'familia_kids'} onClick={() => selectCompany('familia_kids')} />
          <CCard k="company" v="familia"      ico="🧑‍🤝‍🧑" t="Família, só gente grande"  selected={ctx.company === 'familia'}      onClick={() => selectCompany('familia')} />
        </div>
        <div style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--bg)',
          paddingTop: 12,
          paddingBottom: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <button
            onClick={goToResult}
            style={{
              width: '100%',
              background: '#FFB13C',
              color: '#13111C',
              fontWeight: 700,
              borderRadius: 14,
              padding: '16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              fontFamily: 'var(--body)',
            }}
          >
            ✨ Mostrar minha indicação
          </button>
          <button
            onClick={goToEnergy}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              fontWeight: 400,
              borderRadius: 14,
              padding: '14px',
              cursor: 'pointer',
              fontSize: 15,
              fontFamily: 'var(--body)',
            }}
          >
            Continuar refinando a busca →
          </button>
        </div>
      </>
    );
  } else if (isEnergyStep) {
    const goWithEnergy = (energyVal: string) =>
      onRecommend({ ctx: { ...ctx, energy: energyVal }, express: false, opposite: false, shown: [] });

    if (isTV) {
      body = (
        <>
          <h1 className="q">Qual o tamanho do <em>episódio?</em></h1>
          <p className="sub">Escolhe o ritmo ideal</p>
          <div className="cards">
            <CCard k="energy" v="curtinho" ico="⚡"  t="Curtinho (~20 min)" c="Pra almoçar ou relaxar rápido"    onClick={() => goWithEnergy('curtinho')} />
            <CCard k="energy" v="padrao"   ico="📺"  t="Padrão (~40 min)"   c="O clássico drama ou suspense"     onClick={() => goWithEnergy('padrao')} />
            <CCard k="energy" v="longo"    ico="🎬"  t="Tamanho de filme (+1h)" c="Produções épicas"            onClick={() => goWithEnergy('longo')} />
            <CCard k="energy" v="qualquer" ico="🤷"  t="Tanto faz"          c="Qualquer duração"                 onClick={() => goWithEnergy('qualquer')} />
          </div>
        </>
      );
    } else {
      body = (
        <>
          <h1 className="q">Qual seu nível de <em>energia agora?</em></h1>
          <p className="sub">De algo curto pra deixar rolando a um filme que exige você inteiro.</p>
          <div className="cards">
            <CCard k="energy" v="baixo" ico="🪫" t="Pouco"  c="algo leve e curto, dá pra mexer no celular"      onClick={() => goWithEnergy('baixo')} />
            <CCard k="energy" v="medio" ico="🔋" t="Médio"  c="quero curtir, mas sem esforço"                    onClick={() => goWithEnergy('medio')} />
            <CCard k="energy" v="alto"  ico="⚡" t="Total"  c="me dá algo denso e longo, presto atenção em tudo" onClick={() => goWithEnergy('alto')} />
          </div>
        </>
      );
    }
  }

  return (
    <>
      <div className="eyebrow">
        <span>Agora há pouco</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleBack}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 20,
              color: 'var(--muted)',
              padding: '2px 10px',
              fontSize: 13,
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            ‹ Voltar
          </button>
          <span className="dot">●</span>
        </span>
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

function CCard({ ico, t, c, onClick, selected }: { k: string; v: string; ico: string; t: string; c?: string; onClick: () => void; selected?: boolean }) {
  return (
    <button
      className="card"
      onClick={onClick}
      style={selected ? { borderColor: 'var(--amber)', background: 'var(--raised-2)' } : undefined}
    >
      <span className="ico">{ico}</span>
      <div>{t}{c && <span className="cap">{c}</span>}</div>
    </button>
  );
}
