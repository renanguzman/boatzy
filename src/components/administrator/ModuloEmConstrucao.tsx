import Link from 'next/link';
import { ArrowLeft, Construction, type LucideIcon } from 'lucide-react';

interface Props {
  titulo: string;
  descricao: string;
  icon: LucideIcon;
}

/** Placeholder padrão dos módulos da administração ainda não implementados. */
export default function ModuloEmConstrucao({ titulo, descricao, icon: Icon }: Props) {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">{titulo}</h1>
          <p className="text-sm text-slate-500">{descricao}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <Construction className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-[#0B2447] mb-2">Módulo em construção</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Esta funcionalidade da administração ainda será implementada. A estrutura e o
          menu já estão prontos para recebê-la.
        </p>
        <Link
          href="/administrator"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
