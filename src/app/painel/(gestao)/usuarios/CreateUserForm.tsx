'use client';

import { useActionState } from 'react';
import { createUser, type CreateUserState } from './actions';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const initialState: CreateUserState = { status: 'idle' };

export default function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'success' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {state.message}
        </div>
      )}
      {state.status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nome */}
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
            Nome completo <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="João da Silva"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>

        {/* E-mail */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
            E-mail <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="joao@exemplo.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>

        {/* Senha */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
            Senha <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>

        {/* CPF / CNPJ */}
        <div>
          <label htmlFor="cpf_cnpj" className="block text-sm font-medium text-slate-700 mb-1.5">
            CPF / CNPJ
          </label>
          <input
            id="cpf_cnpj"
            name="cpf_cnpj"
            type="text"
            placeholder="000.000.000-00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>

        {/* Data de nascimento */}
        <div>
          <label htmlFor="birthday" className="block text-sm font-medium text-slate-700 mb-1.5">
            Data de nascimento
          </label>
          <input
            id="birthday"
            name="birthday"
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1.5">
            Perfil <span className="text-red-500">*</span>
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue="gestor"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white"
          >
            <option value="gestor">Gestor</option>
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? 'Criando...' : 'Criar usuário'}
        </button>
      </div>
    </form>
  );
}
