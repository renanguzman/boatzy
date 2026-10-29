import 'server-only';

import { getTranslations } from 'next-intl/server';
import { formatarData } from '@/lib/datas';
import { horarioRetorno, duracaoTexto } from '@/lib/duracao';
import { criarFormatos } from '@/i18n/formatos';
import { IDIOMA_PADRAO, isIdioma, type Idioma } from '@/i18n/config';
import { formatarCelular } from '@/lib/comunicacao/formato';
import type { MarcoLembrete } from '@/lib/comunicacao/agenda';
import type { DadosPasseio, ExtrasPasseio } from '@/lib/comunicacao/dados-passeio';
import type { PrevisaoTempo } from '@/lib/weather';
import { baseUrl, esc, montarEmailHtml, type BlocoEmail } from './layout';

/**
 * E-mails dos lembretes do passeio (SPEC §96): véspera (D-1) e dia do passeio (H-3 — ou "é hoje",
 * às 7h, quando o roteiro não tem horário de saída). O do cliente sai no idioma da conta
 * (`users.idioma`) e reforça tudo sobre o passeio; o do gestor (pt-BR) é um checklist operacional.
 * O celular da outra parte aparece discreto, abaixo do botão.
 */

export type EmailMontado = { assunto: string; html: string };

const codigoReserva = (id: string) => id.slice(0, 8).toUpperCase();
const link = (url: string, texto: string) =>
  `<a href="${esc(url)}" style="color:#0E2F4F;font-weight:bold;">${esc(texto)}</a>`;
const aviso = (texto: string) => `⚠️ ${esc(texto)}`;

/** "h3" sem horário de saída vira o lembrete "seu passeio é hoje". */
const variante = (marco: MarcoLembrete, d: DadosPasseio) => (marco === 'd1' ? 'd1' : d.horarioSaida ? 'h3' : 'hoje');

const numerados = (itens: string[], rotulo: (n: number) => string): [string, string][] =>
  itens.map((item, i) => [rotulo(i + 1), item]);

/* ── Cliente ─────────────────────────────────────────────────────────────── */

