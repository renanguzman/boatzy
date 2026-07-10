'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, X } from 'lucide-react';

const STORAGE_KEY = 'boatzy:tutorial-painel:v1';

type Passo = {
  /** Seletor do elemento destacado. `null` exibe o passo centralizado, sem spotlight. */
  alvo: string | null;
  titulo: string;
  descricao: string;
  /** Ação opcional exibida como botão extra (ex.: navegar para o cadastro). */
  acao?: { label: string; href: string };
};

const PASSOS: Passo[] = [
  {
    alvo: null,
    titulo: 'Bem-vindo ao painel Boatzy',
    descricao:
      'Em menos de um minuto você conhece as áreas do painel e sai com o caminho pronto para publicar sua primeira embarcação.',
  },
  {
    alvo: '[data-tour="dashboard-content"]',
    titulo: 'Seu Dashboard',
    descricao:
      'Aqui ficam os números do seu negócio: reservas pendentes e confirmadas, receita estimada, desempenho da frota e as próximas saídas. É a primeira tela que você vê ao entrar.',
  },
  {
    alvo: '[data-tour="nav-dashboard"]',
    titulo: 'Dashboard',
    descricao: 'Volte a qualquer momento para a visão geral com indicadores e reservas recentes.',
  },
  {
    alvo: '[data-tour="nav-agendamentos"]',
    titulo: 'Agendamentos',
    descricao:
      'Todas as solicitações de reserva chegam aqui. Você confirma, recusa e acompanha as viagens já concluídas.',
  },
  {
    alvo: '[data-tour="nav-embarcacoes"]',
    titulo: 'Embarcações',
    descricao:
      'Cadastre e gerencie sua frota: fotos, capacidade, preços e disponibilidade de cada barco.',
  },
  {
    alvo: '[data-tour="nav-roteiros"]',
    titulo: 'Roteiros',
    descricao:
      'Monte passeios prontos para venda — destino, duração, o que está incluso e a embarcação usada.',
  },
  {
    alvo: '[data-tour="nav-catalogo"]',
    titulo: 'Catálogo',
    descricao:
      'Itens e serviços opcionais (bebidas, petiscos, equipamentos) que você pode incluir nos roteiros.',
  },
  {
    alvo: '[data-tour="nav-clientes"]',
    titulo: 'Clientes',
    descricao:
      'Consulte quem já reservou com você e converse pelo chat. O badge vermelho indica mensagens não lidas.',
  },
  {
    alvo: '[data-tour="nav-receitas"]',
    titulo: 'Receitas',
    descricao:
      'Acompanhe o faturamento por período, exporte relatórios e entenda de onde vem o seu resultado.',
  },
  {
    alvo: '[data-tour="nova-embarcacao"]',
    titulo: 'Passo 1: cadastre uma embarcação',
    descricao:
      'Comece por aqui. Sem uma embarcação cadastrada não é possível criar roteiros nem receber reservas.',
    acao: { label: 'Cadastrar embarcação', href: '/painel/embarcacoes/novo' },
  },
  {
    alvo: '[data-tour="nav-roteiros"]',
    titulo: 'Passo 2: crie um roteiro',
    descricao:
      'Com a embarcação pronta, publique um roteiro em Roteiros → Novo roteiro. É ele que aparece para os clientes no site.',
    acao: { label: 'Criar roteiro', href: '/painel/roteiros/novo' },
  },
  {
    alvo: '[data-tour="btn-tutorial"]',
    titulo: 'Rever o tutorial',
    descricao:
      'Clique neste ícone sempre que quiser assistir a este guia novamente. Boas vendas!',
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const TutorialContext = createContext<{ abrir: () => void }>({ abrir: () => {} });

export function useTutorial() {
  return useContext(TutorialContext);
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const pathname = usePathname();

  const abrir = useCallback(() => {
    setIndice(0);
    setAberto(true);
  }, []);

  const fechar = useCallback(() => {
    setAberto(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'concluido');
    } catch {
      /* modo privado / storage bloqueado */
    }
  }, []);

  // Abre automaticamente na primeira visita ao dashboard.
  useEffect(() => {
    if (pathname !== '/painel') return;
    let jaViu = true;
    try {
      jaViu = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      /* storage bloqueado: não insiste */
    }
    if (!jaViu) {
      const t = setTimeout(abrir, 600);
      return () => clearTimeout(t);
    }
  }, [pathname, abrir]);

  const valor = useMemo(() => ({ abrir }), [abrir]);

  return (
    <TutorialContext.Provider value={valor}>
      {children}
      {aberto && <TutorialOverlay indice={indice} setIndice={setIndice} onFechar={fechar} />}
    </TutorialContext.Provider>
  );
}

/** Botão do header que reabre o tutorial. */
export function TutorialButton() {
  const { abrir } = useTutorial();
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={abrir}
        data-tour="btn-tutorial"
        aria-label="Ver tutorial"
        className="p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]"
      >
        <GraduationCap className="w-5 h-5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-[#0B2447] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg"
      >
        Ver tutorial
      </span>
    </div>
  );
}

