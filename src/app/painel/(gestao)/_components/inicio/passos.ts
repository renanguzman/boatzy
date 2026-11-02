import { formatarData } from '@/lib/datas';
import { pendenciaInscricao } from '@/lib/documentos/aprovacao';
import type { DocumentoAtual } from '@/lib/documentos/rascunho';
import type { OperadorPerfilStatus, PublicacaoStatus } from '@/types/supabase';

/**
 * "Primeiros passos" do Início do painel (PRD §6.8, SPEC §97): o caminho do dono até o
 * primeiro passeio no site — embarcação → documento → aprovação → roteiro → aprovação — e,
 * por último, o perfil de operador que apresenta o gestor ao cliente (SPEC §99).
 * Puro (sem React): recebe o que o gestor já tem e devolve o estado de cada passo.
 */

export type EmbarcacaoInicio = {
  id: string;
  nome: string;
  status: PublicacaoStatus;
  primeira_aprovacao_em: string | null;
  enviado_analise_em: string | null;
};

export type RoteiroInicio = {
  id: string;
  nome: string;
  status: PublicacaoStatus;
  /** Visível no site (roteiro e embarcação aprovados). */
  ativo: boolean;
  embarcacao_id: string | null;
  primeira_aprovacao_em: string | null;
  enviado_analise_em: string | null;
};

/** Perfil de operador do gestor (SPEC §99); `noAr` = há versão aprovada visível no site. */
export type PerfilInicio = {
  status: OperadorPerfilStatus;
  enviado_analise_em: string | null;
  noAr: boolean;
} | null;

/** feito ✓ · fazer (ação do dono) · aguardando (equipe Boatzy) · depois (passo anterior primeiro). */
export type EstadoPasso = 'feito' | 'fazer' | 'aguardando' | 'depois';

export type Passo = {
  id: 'embarcacao' | 'documento' | 'aprovacao_embarcacao' | 'roteiro' | 'aprovacao_roteiro' | 'perfil';
  titulo: string;
  /** O que é e por quê, em uma frase. */
  descricao: string;
  estado: EstadoPasso;
  /** Situação atual ("Maresia", "Em análise desde 12/11"). */
  situacao?: string;
  /** A equipe pediu ajustes / documento vencido. */
  alerta?: boolean;
  acao?: { label: string; href: string };
};

export type PrimeirosPassos = {
  passos: Passo[];
  concluidos: number;
  /** Todos os passos feitos (inclui o perfil aprovado) — os primeiros passos saem do Início. */
  completo: boolean;
  /** Já teve embarcação e roteiro aprovados: o dono já opera (libera os blocos de negócio do Início). */
  noSite: boolean;
  /** Ids da embarcação/roteiro acompanhados nos passos (não se repetem em "Para fazer agora"). */
  embarcacaoId: string | null;
  roteiroId: string | null;
};

/** Ordem de interesse: aprovada > devolvida > em análise > manutenção > inativa. */
const PRIORIDADE: Record<PublicacaoStatus, number> = { ativo: 0, retorno: 1, em_analise: 2, em_manutencao: 3, inativo: 4 };

/** Atualiza o passo com checagem de tipos (estado, ação…). */
function atualizar(p: Passo, patch: Partial<Passo>) {
  Object.assign(p, patch);
}

const porPrioridade = <T extends { status: PublicacaoStatus }>(lista: T[]) =>
  [...lista].sort((a, b) => PRIORIDADE[a.status] - PRIORIDADE[b.status]);

