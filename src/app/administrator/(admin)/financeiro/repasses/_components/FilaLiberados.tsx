'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, HandCoins, Landmark } from 'lucide-react';
import { formatarData } from '@/lib/datas';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarChavePix, resumoDestino } from '@/lib/recebimento-tipos';
import type { GrupoGestor } from '../_lib/consulta';
import RegistrarRepasseModal from './RegistrarRepasseModal';

const brl = formatCurrencyPrecise;

/** Pedidos liberados por gestor: marque o que entra no repasse e registre o pagamento. */
export default function FilaLiberados({ grupos }: { grupos: GrupoGestor[] }) {
  // Padrão: todos os pedidos de todos os gestores marcados. Guarda só os DESMARCADOS.
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState<GrupoGestor | null>(null);

  if (grupos.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
        <HandCoins className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-[#0B2447]">Nenhum repasse liberado agora</p>
        <p className="mt-1 text-xs text-slate-500">
          Um pedido aparece aqui quando o Asaas liquida o pagamento, o passeio já aconteceu e o prazo de espera terminou. Veja o que está a caminho em “Aguardando”.
        </p>
      </div>
    );
  }

  const alternar = (id: string) =>
    setDesmarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });

  return (
    <div className="space-y-5">
      {grupos.map((g) => {
        const marcados = g.pedidos.filter((p) => !desmarcados.has(p.pedido_id));
        const valor = marcados.reduce((s, p) => s + Number(p.valor_repassar), 0);
        const todos = marcados.length === g.pedidos.length;
        return (
          <section key={g.gestor.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0B2447]">{g.gestor.nome}</h2>
                <p className="text-xs text-slate-500">
                  {g.gestor.email}{g.gestor.cpf_cnpj ? ` · ${g.gestor.cpf_cnpj}` : ''}
                </p>
                {g.recebimento ? (
                  <p className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                    <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <span className="min-w-0 break-words">
                      {resumoDestino(g.recebimento)}
                      <span className="block text-xs text-slate-500">
                        Titular: {g.recebimento.titular_nome} · {formatarChavePix(g.recebimento.titular_documento.length === 14 ? 'cnpj' : 'cpf', g.recebimento.titular_documento)}
                      </span>
                    </span>
                  </p>
                ) : (
                  <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Este gestor ainda não informou onde receber (Pix ou conta). O repasse só pode ser registrado depois que ele preencher “Recebimentos” no painel.
                  </p>
                )}
                {g.titularDiferente && (
                  <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    O titular do destino tem CPF/CNPJ diferente do cadastro do gestor. Confirme com ele antes de pagar.
                  </p>
                )}
              </div>
              <div className="shrink-0 text-left lg:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selecionado</p>
                <p className="text-xl font-bold text-[#0B2447]">{brl(valor)}</p>
                <p className="text-xs text-slate-400">de {brl(g.total)} liberados</p>
                <button
                  type="button"
                  disabled={!g.recebimento || marcados.length === 0}
                  onClick={() => setAberto(g)}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <HandCoins className="h-4 w-4" /> Registrar repasse
                </button>
              </div>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="w-10 px-5 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar todos os pedidos de ${g.gestor.nome}`}
                        checked={todos}
                        onChange={() => setDesmarcados((atual) => {
                          const novo = new Set(atual);
                          for (const p of g.pedidos) { if (todos) novo.add(p.pedido_id); else novo.delete(p.pedido_id); }
                          return novo;
                        })}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                    <th className="px-2 py-2.5">Pedido</th>
                    <th className="px-2 py-2.5">Passeio</th>
                    <th className="px-2 py-2.5">Cliente</th>
                    <th className="px-2 py-2.5">Liberado em</th>
                    <th className="px-5 py-2.5 text-right">A repassar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {g.pedidos.map((p) => (
                    <tr key={p.pedido_id} className={desmarcados.has(p.pedido_id) ? 'opacity-50' : ''}>
                      <td className="px-5 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Incluir o pedido #${p.numero}`}
                          checked={!desmarcados.has(p.pedido_id)}
                          onChange={() => alternar(p.pedido_id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <Link href={`/administrator/pedidos/${p.pedido_id}`} className="font-semibold text-[#0B3D91] hover:underline">#{p.numero}</Link>
                        {p.tipo === 'avulso' && <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">avulsa</span>}
                      </td>
                      <td className="px-2 py-2.5 text-slate-700">
                        <span className="block max-w-[220px] truncate">{p.item_nome}</span>
                        <span className="text-xs text-slate-400">{p.fim_passeio ? formatarData(p.fim_passeio) : '—'}</span>
                      </td>
                      <td className="px-2 py-2.5 text-slate-600">{p.cliente_nome}</td>
                      <td className="px-2 py-2.5 text-slate-500">{p.liberado_em ? formatarData(p.liberado_em) : '—'}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-[#0B2447]">{brl(Number(p.valor_repassar))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {aberto?.recebimento && (
        <RegistrarRepasseModal
          // Remonta ao trocar a seleção, para o formulário não carregar estado de outro lote.
          key={`${aberto.gestor.id}:${aberto.pedidos.filter((p) => !desmarcados.has(p.pedido_id)).map((p) => p.pedido_id).join(',')}`}
          gestor={{ id: aberto.gestor.id, nome: aberto.gestor.nome }}
          recebimento={aberto.recebimento}
          pedidoIds={aberto.pedidos.filter((p) => !desmarcados.has(p.pedido_id)).map((p) => p.pedido_id)}
          valorTotal={aberto.pedidos.filter((p) => !desmarcados.has(p.pedido_id)).reduce((s, p) => s + Number(p.valor_repassar), 0)}
          onFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}
