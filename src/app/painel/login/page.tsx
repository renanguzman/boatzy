import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Anchor,
  ArrowDown,
  ArrowRight,
  BellRing,
  CalendarRange,
  Camera,
  ChartColumnIncreasing,
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  GraduationCap,
  Images,
  Lock,
  MessagesSquare,
  ShieldCheck,
  Star,
  Tag,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import Footer from '@/components/layout/Footer';
import MontagemAoRolar from '@/components/ui/MontagemAoRolar';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { destinoPainelSeguro } from '@/lib/painel-destino';
import AcessoGestorForm from './_components/AcessoGestorForm';
import BarraAcessoFlutuante from './_components/BarraAcessoFlutuante';
import IrParaAcesso from './_components/IrParaAcesso';
import SimuladorGanhos from './_components/SimuladorGanhos';
import { COOKIE_JA_ENTROU_PAINEL, ID_FORMULARIO_ACESSO, resolverAbaInicial } from './_lib/acesso';

export const metadata: Metadata = {
  title: 'Anuncie sua lancha no Boatzy — sua lancha rendendo nos dias parados',
  description:
    'Cadastre sua lancha grátis, defina preço e datas e receba reservas pagas antes do passeio. Sem mensalidade: a taxa de serviço é paga pelo cliente e você recebe 100% do seu preço.',
};

// Landing de captação do dono de lancha + porta de entrada do painel (PRD "Landing do proprietário").
// Toda promessa aqui precisa existir no produto — ver "Promessas verdadeiras" no PRD.

const eyebrowClass = 'text-xs font-semibold uppercase tracking-widest text-turquesa-escuro';
const tituloSecaoClass = 'text-3xl font-bold leading-tight tracking-tight text-marinho sm:text-4xl';
const gradienteBase = 'bg-gradient-to-r from-marinho to-turquesa bg-clip-text text-transparent';
// Nos títulos, o destaque não quebra no meio ("4 / passos").
const gradienteTexto = `${gradienteBase} whitespace-nowrap`;

// Animação de entrada (mesmo padrão da home: MontagemAoRolar + variantes group-data).
const SOBE =
  'opacity-0 translate-y-6 group-data-[montado=true]/montagem:opacity-100 group-data-[montado=true]/montagem:translate-y-0 transition-all duration-700 ease-out motion-reduce:transition-none';

const SELOS = ['Cadastro grátis', 'Sem mensalidade', '100% do seu preço é seu'];

const FATOS = [
  { valor: 'R$ 0', titulo: 'para anunciar', texto: 'Sem mensalidade, sem adesão, sem fidelidade.' },
  { valor: '100%', titulo: 'do seu preço', texto: 'A taxa de serviço é paga pelo cliente, somada ao valor.' },
  { valor: 'Pix ou cartão', titulo: 'pago antes do passeio', texto: 'O cliente paga pelo Boatzy. Você não cobra ninguém.' },
  { valor: '1 painel', titulo: 'para tudo', texto: 'Agenda, preços, pedidos, conversas e receitas.' },
];

const PASSOS = [
  {
    icon: UserPlus,
    titulo: 'Crie sua conta',
    texto: 'Grátis, com e-mail, Google, Facebook ou Apple. Leva menos de um minuto.',
  },
  {
    icon: ClipboardCheck,
    titulo: 'Conte sobre você',
    texto: 'Envie seus dados e os da lancha. A equipe Boatzy analisa e libera seu painel.',
  },
  {
    icon: Camera,
    titulo: 'Monte o anúncio',
    texto: 'Cadastre a lancha, as fotos e os roteiros, com preço por data. Um tutorial te guia no painel.',
  },
  {
    icon: Wallet,
    titulo: 'Aceite e receba',
    texto: 'O cliente paga pelo Boatzy antes de embarcar e o valor é repassado a você depois do passeio.',
  },
];

const SEMANA_EXEMPLO = [
  { dia: 'Seg', valor: '1.200' },
  { dia: 'Ter', valor: '1.200' },
  { dia: 'Qua', valor: '1.200' },
  { dia: 'Qui', valor: '1.400' },
  { dia: 'Sex', valor: '1.600' },
  { dia: 'Sáb', valor: '1.900', alta: true },
  { dia: 'Dom', valor: null },
];