export async function montarLembreteCliente(d: DadosPasseio, marco: MarcoLembrete, extras: ExtrasPasseio): Promise<EmailMontado> {
  const idioma: Idioma = isIdioma(d.cliente.idioma) ? d.cliente.idioma : IDIOMA_PADRAO;
  const [t, tFormatos] = await Promise.all([
    getTranslations({ locale: idioma, namespace: 'EmailLembrete' }),
    getTranslations({ locale: idioma, namespace: 'Formatos' }),
  ]);
  const f = criarFormatos(tFormatos, idioma);
  const v = variante(marco, d);
  const hora = d.horarioSaida ? f.horario(d.horarioSaida) : '';
  const completo = v === 'd1';

  const dataLonga = (() => {
    const texto = f.data(d.dataReserva, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  })();
  const retorno = horarioRetorno(d.horarioSaida, d.duracaoHoras);
  const duracao = f.duracao(d.duracaoHoras);

  const paragrafos = [
    esc(t(`intro.${v}`, { item: d.item, hora })),
    esc(d.horarioSaida ? t('antecedencia') : t('semHorario')),
    ...(d.mapaUrl ? [`📍 ${link(d.mapaUrl, t('abrirMapa'))}`] : []),
    `${esc(t('chatAviso'))} ${link(`${baseUrl()}/minhas-reservas/${d.id}`, t('conversar'))}`,
    ...(extras.cobrancasAbertas > 0 ? [aviso(t('pagamento.cobrancasAbertas', { count: extras.cobrancasAbertas }))] : []),
  ];

  const blocos: BlocoEmail[] = [
    {
      titulo: t('blocos.passeio'),
      linhas: [
        [t('rotulos.passeio'), d.item],
        [t('rotulos.data'), dataLonga],
        ...(d.horarioSaida ? [[t('rotulos.saida'), hora] as [string, string]] : []),
        ...(retorno
          ? [[t('rotulos.retorno'), f.retorno(retorno)] as [string, string]]
          : duracao ? [[t('rotulos.duracao'), duracao] as [string, string]] : []),
        [t('rotulos.pessoas'), t('pessoasValor', { count: d.pessoas })],
        ...(d.embarcacao ? [[t('rotulos.embarcacao'), d.embarcacao] as [string, string]] : []),
        [t('rotulos.reserva'), codigoReserva(d.id)],
      ],
    },
    {
      titulo: t('blocos.embarque'),
      linhas: [
        ...(d.endereco
          ? [[t('rotulos.endereco'), d.endereco] as [string, string]]
          : d.localidade ? [[t('rotulos.local'), d.localidade] as [string, string]] : []),
        ...(d.origem ? [[t('rotulos.origem'), d.origem] as [string, string]] : []),
        ...(d.destino && d.destino !== d.origem ? [[t('rotulos.destino'), d.destino] as [string, string]] : []),
      ],
    },
    ...(completo ? [{ titulo: t('blocos.roteiro'), linhas: numerados(d.paradas, (n) => t('rotulos.parada', { n })) }] : []),
    {
      titulo: t('blocos.contatos'),
      linhas: [
        [t('rotulos.proprietario'), d.gestor.nome],
        ...(() => {
          const equipe = d.atendentes.filter((a) => !a.isGestor).map((a) => a.nome);
          return equipe.length ? [[t('rotulos.atendimento'), equipe.join(', ')] as [string, string]] : [];
        })(),
      ],
    },
    ...(completo
      ? [
          { titulo: t('blocos.contratados'), linhas: numerados(d.adicionais.map((a) => a.descricao), (n) => t('rotulos.item', { n })) },
          { titulo: t('blocos.regras'), linhas: numerados(d.regras, (n) => t('rotulos.regra', { n })) },
          {
            titulo: t('blocos.levar'),
            linhas: numerados(
              [t('levar.documento'), t('levar.protetor'), t('levar.toalha'), t('levar.agua')],
              (n) => t('rotulos.item', { n }),
            ),
          },
        ]
      : []),
    ...(extras.previsao ? [blocoTempo(extras.previsao, idioma === 'pt-BR', {
      titulo: t('blocos.tempo'),
      temperatura: [t('rotulos.temperatura'), t('temperaturaValor', { max: Math.round(extras.previsao.temperaturaMax), min: Math.round(extras.previsao.temperaturaMin) })],
      chuva: t('rotulos.chuva'),
      vento: [t('rotulos.vento'), t('ventoValor', { kmh: Math.round(extras.previsao.ventoMaxKmh) })],
    })] : []),
    ...(completo
      ? [{
          titulo: t('blocos.pagamento'),
          linhas: [[t('rotulos.situacao'), d.pagamento.pagoBoatzy ? t('pagamento.pago') : t('pagamento.combinado')] as [string, string]],
        }]
      : []),
  ];

  const celular = formatarCelular(d.gestor.telefone);
  return {
    assunto: t(`assunto.${v}`, { item: d.item, hora }),
    html: montarEmailHtml({
      nome: d.cliente.nome,
      saudacao: (nome) => t('saudacao', { nome }),
      lang: idioma,
      paragrafos,
      blocos,
      botao: { texto: t('botao'), url: `${baseUrl()}/minhas-reservas/${d.id}` },
      aposBotao: celular ? esc(t('celular', { telefone: celular })) : undefined,
      rodape: t('rodape'),
    }),
  };
}

function blocoTempo(
  p: PrevisaoTempo,
  comCondicao: boolean,
  r: { titulo: string; temperatura: [string, string]; chuva: string; vento: [string, string] },
): BlocoEmail {
  // A condição (ex.: "Parcialmente nublado") só existe em pt-BR (src/lib/weather.ts).
  const temperatura: [string, string] = comCondicao ? [r.temperatura[0], `${p.condicao.label} · ${r.temperatura[1]}`] : r.temperatura;
  return {
    titulo: r.titulo,
    linhas: [
      temperatura,
      ...(p.chanceChuvaPercent != null ? [[r.chuva, `${p.chanceChuvaPercent}%`] as [string, string]] : []),
      r.vento,
    ],
  };
}

/* ── Gestor (pt-BR) ──────────────────────────────────────────────────────── */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const horaBR = (hhmm: string) => hhmm.slice(0, 5);

export function montarLembreteGestor(d: DadosPasseio, marco: MarcoLembrete, extras: ExtrasPasseio): EmailMontado {
  const v = variante(marco, d);
  const hora = d.horarioSaida ? horaBR(d.horarioSaida) : '';
  const completo = v === 'd1';
  const equipe = d.atendentes.map((a) => (a.isGestor ? 'Você' : a.nome));

  const assunto = v === 'd1'
    ? `Amanhã: ${d.item} com ${d.cliente.nome}`
    : v === 'h3'
      ? `Em 3 horas: ${d.item} com ${d.cliente.nome} (saída às ${hora})`
      : `Hoje: ${d.item} com ${d.cliente.nome}`;

  const intro = v === 'd1'
    ? `Amanhã você tem o passeio <strong>${esc(d.item)}</strong> com <strong>${esc(d.cliente.nome)}</strong>. Confira o checklist para deixar tudo pronto.`
    : v === 'h3'
      ? `Seu passeio <strong>${esc(d.item)}</strong> com <strong>${esc(d.cliente.nome)}</strong> sai hoje às <strong>${esc(hora)}</strong>. O cliente também recebeu o lembrete com o ponto de embarque.`
      : `Hoje é dia do passeio <strong>${esc(d.item)}</strong> com <strong>${esc(d.cliente.nome)}</strong>.`;

  const alertas = [
    ...(!d.horarioSaida
      ? [aviso('Este roteiro não tem horário de saída cadastrado: o cliente recebe o lembrete do dia às 7h, sem o horário. Cadastre-o no roteiro e combine pelo chat.')]
      : []),
    ...(equipe.length === 0 ? [aviso('Ninguém foi escalado para atender este passeio. Defina a equipe no agendamento.')] : []),
    ...(extras.documentosVencidos.length > 0
      ? [aviso(`Documentos vencidos: ${extras.documentosVencidos.join(', ')}. Regularize antes de embarcar.`)]
      : []),
    ...(extras.cobrancasAbertas > 0
      ? [aviso(`O cliente tem ${extras.cobrancasAbertas} cobrança${extras.cobrancasAbertas > 1 ? 's' : ''} adicional${extras.cobrancasAbertas > 1 ? 'is' : ''} em aberto.`)]
      : []),
  ];

  const blocos: BlocoEmail[] = [
    {
      titulo: 'Passeio',
      linhas: [
        ['Passeio', d.item],
        ['Data', formatarData(d.dataReserva, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })],
        ['Saída', hora || 'Não cadastrada'],
        ...(duracaoTexto(d.duracaoHoras) ? [['Duração', duracaoTexto(d.duracaoHoras)!] as [string, string]] : []),
        ...(d.embarcacao ? [['Embarcação', d.embarcacao] as [string, string]] : []),
        ...(d.endereco || d.localidade ? [['Embarque', (d.endereco ?? d.localidade)!] as [string, string]] : []),
        ['Reserva', codigoReserva(d.id)],
      ],
    },
    {
      titulo: 'Cliente',
      linhas: [
        ['Nome', d.cliente.nome],
        ['Pessoas', `${d.pessoas} pessoa${d.pessoas === 1 ? '' : 's'}`],
      ],
    },
    ...(completo
      ? [
          { titulo: 'Para preparar (adicionais)', linhas: numerados(d.adicionais.map((a) => a.descricao), (n) => `Item ${n}`) },
          { titulo: 'Equipe escalada', linhas: equipe.length ? [['Atendimento', equipe.join(', ')] as [string, string]] : [] },
          {
            titulo: 'Financeiro',
            linhas: d.pagamento.pagoBoatzy
              ? [['Situação', 'Pago pelo Boatzy'] as [string, string],
                 ...(d.pagamento.valorGestor != null ? [['Você recebe', brl(d.pagamento.valorGestor)] as [string, string]] : [])]
              : [['Situação', 'Combinado diretamente com o cliente'] as [string, string],
                 ...(d.pagamento.valorTotal != null ? [['Total estimado', brl(d.pagamento.valorTotal)] as [string, string]] : [])],
          },
        ]
      : []),
    ...(extras.previsao ? [blocoTempo(extras.previsao, true, {
      titulo: 'Previsão do tempo',
      temperatura: ['Temperatura', `${Math.round(extras.previsao.temperaturaMax)}° / ${Math.round(extras.previsao.temperaturaMin)}°`],
      chuva: 'Chance de chuva',
      vento: ['Vento', `até ${Math.round(extras.previsao.ventoMaxKmh)} km/h`],
    })] : []),
  ];

  const celular = formatarCelular(d.cliente.telefone);
  return {
    assunto,
    html: montarEmailHtml({
      nome: d.gestor.nome,
      paragrafos: [intro, ...alertas, `Imprevistos? Fale com o cliente pelo chat do Boatzy.`],
      blocos,
      botao: { texto: 'Ver agendamento', url: `${baseUrl()}/painel/agendamentos/${d.id}` },
      aposBotao: celular ? esc(`Celular do cliente para o dia do embarque: ${celular}`) : undefined,
      rodape: 'Você recebe este e-mail porque tem um passeio confirmado no Boatzy.',
    }),
  };
}
