import { Megaphone } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminPublicidadePage() {
  return (
    <ModuloEmConstrucao
      titulo="Publicidade"
      descricao="Gestão dos espaços de publicidade exibidos na plataforma."
      icon={Megaphone}
    />
  );
}
