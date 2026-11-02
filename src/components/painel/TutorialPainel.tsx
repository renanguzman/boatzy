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
import { useMenuMobile } from './MenuMobile';

/** v2 (01/11/2026): menu reorganizado e novos itens — quem viu a versão anterior vê esta uma vez. */
const STORAGE_KEY = 'boatzy:tutorial-painel:v2';

type Passo = {
  /** Seletor do elemento destacado. `null` exibe o passo centralizado, sem spotlight. */
  alvo: string | null;
  titulo: string;
  descricao: string;
  /** Ação opcional exibida como botão extra (ex.: navegar para o cadastro). */
  acao?: { label: string; href: string };
};

/** Um passo por área, na ordem do menu (SPEC §97). Frases curtas, sem termos técnicos. */
const PASSOS: Passo[] = [
  {
    alvo: null,
    titulo: 'Bem-vindo ao seu painel',
    descricao:
      'Aqui você cadastra seu barco, cria os passeios e responde às reservas. Em menos de 1 minuto mostramos onde fica cada coisa.',
  },
  {
    alvo: '[data-tour="nav-dashboard"]',
    titulo: 'Início',
    descricao: 'Sua tela principal. Mostra o próximo passo e o que precisa da sua resposta.',
  },
  {
    alvo: '[data-tour="nav-agendamentos"]',
    titulo: 'Reservas',
    descricao:
      'Os pedidos dos clientes chegam aqui. Você aceita ou recusa e vê a agenda dos passeios. O número vermelho mostra quantos esperam resposta.',
  },
  {
    alvo: '[data-tour="nav-clientes"]',
    titulo: 'Clientes',
    descricao: 'Quem já reservou com você. Converse pelo chat — o número vermelho mostra mensagens novas.',
  },
  {
    alvo: '[data-tour="nav-embarcacoes"]',
    titulo: 'Embarcações',
    descricao: 'Cadastre seu barco com fotos, local e o documento (TIE). A equipe Boatzy aprova antes de ele ir para o site.',
  },
  {
    alvo: '[data-tour="nav-documentos"]',
    titulo: 'Documentos',
    descricao: 'Guarda o TIE, o seguro e a habilitação de quem conduz. Avisamos antes de vencer.',
  },
  {
    alvo: '[data-tour="nav-roteiros"]',
    titulo: 'Roteiros e preços',
    descricao: 'O passeio que o cliente reserva: trajeto, duração e preço. Também passa pela aprovação da equipe Boatzy.',
  },
  {
    alvo: '[data-tour="nav-perfil"]',
    titulo: 'Meu perfil',
    descricao: 'Sua foto e uma apresentação. Aparecem no fim dos seus passeios, depois de aprovadas pela equipe Boatzy — a IA ajuda a escrever.',
  },
  {
    alvo: '[data-tour="nav-grupo-ferramentas"]',
    titulo: 'Mais ferramentas',
    descricao:
      'Para quando precisar: extras para vender junto (bebidas, petiscos), sua equipe, quanto você recebeu e anúncios de barcos à venda.',
  },
  {
    alvo: '[data-tour="btn-tutorial"]',
    titulo: 'Pronto!',
    descricao: 'Para começar, siga os Primeiros passos na tela de Início. Quer ver este guia de novo? É só clicar aqui.',
    acao: { label: 'Ver os primeiros passos', href: '/painel' },
  },
];

/** Passos cujo alvo fica no menu lateral (drawer no mobile). */
const ALVOS_DO_MENU = /data-tour="(nav-|nova-embarcacao)/;

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
        className="p-2.5 sm:p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]"
      >
        <GraduationCap className="w-5 h-5" />
      </button>
      <span
        role="tooltip"
        className="hidden sm:block pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-[#0B2447] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg"
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

  // No mobile o menu lateral é um drawer: abre nos passos que apontam para ele
  // e fecha nos demais (e ao sair do tutorial).
  const { abrir: abrirMenu, fechar: fecharMenu } = useMenuMobile();
  const alvoNoMenu = !!passo.alvo && ALVOS_DO_MENU.test(passo.alvo);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    if (alvoNoMenu) abrirMenu();
    else fecharMenu();
  }, [alvoNoMenu, abrirMenu, fecharMenu]);
  useEffect(() => fecharMenu, [fecharMenu]);

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
    // Remede ao fim da animação do drawer (300ms) e da rolagem suave.
    const t = setTimeout(medir, 350);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
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
          {indice + 1} de {total}
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
