import { Tags } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminTiposPage() {
  return (
    <ModuloEmConstrucao
      titulo="Tipos de embarcação"
      descricao="Cadastro e organização dos tipos de embarcação."
      icon={Tags}
    />
  );
}
