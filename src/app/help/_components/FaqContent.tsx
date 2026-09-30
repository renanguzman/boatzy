'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, MessageCircle, X } from 'lucide-react';

type FaqItem = {
  pergunta: string;
  resposta: React.ReactNode;
  categoria: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    categoria: 'Reservas',
    pergunta: 'Como faço para reservar uma embarcação ou roteiro?',
    resposta: (
      <>
        Busque por local, data e número de pessoas na página inicial ou em{' '}
        <Link href="/buscar" className="text-[#0B3D91] underline hover:no-underline">
          Roteiros
        </Link>
        . Ao encontrar o roteiro ou a embarcação ideal, abra os detalhes, escolha a data, a
        quantidade de pessoas e os adicionais desejados e clique em &quot;Solicitar Reserva&quot;.
        É necessário estar logado — se ainda não estiver, você será direcionado para entrar antes
        de concluir.
      </>
    ),
  },
  {
    categoria: 'Reservas',
    pergunta: 'Minha reserva é confirmada na hora?',
    resposta: (
      <>
        Não. Ao solicitar, a reserva entra como <strong>Pendente</strong> e é enviada ao
        proprietário (gestor) da embarcação, que pode <strong>Aceitar</strong> ou{' '}
        <strong>Recusar</strong> o pedido. Ao aceitar, você recebe um e-mail para pagar pelo Boatzy
        (Pix ou cartão) dentro do prazo informado — a data fica reservada para você enquanto isso, e
        a reserva é <strong>Confirmada</strong> assim que o pagamento é aprovado. Você acompanha o
        status e a resposta em{' '}
        <Link href="/minhas-reservas" className="text-[#0B3D91] underline hover:no-underline">
          Minhas Reservas
        </Link>
        .
      </>
    ),
  },
  {
    categoria: 'Reservas',
    pergunta: 'Posso cancelar uma reserva depois de solicitá-la?',
    resposta: (
      <>
        Sim. Em{' '}
        <Link href="/minhas-reservas" className="text-[#0B3D91] underline hover:no-underline">
          Minhas Reservas
        </Link>{' '}
        você encontra o botão &quot;Cancelar reserva&quot;, disponível enquanto ela estiver{' '}
        <strong>Pendente</strong> ou <strong>Aguardando pagamento</strong> (nenhum valor é cobrado). Para
        cancelar uma reserva já paga, fale com o proprietário pelo chat — a política de prazos e
        reembolso será divulgada nos Termos de Uso.
      </>
    ),
  },
  {
    categoria: 'Reservas',
    pergunta: 'O que significam os status das reservas?',
    resposta: (
      <>
        <strong>Pendente</strong>: aguardando resposta do proprietário. <strong>Aguardando
        pagamento</strong>: o proprietário aceitou e você tem um prazo para pagar pelo Boatzy.{' '}
        <strong>Confirmada</strong>: pagamento aprovado, a data é sua. <strong>Pagamento
        expirado</strong>: o prazo terminou sem pagamento e a data foi liberada.{' '}
        <strong>Recusada</strong>: o proprietário não pôde atender. <strong>Cancelada</strong>: você
        desistiu da reserva. <strong>Concluída</strong>: a data do passeio já passou e a reserva
        estava confirmada — é a partir dela que você pode avaliar a experiência.
      </>
    ),
  },
  {
    categoria: 'Reservas',
    pergunta: 'Posso usar cupom de desconto na reserva?',
    resposta: (
      <>
        Sim. Na página de confirmação da reserva há um campo para informar o código do cupom; ao
        aplicar, o desconto é validado na hora e refletido no total estimado antes de você enviar
        a solicitação. O desconto do cupom é aplicado sobre a taxa de serviço (até o valor dela).
      </>
    ),
  },
  {
    categoria: 'Pagamentos',
    pergunta: 'Como funciona o pagamento das reservas?',
    resposta: (
      <>
        A solicitação é gratuita. Quando o proprietário aceita, você paga pelo próprio Boatzy, com{' '}
        <strong>Pix</strong> (QR Code ou copia e cola) ou <strong>cartão de crédito</strong>, dentro
        do prazo informado. O pagamento é processado pelo Asaas, nosso parceiro de pagamentos: no
        cartão, você digita os dados no ambiente seguro do Asaas e o Boatzy não recebe nem guarda o
        número do cartão. O valor fica com o Boatzy e é repassado ao proprietário depois do passeio.
        O total inclui a taxa de serviço da plataforma, exibida antes de você solicitar.
      </>
    ),
  },
  {
    categoria: 'Conta',
    pergunta: 'Preciso criar uma conta para reservar um passeio?',
    resposta: (
      <>
        Sim, é necessário estar logado para solicitar uma reserva, favoritar itens ou conversar
        com o proprietário. Você pode criar uma conta em{' '}
        <Link href="/entrar" className="text-[#0B3D91] underline hover:no-underline">
          Entrar
        </Link>{' '}
        com e-mail e senha ou usando Google, Facebook ou Apple.
      </>
    ),
  },
  {
    categoria: 'Conta',
    pergunta: 'Como edito meus dados pessoais, CPF, celular ou endereço?',
    resposta: (
      <>
        Acesse{' '}
        <Link href="/minha-conta" className="text-[#0B3D91] underline hover:no-underline">
          Minha Conta
        </Link>{' '}
        pelo menu do seu avatar. Lá você edita nome, CPF, celular, data de nascimento, endereço
        (com preenchimento automático pelo CEP) e as preferências de notificação por e-mail. A
        troca de senha também fica nessa página, disponível apenas para contas criadas por
        e-mail — contas de login social têm a senha gerenciada pelo próprio provedor.
      </>
    ),
  },
  {
    categoria: 'Conta',
    pergunta: 'Esqueci minha senha. Como faço para recuperar o acesso?',
    resposta: (
      <>
        Na tela de login, use a opção &quot;Esqueci minha senha&quot;. Você receberá um e-mail com
        um link para definir uma nova senha. Isso vale tanto para contas de cliente quanto de
        proprietário (o link de recuperação do painel é específico para contas de gestor).
      </>
    ),
  },
  {
    categoria: 'Embarcações e proprietários',
    pergunta: 'Sou dono de uma embarcação. Como anuncio no Boatzy?',
    resposta: (
      <>
        Clique em &quot;Anuncie sua embarcação&quot; no topo do site, ou acesse diretamente o{' '}
        <Link href="/painel" className="text-[#0B3D91] underline hover:no-underline">
          Painel do Proprietário
        </Link>
        . Crie sua conta de gestor, cadastre sua embarcação com fotos, comodidades e preços e
        depois crie os roteiros que ela realiza. As solicitações de reserva aparecem em &quot;
        Agendamentos&quot;, onde você confirma ou recusa cada pedido.
      </>
    ),
  },
  {
    categoria: 'Embarcações e proprietários',
    pergunta: 'Qual a diferença entre reservar um roteiro e reservar uma embarcação?',
    resposta: (
      <>
        Um <strong>roteiro</strong> é um passeio específico (data, duração, adicionais) oferecido
        por uma embarcação. Já reservar a <strong>embarcação</strong> diretamente permite combinar
        um uso sob medida com o proprietário, sem adicionais pré-definidos. Em ambos os casos, o
        fluxo de solicitação, aceite e pagamento é o mesmo.
      </>
    ),
  },
  {
    categoria: 'Embarcações e proprietários',
    pergunta: 'É possível conversar com o proprietário antes de reservar?',
    resposta: (
      <>
        Sim. Nas páginas de roteiro e de embarcação existe o botão &quot;Converse com o dono&quot;,
        que abre um chat direto dentro da plataforma. Você acompanha todas as conversas em{' '}
        <Link href="/minhas-conversas" className="text-[#0B3D91] underline hover:no-underline">
          Minhas Conversas
        </Link>
        .
      </>
    ),
  },
  {
    categoria: 'Busca e favoritos',
    pergunta: 'Como funcionam os filtros de busca (preço, duração, comodidades)?',
    resposta: (
      <>
        Em{' '}
        <Link href="/buscar" className="text-[#0B3D91] underline hover:no-underline">
          Roteiros e Embarcações
        </Link>
        , use o botão &quot;Filtros&quot; para definir faixa de preço e duração do passeio, e
        &quot;Comodidades&quot; (na aba Embarcações) para exigir itens específicos, como cozinha a
        bordo ou som. Você também pode ordenar os resultados por relevância, avaliação, preço ou
        duração. Todos os filtros ficam salvos no link, então dá para compartilhar sua busca.
      </>
    ),
  },
  {
    categoria: 'Busca e favoritos',
    pergunta: 'Como favorito um roteiro ou uma embarcação?',
    resposta: (
      <>
        Clique no ícone de coração no card ou na página de detalhes — é necessário estar logado.
        Todos os itens favoritados ficam reunidos em{' '}
        <Link href="/favoritos" className="text-[#0B3D91] underline hover:no-underline">
          Favoritos
        </Link>
        , acessível pelo menu do seu avatar.
      </>
    ),
  },
  {
    categoria: 'Avaliações',
    pergunta: 'Como avalio uma experiência depois do passeio?',
    resposta: (
      <>
        Assim que a data do passeio passa, a reserva vira <strong>Concluída</strong> em{' '}
        <Link href="/minhas-reservas" className="text-[#0B3D91] underline hover:no-underline">
          Minhas Reservas
        </Link>{' '}
        e o botão &quot;Avaliar experiência&quot; aparece no card: dê uma nota de 1 a 5 estrelas e,
        se quiser, deixe um comentário. Cada reserva pode ser avaliada uma única vez.
      </>
    ),
  },
  {
    categoria: 'Avaliações',
    pergunta: 'Por que minha avaliação ainda não aparece na página do passeio?',
    resposta: (
      <>
        Toda avaliação passa por uma moderação simples antes de ficar pública, com o selo
        &quot;Aguardando aprovação&quot; visível para você em Minhas Reservas enquanto isso. Assim
        que aprovada, ela passa a contar na média e na lista de comentários.
      </>
    ),
  },
  {
    categoria: 'Segurança e confiança',
    pergunta: 'O Boatzy é responsável pela embarcação ou pelo passeio contratado?',
    resposta: (
      <>
        O Boatzy atua como <strong>intermediário tecnológico</strong>, conectando proprietários e
        locatários — não somos donos, operadores nem seguradores das embarcações anunciadas. A
        relação de aluguel (condições, uso, devolução) é estabelecida diretamente entre você e o
        proprietário. Mais detalhes estão nos{' '}
        <Link href="/terms" className="text-[#0B3D91] underline hover:no-underline">
          Termos de Uso
        </Link>
        .
      </>
    ),
  },
  {
    categoria: 'Segurança e confiança',
    pergunta: 'Como meus dados pessoais são protegidos?',
    resposta: (
      <>
        Seus dados são tratados conforme a nossa{' '}
        <Link href="/privacy" className="text-[#0B3D91] underline hover:no-underline">
          Política de Privacidade
        </Link>
        , que explica quais informações coletamos, para que usamos e como você pode solicitar
        acesso, correção ou exclusão dos seus dados.
      </>
    ),
  },
  {
    categoria: 'Vendas de embarcações',
    pergunta: 'O Boatzy também vende embarcações, além de alugar?',
    resposta: (
      <>
        Sim. Em{' '}
        <Link href="/vendas" className="text-[#0B3D91] underline hover:no-underline">
          Vendas
        </Link>{' '}
        você encontra anúncios de embarcações à venda, com fotos, especificações e contato direto
        com o vendedor pelo chat da plataforma.
      </>
    ),
  },
];

