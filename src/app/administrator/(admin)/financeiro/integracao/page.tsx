import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { lerAsaasConfig, lerTokenWebhook, urlWebhookSugerida } from '@/lib/asaas/config';
import { mensagemErroAsaas } from '@/lib/asaas/client';
import { listarWebhooks } from '@/lib/asaas/webhooks';
import { listarChavesPix } from '@/lib/asaas/pix';
import type { AsaasChavePix, AsaasWebhookConfig } from '@/lib/asaas/tipos';
import type { AsaasWebhookEventoStatus } from '@/types/supabase';
import FinanceiroAbas from '../_components/FinanceiroAbas';
import ConexaoAsaasCard from './_components/ConexaoAsaasCard';
import WebhooksAsaasCard from './_components/WebhooksAsaasCard';
import ChavesPixCard from './_components/ChavesPixCard';
import EventosWebhookGrid, { type EventoWebhookItem } from './_components/EventosWebhookGrid';
import ConexaoPagarmeCard from './_components/ConexaoPagarmeCard';
import { lerCredenciaisWebhook, lerPagarmeConfig, urlWebhookPagarmeSugerida } from '@/lib/pagarme/config';
import { getFormasPagamento } from '@/lib/financeiro/config';

const PAGE_SIZES = [10, 25, 50] as const;

const STATUS: AsaasWebhookEventoStatus[] = ['pendente', 'processando', 'processado', 'ignorado', 'erro'];

type SearchParams = { q?: string; status?: string; page?: string; per?: string; gateway?: string };

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
  // Aba: Asaas (Pix) ou Stone/Pagar.me (cartão) — SPEC §109.
  const gateway: 'asaas' | 'pagarme' = sp.gateway === 'pagarme' ? 'pagarme' : 'asaas';
  const tabela = gateway === 'pagarme' ? 'pagarme_webhook_evento' : 'asaas_webhook_evento';

  const cfg = lerAsaasConfig();
  const tokenConfigurado = !!lerTokenWebhook();

  let webhooks: AsaasWebhookConfig[] = [];
  let webhooksErro: string | null = null;
  let chavesPix: AsaasChavePix[] = [];
  let chavesPixErro: string | null = null;
  if (cfg.ok && gateway === 'asaas') {
    const [w, c] = await Promise.allSettled([listarWebhooks(), listarChavesPix()]);
    if (w.status === 'fulfilled') webhooks = w.value;
    else webhooksErro = mensagemErroAsaas(w.reason);
    if (c.status === 'fulfilled') chavesPix = c.value;
    else chavesPixErro = mensagemErroAsaas(c.reason);
  }

  let query = supabaseAdmin
    .from(tabela)
    .select(`id, evento, recurso_tipo, recurso_id, payload, ${gateway === 'pagarme' ? 'criado_asaas_em:criado_gateway_em' : 'criado_asaas_em'}, recebido_em, status, tentativas, erro, processado_em`, {
      count: 'exact',
    });
  if (q) query = query.or(`id.ilike.%${q}%,recurso_id.ilike.%${q}%,evento.ilike.%${q}%`);
  if (status) query = query.eq('status', status);

  const [{ data: eventos, count }, ...contagens] = await Promise.all([
    query.order('recebido_em', { ascending: false }).range((page - 1) * perPage, page * perPage - 1),
    ...STATUS.map((s) =>
      supabaseAdmin.from(tabela).select('id', { count: 'exact', head: true }).eq('status', s),
    ),
  ]);
  const totaisPorStatus = Object.fromEntries(STATUS.map((s, i) => [s, contagens[i].count ?? 0])) as Record<
    AsaasWebhookEventoStatus,
    number
  >;

  const cfgPagarme = lerPagarmeConfig();
  const cartaoNaPagarme = gateway === 'pagarme'
    ? (await getFormasPagamento()).some((f) => f.codigo === 'cartao_credito' && f.gateway === 'pagarme')
    : false;
  let dominio = 'boatzy.app';
  try {
    dominio = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://boatzy.app').host;
  } catch {
    // mantém o padrão
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Financeiro</h1>
          <p className="text-sm text-slate-500">
            Conexão com os gateways — Asaas (Pix) e Stone/Pagar.me (cartão) —, webhooks e fila de eventos recebidos.
          </p>
        </div>
      </div>

      <FinanceiroAbas ativa="integracao" />

      <div className="flex gap-2 mb-6">
        {([['asaas', 'Asaas · Pix'], ['pagarme', 'Stone / Pagar.me · Cartão']] as const).map(([g, rotulo]) => (
          <Link
            key={g}
            href={g === 'asaas' ? '?' : '?gateway=pagarme'}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              gateway === g ? 'bg-[#0B2447] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {gateway === 'pagarme' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <ConexaoPagarmeCard
            configurado={cfgPagarme.ok}
            erroConfig={cfgPagarme.ok ? null : cfgPagarme.erro}
            ambiente={cfgPagarme.ok ? cfgPagarme.config.ambiente : null}
            credenciaisWebhook={!!lerCredenciaisWebhook()}
            urlWebhook={urlWebhookPagarmeSugerida()}
            dominio={dominio}
            cartaoNaPagarme={cartaoNaPagarme}
          />
        </div>
      ) : (
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
        <ChavesPixCard habilitado={cfg.ok} chaves={chavesPix} erro={chavesPixErro} />
      </div>
      )}

      <EventosWebhookGrid
        eventos={(eventos ?? []) as unknown as EventoWebhookItem[]}
        total={count ?? 0}
        page={page}
        perPage={perPage}
        totaisPorStatus={totaisPorStatus}
        gateway={gateway}
      />
    </div>
  );
}