const RECEITA_EXEMPLO = [
  { mes: 'Out', altura: 'h-[30%]' },
  { mes: 'Nov', altura: 'h-[45%]' },
  { mes: 'Dez', altura: 'h-[80%]' },
  { mes: 'Jan', altura: 'h-full' },
  { mes: 'Fev', altura: 'h-[90%]' },
  { mes: 'Mar', altura: 'h-[60%]' },
];

const BENEFICIOS_SIMPLES = [
  {
    icon: ShieldCheck,
    titulo: 'Pagamento garantido',
    texto: 'O cliente paga por Pix ou cartão pelo Boatzy antes de embarcar. Sem sinal por transferência e sem cliente que some.',
  },
  {
    icon: MessagesSquare,
    titulo: 'Conversa organizada',
    texto: 'Tire as dúvidas do cliente pelo chat do Boatzy, com o histórico de cada reserva num só lugar.',
  },
  {
    icon: Utensils,
    titulo: 'Opcionais que aumentam o ticket',
    texto: 'Ofereça extras como churrasco a bordo ou stand-up paddle, e o cliente adiciona na própria reserva.',
  },
];

const EXTRAS = [
  { icon: Users, texto: 'Equipe e tripulação' },
  { icon: Tag, texto: 'Anúncio de venda da lancha' },
  { icon: GraduationCap, texto: 'Tutorial guiado no painel' },
  { icon: Star, texto: 'Avaliações de clientes' },
];

const COMPARATIVO = [
  {
    antes: 'Negociar preço por mensagem, um cliente de cada vez',
    depois: 'Preço publicado: o cliente já chega sabendo quanto custa',
  },
  {
    antes: 'Cobrar sinal por Pix e torcer para o cliente aparecer',
    depois: 'O cliente paga antes, pelo Boatzy, e a data fica garantida',
  },
  {
    antes: 'Agenda no caderno e a mesma data prometida duas vezes',
    depois: 'Calendário único: a reserva aceita segura a data na hora',
  },
  {
    antes: 'Depender de indicação e de post em rede social',
    depois: 'Sua lancha na busca de quem já quer sair para o mar',
  },
];

