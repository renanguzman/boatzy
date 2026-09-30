import Link from 'next/link';
import { PlugZap, SlidersHorizontal } from 'lucide-react';

const ABAS = [
  { chave: 'integracao', href: '/administrator/financeiro/integracao', label: 'Integração', icon: PlugZap },
  { chave: 'configuracoes', href: '/administrator/financeiro/configuracoes', label: 'Configurações', icon: SlidersHorizontal },
] as const;

/** Abas do módulo Financeiro (novas telas entram aqui a cada fase — ver SPEC §34). */
export default function FinanceiroAbas({ ativa }: { ativa: (typeof ABAS)[number]['chave'] }) {
  return (
    <nav className="flex gap-1 border-b border-slate-200 mb-6">
      {ABAS.map(({ chave, href, label, icon: Icon }) => (
        <Link
          key={chave}
          href={href}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors ${
            chave === ativa
              ? 'border-[#0B2447] text-[#0B2447]'
              : 'border-transparent text-slate-400 hover:text-[#0B2447]'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
