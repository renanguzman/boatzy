import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatarData, hojeISO } from '@/lib/datas';
import { enviarEmail } from '@/lib/emails/layout';
import { montarEmailVencimentos, type ItemVencimento } from '@/lib/emails/documentos-vencimento';
import { nomeCurtoDocumento, TIPOS_DOCUMENTO } from '@/lib/documentos/tipos';
import { DIAS_ALERTA, diasParaVencer, marcoAviso } from '@/lib/documentos/validade';
import type { DocumentoTipo } from '@/types/supabase';

// Avisos de vencimento de documentos (Vercel Cron, ver vercel.json) — SPEC §95.7.
// Para cada documento ativo que alcançou um marco (60, 30, 7 dias antes ou o
// dia/vencido), grava um aviso no sino do painel e manda um e-mail por gestor.
// Idempotente: a chave 'gestor:doc:<id>:<marco>:<validade>' só entra uma vez
// (índice notificacao_chave_uniq) — rodar de novo no mesmo dia não repete, e
// corrigir a validade gera avisos novos. Só o marco mais urgente alcançado é
// avisado (documento cadastrado a 20 dias do vencimento recebe o de 30, não o de 60).
// Protegido por CRON_SECRET, no mesmo padrão de /api/cron/pagamentos.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sem secret configurado, não roda (fail-safe)
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1, d + dias));
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}-${String(alvo.getUTCDate()).padStart(2, '0')}`;
}

type Linha = {
  id: string;
  owner_id: string;
  tipo: DocumentoTipo;
  titulo: string | null;
  data_validade: string;
  embarcacao: { nome: string } | null;
  membro: { nome_completo: string; is_gestor: boolean } | null;
  owner: { name: string | null; email: string | null } | null;
};

async function handler(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const hoje = hojeISO();
  const { data, error } = await supabaseAdmin
    .from('documento')
    .select(
      `id, owner_id, tipo, titulo, data_validade,
       embarcacao:embarcacao_id ( nome ),
       membro:equipe_membro_id ( nome_completo, is_gestor ),
       owner:users!documento_owner_id_fkey ( name, email )`,
    )
    .is('arquivado_em', null)
    .not('data_validade', 'is', null)
    .lte('data_validade', somarDias(hoje, DIAS_ALERTA));

  if (error) {
    console.error('[cron/documentos-validade]', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const porGestor = new Map<string, { nome: string; email: string | null; itens: ItemVencimento[] }>();
  let avisos = 0;

  for (const d of (data ?? []) as unknown as Linha[]) {
    const marco = marcoAviso(d.data_validade, hoje);
    if (marco == null) continue;

    const dias = diasParaVencer(d.data_validade, hoje);
    const sigla = nomeCurtoDocumento(d.tipo, d.titulo);
    const alvo = d.embarcacao?.nome ?? (d.membro ? (d.membro.is_gestor ? 'sua habilitação' : d.membro.nome_completo) : 'documento');
    const renovacao = TIPOS_DOCUMENTO[d.tipo].renovacao;
    const titulo = dias < 0 ? `${sigla} vencido` : dias === 0 ? `${sigla} vence hoje` : `${sigla} vence em ${dias} dia${dias === 1 ? '' : 's'}`;

    const { error: insErr } = await supabaseAdmin.from('notificacao').insert({
      user_id: d.owner_id,
      publico: 'gestor',
      tipo: 'documento_vencendo',
      titulo,
      mensagem: `${alvo} — ${dias < 0 ? 'venceu em' : 'válido até'} ${formatarData(d.data_validade)}.${renovacao ? ` ${renovacao}` : ''}`,
      link: '/painel/documentos',
      chave: `gestor:doc:${d.id}:${marco}:${d.data_validade}`,
    });
    if (insErr) {
      // 23505 = este marco já foi avisado.
      if (insErr.code !== '23505') console.error('[cron/documentos-validade] aviso', d.id, insErr.message);
      continue;
    }
    avisos++;

    const g = porGestor.get(d.owner_id) ?? { nome: d.owner?.name ?? '', email: d.owner?.email ?? null, itens: [] };
    g.itens.push({ sigla, alvo: d.embarcacao?.nome ?? (d.membro ? (d.membro.is_gestor ? 'Você' : d.membro.nome_completo) : '—'), validade: d.data_validade, dias, renovacao });
    porGestor.set(d.owner_id, g);
  }

  await Promise.all(
    [...porGestor.values()].map((g) => {
      const { assunto, html } = montarEmailVencimentos(g.nome, g.itens.sort((a, b) => a.dias - b.dias));
      return enviarEmail(g.email, assunto, html, 'documentos-validade');
    }),
  );

  return NextResponse.json({ ok: true, avisos, gestores: porGestor.size });
}

// A Vercel aciona via GET; POST fica disponível para testes manuais.
export const GET = handler;
export const POST = handler;