export function montarPrimeirosPassos({
  embarcacoes, roteiros, inscricoes, perfil,
}: {
  embarcacoes: EmbarcacaoInicio[];
  roteiros: RoteiroInicio[];
  inscricoes: Map<string, DocumentoAtual>;
  perfil: PerfilInicio;
}): PrimeirosPassos {
  const emb = porPrioridade(embarcacoes)[0] ?? null;
  const rot = porPrioridade(roteiros.filter((r) => emb && r.embarcacao_id === emb.id))[0]
    ?? porPrioridade(roteiros)[0]
    ?? null;
  const editarEmb = emb ? `/painel/embarcacoes/${emb.id}/editar` : '';
  const editarRot = rot ? `/painel/roteiros/${rot.id}/editar` : '';
  const pendencia = emb ? pendenciaInscricao(inscricoes.get(emb.id)) : 'nao_enviado';

  const passos: Passo[] = [];

  // 1. Embarcação
  passos.push(emb
    ? { id: 'embarcacao', titulo: 'Cadastre sua embarcação', descricao: 'Fotos, local e detalhes do barco.', estado: 'feito', situacao: emb.nome }
    : {
        id: 'embarcacao', titulo: 'Cadastre sua embarcação', descricao: 'Fotos, local e detalhes do barco. Leva uns 5 minutos.',
        estado: 'fazer', acao: { label: 'Cadastrar embarcação', href: '/painel/embarcacoes/novo' },
      });

  // 2. Documento da embarcação
  passos.push(!emb
    ? { id: 'documento', titulo: 'Envie o documento da embarcação', descricao: 'Foto ou PDF do TIE (ou TIEM).', estado: 'depois' }
    : !pendencia
      ? { id: 'documento', titulo: 'Envie o documento da embarcação', descricao: 'Foto ou PDF do TIE (ou TIEM).', estado: 'feito', situacao: 'Documento enviado' }
      : {
          id: 'documento', titulo: 'Envie o documento da embarcação',
          descricao: 'Foto ou PDF do TIE (ou TIEM). Sem ele, a embarcação não é aprovada.',
          estado: 'fazer', alerta: pendencia === 'vencido',
          situacao: pendencia === 'vencido' ? 'O documento enviado está vencido — envie o novo' : undefined,
          acao: { label: 'Enviar documento', href: `${editarEmb}#documentacao` },
        });

  // 3. Aprovação da embarcação
  const aprovEmb: Passo = {
    id: 'aprovacao_embarcacao', titulo: 'Aguarde a aprovação da embarcação',
    descricao: 'A equipe Boatzy confere os dados e o documento. Você recebe a resposta por e-mail.', estado: 'depois',
  };
  if (emb) {
    if (emb.status === 'ativo') atualizar(aprovEmb, { titulo: 'Embarcação aprovada', estado: 'feito' });
    else if (emb.status === 'retorno') {
      atualizar(aprovEmb, {
        titulo: 'Ajuste o cadastro da embarcação', estado: 'fazer', alerta: true, situacao: 'A equipe Boatzy pediu ajustes',
        descricao: 'Veja o recado da equipe Boatzy, corrija e reenvie para análise.',
        acao: { label: 'Ver o que ajustar', href: editarEmb },
      });
    } else if (emb.status === 'em_analise') {
      atualizar(aprovEmb, pendencia
        ? { estado: 'depois', situacao: 'Começa quando o documento for enviado' }
        : { estado: 'aguardando', situacao: emb.enviado_analise_em ? `Em análise desde ${formatarData(emb.enviado_analise_em)}` : 'Em análise' });
    } else {
      atualizar(aprovEmb, {
        titulo: 'Embarcação fora do site', estado: 'fazer', descricao: 'Peça para ela voltar: passa por uma nova análise da equipe Boatzy.',
        acao: { label: 'Pedir para voltar ao site', href: editarEmb },
      });
    }
  }
  passos.push(aprovEmb);

  // 4. Roteiro — já pode ser criado com a embarcação em análise.
  passos.push(!emb
    ? { id: 'roteiro', titulo: 'Crie um roteiro', descricao: 'O passeio que o cliente reserva: trajeto, duração e preço.', estado: 'depois' }
    : rot
      ? { id: 'roteiro', titulo: 'Crie um roteiro', descricao: 'O passeio que o cliente reserva.', estado: 'feito', situacao: rot.nome }
      : {
          id: 'roteiro', titulo: 'Crie um roteiro',
          descricao: 'O passeio que o cliente reserva: trajeto, duração e preço. Pode criar enquanto a embarcação está em análise.',
          estado: 'fazer', acao: { label: 'Criar roteiro', href: `/painel/roteiros/novo?embarcacao=${emb.id}` },
        });

  // 5. Aprovação do roteiro — no site quando roteiro e embarcação estão aprovados.
  const aprovRot: Passo = {
    id: 'aprovacao_roteiro', titulo: 'Aguarde a aprovação do roteiro',
    descricao: 'Aprovado, ele aparece no site e você começa a receber reservas.', estado: 'depois',
  };
  if (rot) {
    if (rot.ativo) atualizar(aprovRot, { titulo: 'Roteiro no site', estado: 'feito', situacao: 'Já pode receber reservas' });
    else if (rot.status === 'ativo') {
      atualizar(aprovRot, { estado: 'aguardando', situacao: 'Aprovado — entra no site quando a embarcação for aprovada' });
    } else if (rot.status === 'retorno') {
      atualizar(aprovRot, {
        titulo: 'Ajuste o roteiro', estado: 'fazer', alerta: true, situacao: 'A equipe Boatzy pediu ajustes',
        descricao: 'Veja o recado da equipe Boatzy, corrija e reenvie para análise.',
        acao: { label: 'Ver o que ajustar', href: editarRot },
      });
    } else if (rot.status === 'em_analise') {
      atualizar(aprovRot, {
        estado: 'aguardando', situacao: rot.enviado_analise_em ? `Em análise desde ${formatarData(rot.enviado_analise_em)}` : 'Em análise',
      });
    } else {
      atualizar(aprovRot, {
        titulo: 'Roteiro fora do site', estado: 'fazer', descricao: 'Peça para ele voltar: passa por uma nova análise da equipe Boatzy.',
        acao: { label: 'Pedir para voltar ao site', href: editarRot },
      });
    }
  }
  passos.push(aprovRot);

  // 6. Perfil do operador — o último passo: quem vai receber o cliente. Sempre acionável (não
  //    depende dos passos de cima); só vira "Próximo passo" quando os anteriores não pedem nada.
  const passoPerfil: Passo = {
    id: 'perfil', titulo: 'Conte quem é você',
    descricao: 'Quem reserva quer saber quem vai conduzir o passeio. Uma foto e algumas linhas sobre você passam confiança — e a IA ajuda a escrever em poucos minutos.',
    estado: 'fazer', acao: { label: 'Completar meu perfil', href: '/painel/perfil' },
  };
  if (perfil?.noAr) {
    atualizar(passoPerfil, {
      titulo: 'Perfil no ar', estado: 'feito', acao: undefined,
      situacao: perfil.status === 'em_analise' ? 'Alterações em análise'
        : perfil.status === 'devolvido' ? 'A equipe pediu ajustes' : 'Aparece nos seus passeios',
      alerta: perfil.status === 'devolvido',
    });
  } else if (perfil?.status === 'em_analise') {
    atualizar(passoPerfil, {
      titulo: 'Aguarde a aprovação do perfil', estado: 'aguardando', acao: undefined,
      descricao: 'A equipe Boatzy revisa a sua foto e o seu texto. Você recebe a resposta por e-mail e aqui no painel.',
      situacao: perfil.enviado_analise_em ? `Em análise desde ${formatarData(perfil.enviado_analise_em)}` : 'Em análise',
    });
  } else if (perfil?.status === 'devolvido' || perfil?.status === 'retirado') {
    atualizar(passoPerfil, {
      titulo: perfil.status === 'devolvido' ? 'Ajuste o seu perfil' : 'Seu perfil saiu do ar',
      alerta: true, situacao: perfil.status === 'devolvido' ? 'A equipe Boatzy pediu ajustes' : 'Retirado pela equipe Boatzy',
      descricao: 'Veja o recado da equipe Boatzy, corrija e reenvie para análise.',
      acao: { label: 'Ver o que ajustar', href: '/painel/perfil' },
    });
  } else if (perfil?.status === 'rascunho') {
    atualizar(passoPerfil, { situacao: 'Rascunho salvo — falta enviar', acao: { label: 'Continuar meu perfil', href: '/painel/perfil' } });
  }
  passos.push(passoPerfil);

  const noSite = embarcacoes.some((e) => e.primeira_aprovacao_em) && roteiros.some((r) => r.primeira_aprovacao_em);
  return {
    passos,
    concluidos: passos.filter((p) => p.estado === 'feito').length,
    noSite,
    completo: noSite && passoPerfil.estado === 'feito',
    embarcacaoId: emb?.id ?? null,
    roteiroId: rot?.id ?? null,
  };
}
