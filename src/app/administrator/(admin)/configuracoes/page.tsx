import { Settings } from 'lucide-react';
import ModuloEmConstrucao from '@/components/administrator/ModuloEmConstrucao';

export default function AdminConfiguracoesPage() {
  return (
    <ModuloEmConstrucao
      titulo="Configurações"
      descricao="Parâmetros gerais e demais ajustes da plataforma Boatzy."
      icon={Settings}
    />
  );
}
