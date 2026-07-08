import { Tags } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminCategoriasPage() {
  return (
    <ModuloEmConstrucao
      titulo="Categorias"
      descricao="Cadastro e organização das categorias e tipos de embarcação."
      icon={Tags}
    />
  );
}
