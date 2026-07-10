import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAvaliacoesResumoPorRoteiro, getAvaliacoesResumoPorEmbarcacao } from '@/lib/avaliacoes';
import RoteiroCard, { type RoteiroCardData } from '../buscar/_components/RoteiroCard';
import EmbarcacaoCard, { type EmbarcacaoCardData } from '@/components/ui/EmbarcacaoCard';
import RemoverFavoritoButton from './_components/RemoverFavoritoButton';

type EmbarcacaoFavoritaRow = {
  id: string;
  nome: string;
  preco_base: number | null;
  capacidade: number | null;
  status: string;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
};

type FavoritoRow = {
  id: string;
  created_at: string;
  roteiro: (RoteiroCardData & { ativo: boolean }) | null;
  embarcacao: EmbarcacaoFavoritaRow | null;
};

function toEmbarcacaoCardData(e: EmbarcacaoFavoritaRow): EmbarcacaoCardData {
  return {
    id: e.id,
    nome: e.nome,
    preco_base: e.preco_base,
    capacidade: e.capacidade,
    tipo: e.embarcacao_tipo?.nome ?? null,
    localidade: e.municipios
      ? e.municipios.estados
        ? `${e.municipios.nome}, ${e.municipios.estados.uf}`
        : e.municipios.nome
      : null,
    imagem:
      (e.embarcacao_imagens.find((i) => i.principal) ?? e.embarcacao_imagens[0])?.url_imagem ??
      null,
  };
}

export default async function FavoritosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/favoritos');

  const { data } = await supabaseAdmin
    .from('favorito')
    .select(
      `id, created_at,
       roteiro (
         id, nome, descricao, quantidade_pessoas, preco_base, duracao, ativo,
         municipios ( nome, estados ( uf ) ),
         roteiro_imagens ( url_imagem, principal ),
         embarcacao ( embarcacao_tipo ( nome ) )
       ),
       embarcacao (
         id, nome, preco_base, capacidade, status,
         embarcacao_tipo ( nome ),
         municipios ( nome, estados ( uf ) ),
         embarcacao_imagens ( url_imagem, principal )
       )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as FavoritoRow[];

  // Roteiros desativados após o favorito não aparecem (mesma regra da busca).
  const favoritosRoteiro = rows.filter(
    (f): f is FavoritoRow & { roteiro: NonNullable<FavoritoRow['roteiro']> } =>
      f.roteiro != null && f.roteiro.ativo,
  );

  // Embarcações fora do status 'ativo' também não aparecem.
  const favoritosEmbarcacao = rows.filter(
    (f): f is FavoritoRow & { embarcacao: NonNullable<FavoritoRow['embarcacao']> } =>
      f.embarcacao != null && f.embarcacao.status === 'ativo',
  );

  // Média/total de avaliações por item favoritado (exibida no card quando houver).
  const [avaliacoesRoteiro, avaliacoesEmbarcacao] = await Promise.all([
    getAvaliacoesResumoPorRoteiro(favoritosRoteiro.map((f) => f.roteiro.id)),
    getAvaliacoesResumoPorEmbarcacao(favoritosEmbarcacao.map((f) => f.embarcacao.id)),
  ]);

  const vazio = favoritosRoteiro.length === 0 && favoritosEmbarcacao.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Favoritos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Os roteiros e embarcações que você salvou para decidir com calma.
        </p>

        {vazio ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Heart className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700">Você ainda não tem favoritos</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Toque no coração de um roteiro ou de uma embarcação para salvá-los aqui.
            </p>
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Explorar roteiros
            </Link>
          </div>
        ) : (
          <>
            {favoritosRoteiro.length > 0 && (
              <section className="mt-6">
                {favoritosEmbarcacao.length > 0 && (
                  <h2 className="text-lg font-semibold text-[#0B2447] mb-4">Roteiros</h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {favoritosRoteiro.map((f) => (
                    <div key={f.id} className="space-y-2">
                      <RoteiroCard
                        roteiro={f.roteiro}
                        initialFavorito
                        avaliacaoResumo={avaliacoesRoteiro.get(f.roteiro.id) ?? null}
                      />
                      <RemoverFavoritoButton roteiroId={f.roteiro.id} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {favoritosEmbarcacao.length > 0 && (
              <section className="mt-8">
                {favoritosRoteiro.length > 0 && (
                  <h2 className="text-lg font-semibold text-[#0B2447] mb-4">Embarcações</h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {favoritosEmbarcacao.map((f) => (
                    <div key={f.id} className="space-y-2">
                      <EmbarcacaoCard
                        embarcacao={toEmbarcacaoCardData(f.embarcacao)}
                        initialFavorito
                        avaliacaoResumo={avaliacoesEmbarcacao.get(f.embarcacao.id) ?? null}
                      />
                      <RemoverFavoritoButton embarcacaoId={f.embarcacao.id} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
