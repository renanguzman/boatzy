import { Percent } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminTaxasPage() {
  return (
    <ModuloEmConstrucao
      titulo="Taxas"
      descricao="Gestão das taxas gerais do sistema: percentual da plataforma e repasse ao gestor."
      icon={Percent}
    />
  );
}
