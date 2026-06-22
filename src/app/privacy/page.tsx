import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Boatzy',
  description:
    'Saiba como o Boatzy trata seus dados pessoais em conformidade com a LGPD e o Marco Civil da Internet.',
};

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <main className="flex-1 bg-slate-50">
        {/* Hero */}
        <section className="bg-[#0B2447] text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Política de Privacidade
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
              advogado de direito digital antes do lançamento oficial e após a
              constituição da empresa (CNPJ).
            </p>
          </div>

          <article className="mt-10 space-y-10 text-slate-700 leading-relaxed">
            {/* 1 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                1. Quem somos
              </h2>
              <p className="mt-3">
                O <strong>Boatzy</strong> (&quot;Boatzy&quot;, &quot;nós&quot;
                ou &quot;plataforma&quot;) é um projeto em desenvolvimento que
                está construindo uma plataforma digital de intermediação de
                aluguel de embarcações — conectando pessoas que desejam alugar
                barcos (Locatários) a proprietários que os disponibilizam
                (Anunciantes).
              </p>
              <p className="mt-3">
                Esta Política de Privacidade explica como tratamos os dados
                pessoais de quem acessa ou se cadastra na plataforma, em
                conformidade com a{' '}
                <strong>
                  Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD)
                </strong>{' '}
                e o{' '}
                <strong>
                  Marco Civil da Internet (Lei nº 12.965/2014)
                </strong>
                .
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  <strong>
                    Responsável pelo tratamento dos dados (Controlador):
                  </strong>{' '}
                  Boatzy — projeto em desenvolvimento{' '}
                  <em>
                    (razão social e CNPJ a serem incluídos após a constituição
                    da empresa)
                  </em>
                </li>
                <li>
                  <strong>Canal de contato para assuntos de privacidade:</strong>{' '}
                  <a
                    href="mailto:adm@boatzy.app"
                    className="text-[#0B2447] underline hover:no-underline"
                  >
                    adm@boatzy.app
                  </a>
                </li>
                <li>
                  <strong>Site:</strong> boatzy.app
                </li>
              </ul>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                2. Quais dados coletamos
              </h2>
              <p className="mt-3">
                Nesta fase, coletamos os dados estritamente necessários para
                criar e identificar sua conta:
              </p>
              <p className="mt-3 font-medium text-slate-900">
                a) Dados que você nos fornece ao se cadastrar via login do
                Facebook:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Nome completo</li>
                <li>Endereço de e-mail</li>
                <li>Gênero</li>
                <li>Cidade</li>
                <li>Foto de perfil</li>
              </ul>
              <p className="mt-3 font-medium text-slate-900">
                b) Dados coletados automaticamente quando você usa a plataforma:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Endereço de IP, tipo de dispositivo e navegador</li>
                <li>
                  Dados de navegação e de uso (páginas acessadas, data e hora)
                </li>
                <li>Cookies e tecnologias semelhantes (ver seção 6)</li>
              </ul>
              <blockquote className="mt-4 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                Aplicamos o princípio da <strong>minimização</strong>:
                coletamos apenas o necessário para o funcionamento da plataforma
                na fase atual. Não coletamos dados sensíveis (origem racial,
                opinião política, saúde, vida sexual etc.).
              </blockquote>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                3. Como e por que usamos seus dados
              </h2>
              <p className="mt-3">
                Usamos seus dados pelas seguintes finalidades e bases legais
                previstas na LGPD:
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                        Finalidade
                      </th>
                      <th className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                        Base legal (LGPD)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        'Criar, identificar e autenticar sua conta',
                        'Execução de contrato (art. 7º, V)',
                      ],
                      [
                        'Permitir o login pela conta do Facebook',
                        'Execução de contrato / consentimento',
                      ],
                      [
                        'Operar, manter e melhorar a plataforma',
                        'Legítimo interesse (art. 7º, IX)',
                      ],
                      [
                        'Personalizar sua experiência e comunicações (ex.: tratamento adequado)',
                        'Legítimo interesse / consentimento',
                      ],
                      [
                        'Comunicar avisos importantes sobre sua conta',
                        'Execução de contrato',
                      ],
                      [
                        'Cumprir obrigações legais e regulatórias',
                        'Obrigação legal (art. 7º, II)',
                      ],
                      [
                        'Prevenir fraudes e garantir a segurança',
                        'Legítimo interesse',
                      ],
                    ].map(([finalidade, base]) => (
                      <tr key={finalidade}>
                        <td className="border border-slate-200 px-3 py-2 align-top">
                          {finalidade}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 align-top">
                          {base}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                <strong>Não vendemos seus dados pessoais.</strong>
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                4. Com quem compartilhamos
              </h2>
              <p className="mt-3">
                Podemos compartilhar dados apenas quando necessário e nas
                seguintes situações:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  <strong>Provedores de tecnologia</strong> que nos apoiam
                  (hospedagem, autenticação, análise) — apenas o necessário e
                  sob obrigação de confidencialidade.
                </li>
                <li>
                  <strong>Meta/Facebook</strong>, quando você opta por usar o
                  login social — o tratamento dos dados pela Meta é regido pela
                  política de privacidade dela.
                </li>
                <li>
                  <strong>Autoridades públicas</strong>, quando exigido por lei,
                  ordem judicial ou para defesa de direitos.
                </li>
              </ul>
              <p className="mt-3">
                Não compartilhamos seus dados com terceiros para fins de
                marketing sem o seu consentimento.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                5. Por quanto tempo guardamos
              </h2>
              <p className="mt-3">
                Mantemos seus dados pelo tempo necessário para as finalidades
                descritas ou para cumprir obrigações legais. Você pode solicitar
                a exclusão da sua conta e dos seus dados a qualquer momento pelo
                e-mail{' '}
                <a
                  href="mailto:adm@boatzy.app"
                  className="text-[#0B2447] underline hover:no-underline"
                >
                  adm@boatzy.app
                </a>
                , ressalvadas as informações que a lei exige que sejam mantidas.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                6. Cookies e tecnologias semelhantes
              </h2>
              <p className="mt-3">
                Usamos cookies e tecnologias similares para manter você
                conectado, lembrar preferências e entender como a plataforma é
                usada. Você pode gerenciar os cookies nas configurações do seu
                navegador — mas algumas funções podem deixar de operar
                corretamente.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                7. Segurança
              </h2>
              <p className="mt-3">
                Adotamos medidas técnicas e organizacionais razoáveis para
                proteger seus dados contra acesso não autorizado, perda ou
                alteração. Nenhum sistema é 100% seguro, mas trabalhamos para
                reduzir riscos e responder a eventuais incidentes.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                8. Transferência internacional
              </h2>
              <p className="mt-3">
                Alguns de nossos provedores de tecnologia podem estar
                localizados fora do Brasil. Nesses casos, adotamos salvaguardas
                para que seus dados continuem protegidos conforme a LGPD.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                9. Seus direitos como titular
              </h2>
              <p className="mt-3">
                Nos termos do art. 18 da LGPD, você pode, a qualquer momento:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>Confirmar a existência de tratamento dos seus dados</li>
                <li>Acessar seus dados</li>
                <li>
                  Corrigir dados incompletos, inexatos ou desatualizados
                </li>
                <li>
                  Solicitar anonimização, bloqueio ou eliminação de dados
                  desnecessários
                </li>
                <li>Solicitar a portabilidade dos dados</li>
                <li>
                  Revogar o consentimento e solicitar a exclusão da conta
                </li>
                <li>
                  Obter informação sobre com quem compartilhamos seus dados
                </li>
              </ul>
              <p className="mt-3">
                Para exercer qualquer um desses direitos, escreva para{' '}
                <a
                  href="mailto:adm@boatzy.app"
                  className="text-[#0B2447] underline hover:no-underline"
                >
                  adm@boatzy.app
                </a>
                .
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                10. Menores de idade
              </h2>
              <p className="mt-3">
                A plataforma é destinada a maiores de 18 anos. Não coletamos
                intencionalmente dados de menores de idade. Se identificarmos
                esse tipo de coleta, os dados serão excluídos.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                11. Alterações desta Política
              </h2>
              <p className="mt-3">
                Podemos atualizar esta Política periodicamente, especialmente
                conforme a plataforma evolui. A data da última atualização será
                sempre indicada no topo. Mudanças relevantes serão comunicadas
                pelos canais disponíveis.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-semibold text-slate-900">
                12. Contato
              </h2>
              <p className="mt-3">
                Dúvidas, solicitações ou reclamações sobre privacidade e
                proteção de dados:
              </p>
              <p className="mt-3">
                📧{' '}
                <a
                  href="mailto:adm@boatzy.app"
                  className="font-semibold text-[#0B2447] underline hover:no-underline"
                >
                  adm@boatzy.app
                </a>
              </p>
              <p className="mt-3 text-sm italic text-slate-500">
                Encarregado pelo Tratamento de Dados (DPO) a ser designado após
                a constituição da empresa.
              </p>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
