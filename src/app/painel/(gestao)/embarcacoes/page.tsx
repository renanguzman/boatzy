import { auth } from '@clerk/nextjs/server';
import { Ship } from 'lucide-react';

export default async function EmbarcacoesPage() {
  await auth.protect();

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ship className="w-6 h-6 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Embarcações</h1>
            <p className="text-slate-500 mt-0.5 text-sm">Cadastre e gerencie suas embarcações.</p>
          </div>
        </div>
        <button
          disabled
          className="bg-cyan-500 text-white text-sm font-medium px-4 py-2 rounded-lg opacity-50 cursor-not-allowed"
        >
          + Nova embarcação
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <Ship className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium">Nenhuma embarcação cadastrada</p>
        <p className="text-slate-400 text-sm mt-1">Adicione sua primeira embarcação para começar.</p>
      </div>
    </div>
  );
}
