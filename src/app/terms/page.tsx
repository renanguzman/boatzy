import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Termos de Uso — Boatzy',
  description:
    'Conheça os Termos de Uso que regem o acesso e o uso da plataforma Boatzy de intermediação de aluguel de embarcações.',
};

export default function TermsPage() {
  return (
    <>
      <Header />

      <main className="flex-1 bg-slate-50">
        {/* Hero */}
        <section className="bg-[#0B2447] text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Termos de Uso
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              Última atualização: 21/06/2026
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Aviso de status */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              <strong>Status:</strong> Minuta provisória (v1) — versão
              preliminar destinada a atender aos requisitos de login social
              (Facebook/Meta) na fase de desenvolvimento da plataforma.{' '}
              <strong>Não é a versão final.</strong> Recomenda-se revisão por
              advogado antes do lançamento oficial e, especialmente, antes da
              plataforma passar a processar pagamentos ou reservas reais.
            </p>
          </div>

          <article className="mt-10 space-y-10 text-slate-700 leading-relaxed">
            {/* 1 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                1. Aceitação destes Termos
              </h2>
              <p className="mt-3">
                Bem-vindo ao <strong>Boatzy</strong>. Estes Termos de Uso regem
                o acesso e o uso da plataforma Boatzy (&quot;plataforma&quot;,
                &quot;serviço&quot;, &quot;nós&quot;), disponível em boatzy.app.
                Ao criar uma conta ou usar a plataforma, você declara que leu,
                entendeu e concorda com estes Termos e com a nossa{' '}
                <Link
                  href="/privacy"
                  className="text-[#0B2447] underline hover:no-underline"
                >
                  Política de Privacidade
                </Link>
                . Se não concordar, não use a plataforma.
              </p>
              <p className="mt-3">
                O Boatzy é, atualmente, um{' '}
                <strong>projeto em desenvolvimento</strong>{' '}
                <em>
                  (razão social e CNPJ a serem incluídos após a constituição da
                  empresa)
                </em>
                . Algumas funcionalidades descritas aqui poderão ainda não
                estar disponíveis.
              </p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                2. O que é o Boatzy (e o que não é)
              </h2>
              <p className="mt-3">
                O Boatzy é uma{' '}
                <strong>plataforma de intermediação</strong> que conecta:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  <strong>Anunciantes</strong> — pessoas que disponibilizam
                  embarcações para aluguel; e
                </li>
                <li>
                  <strong>Locatários</strong> — pessoas interessadas em alugar
                  essas embarcações.
                </li>
              </ul>
              <p className="mt-3">
                <strong>
                  O Boatzy atua apenas como intermediário tecnológico.
                </strong>{' '}
                Nós <strong>não</strong> somos proprietários, operadores,
                fretadores ou seguradores de qualquer embarcação anunciada, e{' '}
                <strong>não</strong> somos parte do contrato de locação
                celebrado entre Anunciante e Locatário. A relação de aluguel —
                incluindo condições, preço, entrega, uso e devolução da
                embarcação — é estabelecida diretamente entre os usuários.
              </p>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                3. Cadastro e conta
              </h2>
              <p className="mt-3">Para usar a plataforma, você deve:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  Ter <strong>no mínimo 18 anos</strong> e capacidade civil
                  para contratar;
                </li>
                <li>
                  Fornecer informações{' '}
                  <strong>verídicas, completas e atualizadas</strong>;
                </li>
                <li>
                  Manter a confidencialidade das suas credenciais de acesso.
                </li>
              </ul>
              <p className="mt-3">
                O cadastro pode ser feito por meio do{' '}
                <strong>login da sua conta do Facebook</strong>. Você é
                responsável por toda atividade realizada na sua conta. Avise-nos
                imediatamente em caso de uso não autorizado.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                4. Responsabilidades dos usuários
              </h2>
              <p className="mt-3 font-medium text-slate-900">
                Anunciantes são responsáveis por:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  Garantir que possuem o direito de disponibilizar a embarcação
                  para aluguel;
                </li>
                <li>
                  Manter a embarcação em condições adequadas, seguras e
                  regularizadas perante os órgãos competentes (ex.: Marinha do
                  Brasil), incluindo documentação, habilitação e equipamentos de
                  segurança exigidos;
                </li>
                <li>Prestar informações verdadeiras sobre a embarcação.</li>
              </ul>
              <p className="mt-3 font-medium text-slate-900">
                Locatários são responsáveis por:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Usar a embarcação de forma adequada, legal e segura;</li>
                <li>
                  Possuir a habilitação náutica exigida, quando aplicável;
                </li>
                <li>Cumprir as condições combinadas com o Anunciante.</li>
              </ul>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                5. Condutas proibidas
              </h2>
              <p className="mt-3">
                Ao usar a plataforma, você concorda em <strong>não</strong>:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  Fornecer informações falsas ou se passar por outra pessoa;
                </li>
                <li>Usar a plataforma para fins ilícitos ou fraudulentos;</li>
                <li>
                  Violar direitos de terceiros ou da própria plataforma;
                </li>
                <li>
                  Tentar burlar, sobrecarregar ou comprometer a segurança do
                  sistema;
                </li>
                <li>
                  Copiar, modificar ou explorar comercialmente o conteúdo do
                  Boatzy sem autorização.
                </li>
              </ul>
              <p className="mt-3">
                Podemos suspender ou encerrar contas que violem estes Termos.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                6. Pagamentos
              </h2>
              <blockquote className="mt-3 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                <strong>Funcionalidade futura.</strong> Na fase atual, a
                plataforma ainda não processa pagamentos. Quando o serviço de
                pagamentos for disponibilizado, condições específicas (taxas,
                repasses, reembolsos e cancelamentos) serão detalhadas e
                comunicadas aos usuários, podendo ser objeto de termos
                complementares.
              </blockquote>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                7. Isenção de responsabilidade
              </h2>
              <p className="mt-3">Como o Boatzy é apenas intermediário:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  Não garantimos a qualidade, segurança, legalidade ou
                  disponibilidade das embarcações anunciadas, nem a idoneidade
                  dos usuários;
                </li>
                <li>
                  Não nos responsabilizamos por danos, acidentes, perdas ou
                  prejuízos decorrentes da relação de locação ou do uso das
                  embarcações, que são de responsabilidade exclusiva de
                  Anunciantes e Locatários;
                </li>
                <li>
                  A plataforma é fornecida &quot;no estado em que se
                  encontra&quot;, especialmente nesta fase de desenvolvimento,
                  podendo apresentar instabilidades ou indisponibilidades.
                </li>
              </ul>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                8. Limitação de responsabilidade
              </h2>
              <p className="mt-3">
                Na máxima extensão permitida pela lei brasileira, o Boatzy não
                será responsável por danos indiretos, lucros cessantes ou
                prejuízos decorrentes do uso ou da impossibilidade de uso da
                plataforma, ressalvadas as hipóteses em que a lei não admita tal
                limitação.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                9. Propriedade intelectual
              </h2>
              <p className="mt-3">
                O nome, a marca, o logotipo, o layout, os textos e os demais
                elementos da plataforma pertencem ao Boatzy (ou a seus
                titulares) e são protegidos por lei. O uso da plataforma não
                transfere a você qualquer direito sobre esses elementos.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                10. Privacidade
              </h2>
              <p className="mt-3">
                O tratamento dos seus dados pessoais é regido pela nossa{' '}
                <Link
                  href="/privacy"
                  className="text-[#0B2447] underline hover:no-underline"
                >
                  Política de Privacidade
                </Link>
                , que integra estes Termos.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                11. Suspensão e encerramento
              </h2>
              <p className="mt-3">
                Você pode encerrar sua conta a qualquer momento. Podemos
                suspender ou encerrar o acesso de usuários que violem estes
                Termos ou a lei, ou descontinuar a plataforma (no todo ou em
                parte), especialmente por se tratar de projeto em
                desenvolvimento.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                12. Alterações destes Termos
              </h2>
              <p className="mt-3">
                Podemos atualizar estes Termos periodicamente. A data da última
                atualização será sempre indicada no topo. Mudanças relevantes
                serão comunicadas pelos canais disponíveis. O uso continuado da
                plataforma após as alterações representa concordância com a nova
                versão.
              </p>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                13. Lei aplicável e foro
              </h2>
              <p className="mt-3">
                Estes Termos são regidos pelas{' '}
                <strong>leis da República Federativa do Brasil</strong>. Fica
                eleito o foro do domicílio do consumidor para dirimir eventuais
                controvérsias, conforme o Código de Defesa do Consumidor, quando
                aplicável.
              </p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                14. Contato
              </h2>
              <p className="mt-3">Dúvidas sobre estes Termos de Uso:</p>
              <p className="mt-3">
                📧{' '}
                <a
                  href="mailto:adm@boatzy.app"
                  className="font-semibold text-[#0B2447] underline hover:no-underline"
                >
                  adm@boatzy.app
                </a>
              </p>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
