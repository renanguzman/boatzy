import { redirect } from 'next/navigation';

// O dashboard financeiro entra na Fase 4 (docs/planejamento-pagamentos-asaas.md §13).
// Até lá, o módulo abre direto na tela de integração.
export default function AdminFinanceiroPage() {
  redirect('/administrator/financeiro/integracao');
}
