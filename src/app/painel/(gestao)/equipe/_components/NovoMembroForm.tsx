'use client';

import MembroForm from './MembroForm';

export default function NovoMembroForm({ embarcacoes }: { embarcacoes: { id: string; nome: string }[] }) {
  return <MembroForm embarcacoes={embarcacoes} />;
}