const CATEGORIAS = Array.from(new Set(FAQ_ITEMS.map((item) => item.categoria)));

export default function FaqContent() {
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<number>>(new Set());

  const termo = busca.trim().toLowerCase();

  const resultados = useMemo(() => {
    if (!termo) return FAQ_ITEMS.map((item, index) => ({ item, index }));
    return FAQ_ITEMS.map((item, index) => ({ item, index })).filter(({ item }) => {
      const textoResposta =
        typeof item.resposta === 'string'
          ? item.resposta
          : extrairTexto(item.resposta);
      return (
        item.pergunta.toLowerCase().includes(termo) ||
        item.categoria.toLowerCase().includes(termo) ||
        textoResposta.toLowerCase().includes(termo)
      );
    });
  }, [termo]);

  const porCategoria = CATEGORIAS.map((categoria) => ({
    categoria,
    itens: resultados.filter(({ item }) => item.categoria === categoria),
  })).filter((grupo) => grupo.itens.length > 0);

  function toggle(index: number) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div>
      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Busque por uma palavra-chave: reserva, pagamento, cancelamento…"
          aria-label="Buscar nas perguntas frequentes"
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#0B3D91] focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 transition-all"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {termo && (
        <p className="mt-3 text-sm text-slate-500">
          {resultados.length === 0
            ? 'Nenhuma pergunta encontrada.'
            : `${resultados.length} pergunta${resultados.length > 1 ? 's' : ''} encontrada${resultados.length > 1 ? 's' : ''}.`}
        </p>
      )}

      {/* Lista por categoria */}
      <div className="mt-8 space-y-10">
        {porCategoria.map(({ categoria, itens }) => (
          <div key={categoria}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#0B3D91] mb-3">
              {categoria}
            </h2>
            <div className="space-y-3">
              {itens.map(({ item, index }) => {
                const aberto = abertos.has(index);
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      aria-expanded={aberto}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-sm sm:text-base font-medium text-[#0B2447]">
                        {item.pergunta}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                          aberto ? 'rotate-180 text-[#0B3D91]' : ''
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-in-out ${
                        aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                          {item.resposta}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {termo && resultados.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <p className="text-slate-600">
              Não encontramos nada para &quot;{busca}&quot;. Tente outra palavra-chave ou fale
              direto com a gente.
            </p>
          </div>
        )}
      </div>

      {/* CTA de contato */}
      <div className="mt-12 rounded-2xl bg-[#0B2447] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Não encontrou sua resposta?</p>
            <p className="text-sm text-slate-300">Fale com a nossa equipe, respondemos em até 2 dias úteis.</p>
          </div>
        </div>
        <Link
          href="/contact"
          className="shrink-0 bg-white text-[#0B2447] font-semibold text-sm px-5 py-3 rounded-xl hover:bg-slate-100 transition-colors"
        >
          Fale conosco
        </Link>
      </div>
    </div>
  );
}

function extrairTexto(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extrairTexto).join(' ');
  if (typeof node === 'object' && 'props' in node) {
    return extrairTexto((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}
