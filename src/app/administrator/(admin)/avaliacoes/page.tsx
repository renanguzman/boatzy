import { Star } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminAvaliacoesPage() {
  return (
    <ModuloEmConstrucao
      titulo="Avaliações"
      descricao="Gestão de todas as avaliações do sistema, com possibilidade de exclusão."
      icon={Star}
    />
  );
}
