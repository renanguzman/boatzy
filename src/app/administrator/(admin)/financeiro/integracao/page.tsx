import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { lerAsaasConfig, lerTokenWebhook, urlWebhookSugerida } from '@/lib/asaas/config';
import { mensagemErroAsaas } from '@/lib/asaas/client';
import { listarWebhooks } from '@/lib/asaas/webhooks';
import type { AsaasWebhookConfig } from '@/lib/asaas/tipos';
import type { AsaasWebhookEventoStatus } from '@/types/supabase';
import ConexaoAsaasCard from './_components/ConexaoAsaasCard';
import WebhooksAsaasCard from './_components/WebhooksAsaasCard';
import EventosWebhookGrid, { type EventoWebhookItem } from './_components/EventosWebhookGrid';

const PAGE_SIZES = [10, 25, 50] as const;

const STATUS: AsaasWebhookEventoStatus[] = ['pendente', 'processando', 'processado', 'ignorado', 'erro'];

type SearchParams = { q?: string; status?: string; page?: string; per?: string };

export default async function AdminFinanceiroIntegracaoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const status = STATUS.includes(sp.status as AsaasWebhookEventoStatus) ? (sp.status as AsaasWebhookEventoStatus) : null;
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"%*]/g, '');

  const cfg = lerAsaasConfig();
  const tokenConfigurado = !!lerTokenWebhook();

  let webhooks: AsaasWebhookConfig[] = [];
  let webhooksErro: string | null = null;
  if (cfg.ok) {
    try {
      webhooks = await listarWebhooks();
    } catch (err) {
      webhooksErro = mensagemErroAsaas(err);
    }
  }

  let query = supabaseAdmin
    .from('asaas_webhook_evento')
    .select('id, evento, recurso_tipo, recurso_id, payload, criado_asaas_em, recebido_em, status, tentativas, erro, processado_em', {
      count: 'exact',
    });
  if (q) query = query.or(`id.ilike.%${q}%,recurso_id.ilike.%${q}%,evento.ilike.%${q}%`);
  if (status) query = query.eq('status', status);

  const [{ data: eventos, count }, ...contagens] = await Promise.all([
    query.order('recebido_em', { ascending: false }).range((page - 1) * perPage, page * perPage - 1),
    ...STATUS.map((s) =>
      supabaseAdmin.from('asaas_webhook_evento').select('id', { count: 'exact', head: true }).eq('status', s),
    ),
  ]);
  const totaisPorStatus = Object.fromEntries(STATUS.map((s, i) => [s, contagens[i].count ?? 0])) as Record<
    AsaasWebhookEventoStatus,
    number
  >;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Financeiro · Integração Asaas</h1>
          <p className="text-sm text-slate-500">
            Conexão com o gateway, webhooks cadastrados na conta e fila de eventos recebidos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <ConexaoAsaasCard
          configurado={cfg.ok}
          erroConfig={cfg.ok ? null : cfg.erro}
          ambiente={cfg.ok ? cfg.config.ambiente : null}
          apiUrl={cfg.ok ? cfg.config.apiUrl : null}
          tokenWebhookConfigurado={tokenConfigurado}
        />
        <WebhooksAsaasCard
          habilitado={cfg.ok}
          webhooks={webhooks}
          erro={webhooksErro}
          urlSugerida={urlWebhookSugerida()}
          emailSugerido={user.email ?? ''}
          tokenWebhookConfigurado={tokenConfigurado}
        />
      </div>

      <EventosWebhookGrid
        eventos={(eventos ?? []) as EventoWebhookItem[]}
        total={count ?? 0}
        page={page}
        perPage={perPage}
        totaisPorStatus={totaisPorStatus}
      />
    </div>
  );
}
