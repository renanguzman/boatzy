'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TermoUsoStatus } from '@/types/supabase';
import { termoIdentificadorLabel } from '@/lib/termos/identificadores';
import { publicarTermo, arquivarTermo, excluirTermo, criarNovaVersao } from '../actions';
import ConfirmModal from './ConfirmModal';

export type TermoResumo = {
  id: string;
  identificador: string;
  versao: number;
  titulo: string;
  status: TermoUsoStatus;
};

type AcaoConfirmavel = 'publicar' | 'arquivar' | 'excluir';

/**
 * Ações de ciclo de vida de um termo (publicar, arquivar, excluir, nova versão),
 * com o modal de confirmação correspondente. Compartilhado entre o grid e a
 * tela de visualização para que as regras e os avisos sejam idênticos.
 */
export function useTermoAcoes({ aposExcluir }: { aposExcluir?: () => void } = {}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<{ acao: AcaoConfirmavel; termo: TermoResumo } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [novaVersaoId, setNovaVersaoId] = useState<string | null>(null);

  function confirmar(acao: AcaoConfirmavel, termo: TermoResumo) {
    setErro(null);
    setConfirmando({ acao, termo });
  }

  function executar() {
    if (!confirmando) return;
    const { acao, termo } = confirmando;
    startTransition(async () => {
      const fn = acao === 'publicar' ? publicarTermo : acao === 'arquivar' ? arquivarTermo : excluirTermo;
      const result = await fn(termo.id);
      if (!result.ok) {
        setErro(result.error ?? 'Erro inesperado.');
        return;
      }
      setConfirmando(null);
      if (acao === 'excluir' && aposExcluir) aposExcluir();
      else router.refresh();
    });
  }

  async function novaVersao(termo: TermoResumo) {
    if (novaVersaoId) return;
    setNovaVersaoId(termo.id);
    const result = await criarNovaVersao(termo.id);
    setNovaVersaoId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.push(`/administrator/termos/${result.termoId}/editar`);
  }

  let modal: React.ReactNode = null;
  if (confirmando) {
    const { acao, termo } = confirmando;
    const nome = `${termoIdentificadorLabel(termo.identificador)} — v${termo.versao}`;
    const props = { pending, erro, onConfirm: executar, onCancel: () => setConfirmando(null) };

    if (acao === 'publicar') {
      modal = (
        <ConfirmModal {...props} tom="publicar" titulo="Publicar esta versão?" confirmLabel="Publicar versão">
          <p>
            <strong>{nome}</strong> passará a ser o texto vigente e será exibido aos usuários a partir de agora.
          </p>
          <p>
            Após publicado, o texto <strong>não poderá mais ser editado</strong> — alterações futuras exigem uma
            nova versão. Se houver uma versão vigente deste termo, ela será arquivada automaticamente.
          </p>
        </ConfirmModal>
      );
    } else if (acao === 'arquivar') {
      modal = (
        <ConfirmModal {...props} tom="perigo" titulo="Retirar de vigência?" confirmLabel="Arquivar versão">
          <p>
            <strong>{nome}</strong> deixará de ser o texto vigente <strong>sem ser substituído</strong>.
          </p>
          <p>
            Os pontos do sistema que exigem este termo ficarão sem texto para aceite até que uma nova versão
            seja publicada. Para trocar o texto, prefira criar e publicar uma nova versão.
          </p>
        </ConfirmModal>
      );
    } else {
      modal = (
        <ConfirmModal {...props} tom="perigo" titulo="Excluir rascunho?" confirmLabel="Excluir">
          <p>
            O rascunho <strong>{nome}</strong> será excluído definitivamente. Esta ação não pode ser desfeita.
          </p>
        </ConfirmModal>
      );
    }
  }

  return { confirmar, novaVersao, novaVersaoId, modal };
}