function TutorialOverlay({
  indice,
  setIndice,
  onFechar,
}: {
  indice: number;
  setIndice: (n: number) => void;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [medida, setMedida] = useState<{ alvo: string; rect: Rect } | null>(null);
  const passo = PASSOS[indice];
  const total = PASSOS.length;
  const ultimo = indice === total - 1;

  // Só vale a medida do passo atual — evita reusar o retângulo do passo anterior.
  const rect = passo.alvo && medida?.alvo === passo.alvo ? medida.rect : null;

  // Mede o alvo do passo atual e acompanha scroll/resize.
  useLayoutEffect(() => {
    const alvo = passo.alvo;
    if (!alvo) return;
    const el = document.querySelector(alvo);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const medir = () => {
      const r = el.getBoundingClientRect();
      setMedida({ alvo, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
    };
    const raf = requestAnimationFrame(medir);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [passo.alvo]);

  // Navegação por teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowRight') setIndice(Math.min(indice + 1, total - 1));
      if (e.key === 'ArrowLeft') setIndice(Math.max(indice - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [indice, total, setIndice, onFechar]);

  function avancar() {
    if (ultimo) onFechar();
    else setIndice(indice + 1);
  }

  function executarAcao(href: string) {
    onFechar();
    router.push(href);
  }

  const PAD = 8;
  const buraco = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const cardStyle = calcularPosicaoCard(buraco);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tutorial do painel">
      {buraco ? (
        <div
          className="absolute rounded-xl ring-2 ring-white/70 transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: buraco.top,
            left: buraco.left,
            width: buraco.width,
            height: buraco.height,
            boxShadow: '0 0 0 9999px rgba(11, 36, 71, 0.72)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#0B2447]/75" />
      )}

      {/* Captura cliques fora do card sem deixar o usuário interagir com a página. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        className="absolute w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 transition-all duration-300 ease-out"
        style={cardStyle}
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar tutorial"
          className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-[#0B2447] hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-[10px] font-bold tracking-wider uppercase text-[#0B3D91] mb-1.5">
          Passo {indice + 1} de {total}
        </p>
        <h3 className="text-base font-bold text-[#0B2447] pr-6">{passo.titulo}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{passo.descricao}</p>

        <div className="mt-4 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-[#0B3D91] rounded-full transition-all duration-300"
            style={{ width: `${((indice + 1) / total) * 100}%` }}
          />
        </div>

        {passo.acao && (
          <button
            type="button"
            onClick={() => executarAcao(passo.acao!.href)}
            className="mt-4 w-full bg-[#0B3D91] hover:bg-[#0B2447] text-white font-semibold text-xs py-2.5 rounded-xl transition-colors"
          >
            {passo.acao.label}
          </button>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Pular tutorial
          </button>

          <div className="flex items-center gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={() => setIndice(indice - 1)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-[#0B2447] hover:bg-slate-100 transition-colors"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={avancar}
              className="px-4 py-2 rounded-lg bg-[#0B2447] hover:bg-[#0B3D91] text-white text-xs font-semibold transition-colors"
            >
              {ultimo ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Coloca o card ao lado do buraco quando cabe; senão acima/abaixo; sem alvo, centraliza. */
function calcularPosicaoCard(buraco: Rect | null): React.CSSProperties {
  const CARD_W = 340;
  const CARD_H = 260;
  const GAP = 16;
  const M = 16;

  if (typeof window === 'undefined' || !buraco) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

  // Alvo estreito (menu lateral): posiciona à direita ou à esquerda.
  if (buraco.width < vw * 0.5) {
    const cabeDireita = buraco.left + buraco.width + GAP + CARD_W < vw - M;
    const left = cabeDireita
      ? buraco.left + buraco.width + GAP
      : Math.max(M, buraco.left - GAP - CARD_W);
    const top = clamp(buraco.top + buraco.height / 2 - CARD_H / 2, M, Math.max(M, vh - CARD_H - M));
    return { left, top };
  }

  // Alvo largo (conteúdo): posiciona abaixo ou acima.
  const cabeAbaixo = buraco.top + buraco.height + GAP + CARD_H < vh - M;
  const top = cabeAbaixo
    ? buraco.top + buraco.height + GAP
    : Math.max(M, buraco.top - GAP - CARD_H);
  const left = clamp(buraco.left + buraco.width / 2 - CARD_W / 2, M, Math.max(M, vw - CARD_W - M));
  return { left, top };
}
