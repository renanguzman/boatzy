import { redirect } from 'next/navigation';

// O dashboard financeiro entra na Fase 4 (docs/planejamento-pagamentos-asaas.md §13).
// Até lá, o módulo abre na fila de repasses (SPEC §101).
export default function AdminFinanceiroPage() {
  redirect('/administrator/financeiro/repasses');
}
