import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NovoCatalogoForm from './_components/NovoCatalogoForm';

export default async function NovoCatalogoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Novo item no Catálogo</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cadastre um produto ou serviço disponível para oferta.
        </p>
      </div>

      <NovoCatalogoForm />
    </div>
  );
}
