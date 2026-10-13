import Image from 'next/image';
import Link from 'next/link';
import { BadgeDollarSign, ClipboardCheck, Ship } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { formatarData } from '@/lib/datas';
import { contarPorStatus } from '@/lib/publicacao/server';
import FiltroStatusPublicacao from '@/components/publicacao/FiltroStatusPublicacao';
import StatusPublicacaoBadge from '@/components/publicacao/StatusPublicacaoBadge';
import type { AnuncioVendaStatus, PublicacaoStatus } from '@/types/supabase';

const STATUSES: AnuncioVendaStatus[] = ['em_analise', 'retorno', 'ativo', 'pausado', 'vendido', 'cancelado'];
const LIMITE = 100;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type Linha = {
  id: string;
  owner_id: string;
  fabricante: string;
  ano_modelo: number;
  preco: number;
  status: AnuncioVendaStatus;
  enviado_analise_em: string | null;
  revisao: number;
  created_at: string;
  embarcacao: {
    nome: string;
    status: PublicacaoStatus;
    embarcacao_imagens: { url_imagem: string; principal: boolean }[];
  } | null;
};

/** Anúncios de venda da plataforma, com a fila de análise (pipeline de aprovação). */
export default async function AdminVendasPage({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const sp = await searchParams;

  const contagem = await contarPorStatus('anuncio_venda', STATUSES);
  const st: AnuncioVendaStatus | 'todos' =
    sp.st === 'todos' || STATUSES.includes(sp.st as AnuncioVendaStatus) ? (sp.st as AnuncioVendaStatus | 'todos')
    : contagem.em_analise > 0 ? 'em_analise' : 'todos';

  let query = supabaseAdmin
    .from('anuncio_venda')
    .select(`
      id, owner_id, fabricante, ano_modelo, preco, status, enviado_analise_em, revisao, created_at,
      embarcacao ( nome, status, embarcacao_imagens ( url_imagem, principal ) )
    `);
  if (st !== 'todos') query = query.eq('status', st);
  // Fila de análise: mais antigos primeiro. Demais: mais recentes.
  query = st === 'em_analise'
    ? query.order('enviado_analise_em', { ascending: true })
    : query.order('created_at', { ascending: false });

  const { data } = await query.limit(LIMITE);
  const anuncios = (data ?? []) as unknown as Linha[];

  const ownerIds = [...new Set(anuncios.map(a => a.owner_id))];
  const { data: gestores } = ownerIds.length
    ? await supabaseAdmin.from('users').select('id, name, email').in('id', ownerIds)
    : { data: [] };
  const gestorById = new Map((gestores ?? []).map(g => [g.id, g]));

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <BadgeDollarSign className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Anúncios de venda</h1>
          <p className="text-sm text-slate-500">
            Anúncios de embarcações à venda. Analise os enviados, publique, devolva para ajustes ou retire do ar.
          </p>
        </div>
      </div>

      <FiltroStatusPublicacao
        atual={st}
        opcoes={[
          { value: 'todos', count: Object.values(contagem).reduce((a, b) => a + b, 0) },
          ...STATUSES.map(value => ({ value, count: contagem[value] ?? 0 })),
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {anuncios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Ship className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">Nenhum anúncio neste status</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Embarcação', 'Gestor', 'Fabricante / ano', 'Valor', 'Status', ''].map((h, i) => (
                    <th key={i} className={`pb-3 pt-4 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap ${i === 0 ? 'pl-6' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anuncios.map(a => {
                  const imgs = a.embarcacao?.embarcacao_imagens ?? [];
                  const img = (imgs.find(i => i.principal) ?? imgs[0])?.url_imagem ?? null;
                  const gestor = gestorById.get(a.owner_id);
                  return (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                            {img
                              ? <Image src={img} alt="" width={44} height={44} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Ship className="w-5 h-5 text-slate-300" /></div>}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0B2447] leading-tight">{a.embarcacao?.nome ?? '—'}</p>
                            {a.embarcacao && a.embarcacao.status !== 'ativo' && (
                              <p className="mt-0.5 text-[10px] text-amber-700">Embarcação não ativa — anúncio fora do site</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-slate-700 whitespace-nowrap">{gestor?.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{gestor?.email}</p>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600 whitespace-nowrap">{a.fabricante} · {a.ano_modelo}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-[#0B2447] whitespace-nowrap">{brl.format(Number(a.preco))}</td>
                      <td className="py-4 px-4">
                        <StatusPublicacaoBadge status={a.status} />
                        {a.status === 'em_analise' && a.enviado_analise_em && (
                          <p className="mt-1 text-[10px] text-slate-400 whitespace-nowrap">
                            desde {formatarData(a.enviado_analise_em)}{a.revisao > 1 ? ` · ${a.revisao}ª análise` : ''}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <Link href={`/administrator/vendas/${a.id}`}
                          className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg transition-colors ${
                            a.status === 'em_analise'
                              ? 'px-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold'
                              : 'w-8 text-slate-400 hover:text-[#0B2447] hover:bg-slate-100'}`}
                          title={a.status === 'em_analise' ? 'Analisar' : 'Análise e histórico'}>
                          <ClipboardCheck className="w-4 h-4" />
                          {a.status === 'em_analise' && 'Analisar'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {anuncios.length === LIMITE && (
          <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">Mostrando os {LIMITE} primeiros — use as abas de status para filtrar.</p>
        )}
      </div>
    </div>
  );
}
