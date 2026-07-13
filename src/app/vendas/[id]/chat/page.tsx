import { notFound, redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import ChatBox, { type Mensagem } from '@/components/chat/ChatBox';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * Chat comprador ↔ vendedor a partir do anúncio de venda. Reutiliza a conversa
 * única gestor↔cliente (§21); o vínculo com o anúncio é o evento `conversou`
 * do funil. A primeira mensagem vem pré-preenchida citando o anúncio.
 */
export default async function ChatVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/vendas/${id}/chat`);

  // Anúncio publicamente visível (ativo + embarcação ativa).
  const { data } = await supabaseAdmin
    .from('anuncio_venda')
    .select('id, owner_id, preco, embarcacao ( nome, status )')
    .eq('id', id)
    .eq('status', 'ativo')
    .single();

  const emb = data?.embarcacao as unknown as { nome: string; status: string } | null;
  if (!data || emb?.status !== 'ativo') notFound();

  // Dono não conversa consigo mesmo (a CHECK de `conversa` também bloqueia).
  if (data.owner_id === user.id) redirect(`/vendas/${id}`);

  const { data: vendedor } = await supabaseAdmin
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', data.owner_id)
    .single();
  if (!vendedor) notFound();

  // Garante (idempotente) a conversa gestor ↔ cliente.
  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .upsert(
      { gestor_id: data.owner_id, cliente_id: user.id },
      { onConflict: 'gestor_id,cliente_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (!conversa) notFound();
  const conversaId = conversa.id;

  // Lead (estágio 5): abriu o chat a partir do anúncio — idempotente.
  const { error: evErro } = await supabaseAdmin
    .from('anuncio_venda_interacao')
    .insert({ anuncio_id: id, user_id: user.id, tipo: 'conversou' });
  if (evErro && evErro.code !== '23505') {
    console.error('[vendas] falha ao registrar evento conversou:', evErro);
  }

  // Ao abrir, zera as não lidas enviadas pelo vendedor (inline, sem revalidate).
  await supabaseAdmin
    .from('mensagem')
    .update({ lida_em: new Date().toISOString() })
    .eq('conversa_id', conversaId)
    .neq('remetente_id', user.id)
    .is('lida_em', null);

  const { data: mensagens } = await supabaseAdmin
    .from('mensagem')
    .select('id, remetente_id, conteudo, lida_em, created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true });

  // Mensagem contextual pré-preenchida apenas em conversa ainda vazia.
  const rascunhoInicial =
    (mensagens ?? []).length === 0
      ? `Olá! Tenho interesse na "${emb!.nome}" anunciada por ${brl.format(Number(data.preco))}. Podemos conversar?`
      : undefined;

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 min-h-0">
        <ChatBox
          conversaId={conversaId}
          meId={user.id}
          interlocutor={{ name: vendedor.name, email: vendedor.email, avatar_url: vendedor.avatar_url }}
          voltarHref={`/vendas/${id}`}
          voltarLabel="Voltar para o anúncio"
          mensagensIniciais={(mensagens ?? []) as Mensagem[]}
          rascunhoInicial={rascunhoInicial}
        />
      </div>
    </div>
  );
}
