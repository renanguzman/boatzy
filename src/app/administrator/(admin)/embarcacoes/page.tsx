import { Ship } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminEmbarcacoesPage() {
  return (
    <ModuloEmConstrucao
      titulo="Embarcações"
      descricao="Gestão de todas as embarcações cadastradas na plataforma."
      icon={Ship}
    />
  );
}
