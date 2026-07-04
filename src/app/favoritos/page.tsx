import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAvaliacoesResumoPorRoteiro } from '@/lib/avaliacoes';
import RoteiroCard, { type RoteiroCardData } from '../buscar/_components/RoteiroCard';
import RemoverFavoritoButton from './_components/RemoverFavoritoButton';

type FavoritoRow = {
  id: string;
  created_at: string;
  roteiro: (RoteiroCardData & { ativo: boolean }) | null;
};

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
       )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Roteiros desativados após o favorito não aparecem (mesma regra da busca).
  const favoritos = ((data ?? []) as unknown as FavoritoRow[]).filter(
    (f): f is FavoritoRow & { roteiro: NonNullable<FavoritoRow['roteiro']> } =>
      f.roteiro != null && f.roteiro.ativo,
  );

  // Média/total de avaliações por roteiro favoritado (exibida no card quando houver).
  const avaliacoesResumo = await getAvaliacoesResumoPorRoteiro(favoritos.map((f) => f.roteiro.id));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Favoritos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Os roteiros que você salvou para decidir com calma.
        </p>

        {favoritos.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Heart className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700">Você ainda não tem favoritos</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Toque em &quot;Favoritar&quot; na página de um roteiro para salvá-lo aqui.
            </p>
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Explorar roteiros
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {favoritos.map((f) => (
              <div key={f.id} className="space-y-2">
                <RoteiroCard
                  roteiro={f.roteiro}
                  initialFavorito
                  avaliacaoResumo={avaliacoesResumo.get(f.roteiro.id) ?? null}
                />
                <RemoverFavoritoButton roteiroId={f.roteiro.id} />
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