const PERGUNTAS = [
  {
    pergunta: 'Quanto custa anunciar?',
    resposta:
      'Nada. Não há mensalidade nem taxa de adesão. O Boatzy cobra uma taxa de serviço do cliente, somada ao seu preço na hora da reserva. Você recebe o valor que definiu.',
  },
  {
    pergunta: 'Quando eu recebo?',
    resposta:
      'Depois que você aceita o pedido, o cliente paga pelo Boatzy (Pix ou cartão), antes do passeio. O valor fica protegido e é repassado a você depois que o passeio acontece.',
  },
  {
    pergunta: 'Sou obrigado a aceitar todas as reservas?',
    resposta:
      'Não. Cada pedido chega para você aceitar ou recusar. Se recusar, o cliente recebe um aviso gentil e nada é cobrado dele.',
  },
  {
    pergunta: 'Que tipo de embarcação posso anunciar?',
    resposta:
      'Neste começo, lanchas. Todo passeio sai com capitão: você ou alguém da sua tripulação, que você pode cadastrar no painel.',
  },
  {
    pergunta: 'Por que meu cadastro passa por análise?',
    resposta:
      'A equipe Boatzy confere cada novo dono e cada anúncio antes de ir ao ar. É isso que dá segurança para o cliente reservar, e mais reservas para você.',
  },
  {
    pergunta: 'Preciso ter empresa (CNPJ)?',
    resposta: 'Não. Você pode se cadastrar com CPF ou com CNPJ.',
  },
  {
    pergunta: 'Onde o Boatzy funciona?',
    resposta:
      'Começamos por Florianópolis e região, e a expansão pelo litoral já está no plano. Se a sua lancha está em outra cidade, cadastre-se: você informa a cidade no pedido de acesso.',
  },
  {
    pergunta: 'Também posso vender minha lancha pelo Boatzy?',
    resposta:
      'Pode. O painel tem uma área de anúncios de venda, com página própria para a lancha e conversa com os interessados.',
  },
];

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function PainelLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const aba = typeof params.aba === 'string' ? params.aba : undefined;
  const redirectTo = typeof params.redirect_to === 'string' ? params.redirect_to : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Gestor (ou admin) já logado não precisa da landing: segue para o painel.
  let usuario: { nome: string; email: string } | null = null;
  if (user) {
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id);
    if ((roles ?? []).some((r) => r.role === 'gestor' || r.role === 'admin')) {
      redirect(destinoPainelSeguro(redirectTo) ?? '/painel');
    }
    usuario = {
      nome: ((user.user_metadata?.full_name ?? user.user_metadata?.name ?? '') as string).trim(),
      email: user.email ?? '',
    };
  }

  const cookieStore = await cookies();
  const abaInicial = resolverAbaInicial(aba, redirectTo, cookieStore.has(COOKIE_JA_ENTROU_PAINEL));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        {/* ── Hero + formulário ─────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-marinho">
          <Image
            src="/images/passeios/caixa-d-aco.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-marinho/95 via-marinho/90 to-marinho lg:bg-gradient-to-r lg:from-marinho lg:via-marinho/85 lg:to-marinho/45" />
          <div aria-hidden className="absolute -left-40 top-1/4 -z-10 h-[28rem] w-[28rem] rounded-full bg-turquesa/20 blur-3xl" />

          {/* Barra superior */}
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link href="/" aria-label="Boatzy — ir para o site">
              <Image
                src="/images/logo-nome-horizontal.svg"
                alt="Boatzy"
                width={299}
                height={100}
                className="h-9 w-auto sm:h-10"
                priority
              />
            </Link>
            <div className="flex items-center gap-2 sm:gap-5">
              <Link href="/" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">
                Voltar ao site
              </Link>
              {!usuario && (
                <IrParaAcesso
                  aba="entrar"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/10"
                >
                  Já tenho conta
                </IrParaAcesso>
              )}
            </div>
          </div>

          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16 lg:px-8 lg:pb-28 lg:pt-12">
            <div className="animate-fade-in">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-turquesa ring-1 ring-white/15 backdrop-blur-sm">
                <Anchor className="h-3.5 w-3.5" />
                Para donos de lancha
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl xl:text-6xl">
                Lancha parada é dinheiro <span className="text-destaque">ancorado</span>.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
                Anuncie no Boatzy e transforme os dias em que ela fica na marina em passeios pagos. Você define o
                preço, as datas e quem sobe a bordo. A gente traz o cliente, recebe antes do passeio e repassa
                para você.
              </p>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                {SELOS.map((selo) => (
                  <li key={selo} className="flex items-center gap-2 text-sm font-medium text-white">
                    <CircleCheck className="h-5 w-5 text-turquesa" />
                    {selo}
                  </li>
                ))}
              </ul>
              <a
                href="#simulador"
                className="group mt-10 hidden items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white lg:inline-flex"
              >
                Veja quanto a sua lancha pode render
                <ArrowDown className="h-4 w-4 text-turquesa transition-transform group-hover:translate-y-0.5" />
              </a>
            </div>

            <div
              id={ID_FORMULARIO_ACESSO}
              className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-2xl shadow-black/30 ring-1 ring-white/10 sm:p-8"
            >
              <AcessoGestorForm abaInicial={abaInicial} usuario={usuario} />
            </div>
          </div>
        </section>

        {/* ── Fatos (sobrepõe a base do hero) ────────────────────────────── */}
        <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-slate-100 shadow-[0_24px_60px_-24px_rgba(14,47,79,0.3)] ring-1 ring-slate-100 lg:grid-cols-4">
            {FATOS.map((f) => (
              <li key={f.valor} className="bg-white p-5 sm:p-7">
                <p className={`text-2xl font-bold tracking-tight sm:text-3xl ${gradienteBase}`}>{f.valor}</p>
                <p className="mt-1 text-sm font-semibold text-marinho">{f.titulo}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">{f.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Simulador ─────────────────────────────────────────────────── */}
        <section id="simulador" className="scroll-mt-4 bg-white py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div>
              <p className={eyebrowClass}>Simulador de ganhos</p>
              <h2 className={`mt-2 ${tituloSecaoClass}`}>
                Quanto a sua lancha pode <span className={gradienteTexto}>render</span>?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Você escolhe o preço de cada saída. O Boatzy soma a taxa de serviço ao valor que o cliente vê, e
                você recebe exatamente o que definiu.
              </p>
              <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-3xl lg:block">
                <Image
                  src="/images/yacht-card-2.png"
                  alt="Lancha navegando em mar azul"
                  fill
                  sizes="(min-width: 1024px) 34rem, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-marinho/80 to-transparent p-6">
                  <p className="text-lg font-semibold text-white">Seu preço. Sua agenda. Sua lancha rendendo.</p>
                </div>
              </div>
            </div>
            <SimuladorGanhos />
          </div>
        </section>

        {/* ── Como funciona ─────────────────────────────────────────────── */}
        <section className="bg-areia py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className={eyebrowClass}>Como funciona</p>
              <h2 className={`mt-2 ${tituloSecaoClass}`}>
                Do cadastro ao primeiro passeio em <span className={gradienteTexto}>4 passos</span>
              </h2>
            </div>

            <MontagemAoRolar className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PASSOS.map(({ icon: Icone, titulo, texto }, i) => (
                <div
                  key={titulo}
                  className={`relative rounded-3xl bg-white p-6 ring-1 ring-slate-100 ${SOBE}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <span aria-hidden className={`absolute right-5 top-4 text-5xl font-bold opacity-15 ${gradienteTexto}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-turquesa/25 to-turquesa/10">
                    <Icone className="h-6 w-6 text-marinho" strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-marinho">
                    <span className="sr-only">Passo {i + 1}: </span>
                    {titulo}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{texto}</p>
                </div>
              ))}
            </MontagemAoRolar>
          </div>
        </section>

        {/* ── Benefícios (bento) ────────────────────────────────────────── */}
        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className={eyebrowClass}>Tudo num só painel</p>
              <h2 className={`mt-2 ${tituloSecaoClass}`}>
                Menos mensagem. <span className={gradienteTexto}>Mais mar.</span>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                O painel do Boatzy organiza o que hoje está espalhado entre WhatsApp, caderno e planilha.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {/* Preço por data */}
              <div className="relative overflow-hidden rounded-3xl bg-marinho p-6 text-white sm:p-8 lg:col-span-2">
                <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-turquesa/25 blur-3xl" />
                <CalendarRange className="relative h-7 w-7 text-turquesa" strokeWidth={1.8} />
                <h3 className="relative mt-4 text-xl font-bold">Preço do seu jeito, dia a dia</h3>
                <p className="relative mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
                  Defina um preço padrão, cobre mais no fim de semana, no feriado ou na alta temporada e feche as
                  datas em que a lancha é só sua.
                </p>
                <div aria-hidden className="relative mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">
                  {SEMANA_EXEMPLO.map((d) => (
                    <div
                      key={d.dia}
                      className={`rounded-xl px-1 py-2.5 text-center ring-1 sm:py-3 ${
                        d.alta ? 'bg-turquesa/20 ring-turquesa' : 'bg-white/5 ring-white/10'
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 sm:text-xs">{d.dia}</p>
                      {d.valor ? (
                        <p className={`mt-1 text-[11px] font-bold tabular-nums sm:text-sm ${d.alta ? 'text-turquesa' : 'text-white'}`}>
                          {d.valor}
                        </p>
                      ) : (
                        <Lock className="mx-auto mt-1 h-3.5 w-3.5 text-slate-400 sm:h-4 sm:w-4" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pedido na hora */}
              <div className="flex flex-col rounded-3xl bg-areia p-6 ring-1 ring-slate-100 sm:p-8">
                <BellRing className="h-7 w-7 text-marinho" strokeWidth={1.8} />
                <h3 className="mt-4 text-xl font-bold text-marinho">Pedido novo? Você fica sabendo na hora</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Aviso no painel e por e-mail. Você aceita ou recusa, e o cliente recebe a resposta.
                </p>
                <div aria-hidden className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:mt-auto">
                  <p className="text-xs font-semibold uppercase tracking-wider text-turquesa-escuro">Nova solicitação</p>
                  <p className="mt-1 text-sm font-semibold text-marinho">Ilha do Campeche</p>
                  <p className="text-xs text-slate-500">Sábado · 8 pessoas</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-marinho px-3 py-1 text-xs font-semibold text-white">Aceitar</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Recusar</span>
                  </div>
                </div>
              </div>

              {BENEFICIOS_SIMPLES.map(({ icon: Icone, titulo, texto }) => (
                <div key={titulo} className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 sm:p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-turquesa/25 to-turquesa/10">
                    <Icone className="h-6 w-6 text-marinho" strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-marinho">{titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{texto}</p>
                </div>
              ))}

              {/* Vitrine */}
              <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-turquesa/25 to-turquesa/10">
                  <Images className="h-6 w-6 text-marinho" strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-marinho">Vitrine que vende</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Fotos, roteiro com paradas no mapa, comodidades e equipamentos de segurança: o cliente vê tudo
                  antes de reservar.
                </p>
              </div>

              {/* Receitas */}
              <div className="grid gap-6 rounded-3xl bg-gradient-to-br from-turquesa/10 to-marinho/[0.06] p-6 sm:grid-cols-2 sm:items-end sm:p-8 lg:col-span-2">
                <div>
                  <ChartColumnIncreasing className="h-7 w-7 text-marinho" strokeWidth={1.8} />
                  <h3 className="mt-4 text-xl font-bold text-marinho">Seus números, sem planilha</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Receita por período, por lancha e por roteiro, ticket médio e a lista dos seus clientes.
                  </p>
                </div>
                <div aria-hidden className="flex h-36 items-end gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  {RECEITA_EXEMPLO.map((m) => (
                    <div key={m.mes} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                      <div className={`${m.altura} w-full rounded-md bg-gradient-to-t from-marinho to-turquesa`} />
                      <p className="text-center text-[10px] font-medium text-slate-400">{m.mes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-marinho">E ainda:</span>
              {EXTRAS.map(({ icon: Icone, texto }) => (
                <span
                  key={texto}
                  className="inline-flex items-center gap-1.5 rounded-full bg-areia px-3 py-1.5 text-xs font-medium text-grafite ring-1 ring-slate-200/70"
                >
                  <Icone className="h-3.5 w-3.5 text-turquesa-escuro" />
                  {texto}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Antes × com o Boatzy ──────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-marinho py-20 sm:py-24">
          <Image
            src="/images/yacht-card-1.png"
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover opacity-25"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-marinho via-marinho/90 to-marinho" />
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-turquesa">Por que o Boatzy</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Chega de alugar a lancha <span className="text-turquesa">no improviso</span>.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-6">
              <div className="rounded-3xl border border-white/10 p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Do jeito antigo</p>
                <ul className="mt-5 space-y-4">
                  {COMPARATIVO.map((c) => (
                    <li key={c.antes} className="flex gap-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                      <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                      {c.antes}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-white/[0.07] p-6 ring-1 ring-turquesa/40 backdrop-blur-sm sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-turquesa">Com o Boatzy</p>
                <ul className="mt-5 space-y-4">
                  {COMPARATIVO.map((c) => (
                    <li key={c.depois} className="flex gap-3 text-sm font-medium leading-relaxed text-white sm:text-base">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-turquesa">
                        <Check className="h-3.5 w-3.5 text-marinho" strokeWidth={3} />
                      </span>
                      {c.depois}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Perguntas frequentes ─────────────────────────────────────── */}
        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-8">
            <div>
              <p className={eyebrowClass}>Perguntas frequentes</p>
              <h2 className={`mt-2 ${tituloSecaoClass}`}>Ficou alguma dúvida?</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Se a sua pergunta não está aqui,{' '}
                <Link href="/contact" className="font-semibold text-marinho underline hover:no-underline">
                  fale com a gente
                </Link>
                .
              </p>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {PERGUNTAS.map((p) => (
                <details key={p.pergunta} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-marinho [&::-webkit-details-marker]:hidden">
                    {p.pergunta}
                    <ChevronDown className="h-5 w-5 shrink-0 text-turquesa-escuro transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 pr-8 text-sm leading-relaxed text-slate-600">{p.resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Chamada final ─────────────────────────────────────────────── */}
        <section className="bg-white pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div id="chamada-final" className="relative isolate overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-20">
              <Image
                src="/images/passeios/praia-do-tingua.png"
                alt=""
                fill
                sizes="(min-width: 1152px) 72rem, 100vw"
                className="-z-20 object-cover"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-marinho/95 via-marinho/85 to-marinho/60" />
              <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                O próximo passeio de alguém pode ser na sua lancha.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-200">
                Crie sua conta grátis, conte sobre a sua lancha e comece a receber pedidos.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {usuario ? (
                  <a
                    href="/painel"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-turquesa px-7 py-3.5 text-sm font-semibold text-marinho transition-all hover:brightness-110"
                  >
                    Continuar para o painel
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <>
                    <IrParaAcesso
                      aba="cadastro"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-turquesa px-7 py-3.5 text-sm font-semibold text-marinho transition-all hover:brightness-110 sm:w-auto"
                    >
                      Criar minha conta grátis
                      <ArrowRight className="h-4 w-4" />
                    </IrParaAcesso>
                    <IrParaAcesso
                      aba="entrar"
                      className="inline-flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10 sm:w-auto"
                    >
                      Já tenho conta
                    </IrParaAcesso>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <BarraAcessoFlutuante
        aba="cadastro"
        rotulo={usuario ? 'Continuar para o painel' : 'Anunciar minha lancha grátis'}
      />
    </div>
  );
}
