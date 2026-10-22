import Link from 'next/link';
import { Users, UserCheck } from 'lucide-react';

const ABAS = [
  { chave: 'usuarios', href: '/administrator/usuarios', label: 'Usuários', icon: Users },
  { chave: 'solicitacoes', href: '/administrator/usuarios/solicitacoes', label: 'Pedidos de gestor', icon: UserCheck },
] as const;

/** Abas do módulo Usuários: lista de contas × fila de pedidos de acesso de gestor. */
export default function UsuariosAbas({ ativa, pendentes }: {
  ativa: (typeof ABAS)[number]['chave'];
  /** Pedidos de gestor aguardando decisão (contador na aba). */
  pendentes: number;
}) {
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
          {chave === 'solicitacoes' && pendentes > 0 && (
            <span className="min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
              {pendentes}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
