'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { AlertCircle, Camera, Check, CheckCircle, Loader2, Save, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import OperadorSecao from '@/components/operador/OperadorSecao';
import EnquadrarFoto from '@/components/painel/perfil/EnquadrarFoto';
import AssistenteDescricao from '@/components/painel/descricao/AssistenteDescricao';
import type { FatoDescricao } from '@/lib/descricao/assistente';
import { validarImagem } from '@/lib/galeria-upload';
import {
  FOTO_EXEMPLO, OPERADOR_LIMITES, completudePerfil, normalizarTextoPerfil, primeiroNome,
  type ErrosPerfil, type OperadorPublico,
} from '@/lib/operador-tipos';
import type { OperadorPerfilConteudo, OperadorPerfilStatus } from '@/types/supabase';
import { salvarPerfil } from '../actions';
import AvisoStatusPerfil from './AvisoStatusPerfil';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none aria-[invalid=true]:border-red-400';

type Valores = { nome: string; headline: string; bio: string; fotoUrl: string | null; consentimento: boolean };

type Props = {
  ownerId: string;
  nomeDaConta: string;
  desdeAno: number;
  status: OperadorPerfilStatus | null;
  versao: string | null;
  inicial: Valores;
  publicado: OperadorPerfilConteudo | null;
  enviadoEm: string | null;
  recado: string | null;
  fatos: FatoDescricao[];
  resumo: { media: number | null; totalAvaliacoes: number; experiencias: number; embarcacoes: number; passeiosRealizados: number };
};

const chaveDe = (v: Valores) =>
  JSON.stringify([v.nome.trim(), v.headline.trim(), normalizarTextoPerfil(v.bio), v.fotoUrl, v.consentimento]);

/** Mensagem que acompanha o gestor em cada etapa — incentiva sem inventar números. */
function mensagem(status: OperadorPerfilStatus | null, feitos: Record<string, boolean>, completo: boolean): { titulo: string; texto: string } {
  if (status === 'em_analise') return { titulo: 'Quase no ar!', texto: 'A equipe Boatzy já está com o seu perfil. Você pode continuar ajustando — ao salvar, ele é reenviado.' };
  if (status === 'aprovado') return { titulo: 'Perfil publicado', texto: 'Quando quiser mudar algo, edite aqui: a versão atual segue no ar até a nova ser aprovada.' };
  if (completo) return { titulo: 'Tudo pronto!', texto: 'Envie para a equipe Boatzy revisar. Depois de aprovado, o perfil aparece nos seus passeios.' };
  if (feitos.foto && !feitos.bio) return { titulo: 'Ótima foto!', texto: 'Rostos geram confiança. Agora conte um pouco da sua experiência no mar.' };
  if (feitos.nome && !feitos.foto && !feitos.bio) return { titulo: 'Bom começo!', texto: 'Falta a foto e a sua apresentação. Se preferir, deixe a IA escrever o texto com você.' };
  if (feitos.bio && !feitos.foto) return { titulo: 'Quase lá!', texto: 'Falta só uma foto sua — é ela que faz o cliente se sentir recebido.' };
  if (feitos.foto || feitos.nome || feitos.bio) return { titulo: 'Quase lá!', texto: 'Faltam poucos detalhes. Continue — leva só alguns minutos.' };
  return { titulo: 'Apresente-se!', texto: 'Sua história é o que faz o cliente escolher você. Uma foto e algumas linhas já bastam — e a IA ajuda a escrever.' };
}

export default function PerfilForm({
  ownerId, nomeDaConta, desdeAno, status: statusInicial, versao: versaoInicial, inicial, publicado, enviadoEm, recado, fatos, resumo,
}: Props) {
  const [nome, setNome] = useState(inicial.nome || nomeDaConta);
  const [headline, setHeadline] = useState(inicial.headline);
  const [bio, setBio] = useState(inicial.bio);
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial.fotoUrl);
  const [consentimento, setConsentimento] = useState(inicial.consentimento);

  const [status, setStatus] = useState(statusInicial);
  const [versao, setVersao] = useState(versaoInicial);
  const [salvo, setSalvo] = useState(chaveDe(inicial));
  const [erros, setErros] = useState<ErrosPerfil>({});
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const valores: Valores = { nome, headline, bio, fotoUrl, consentimento };
  const alterado = chaveDe(valores) !== salvo;
  const completude = completudePerfil(valores);
  const completo = completude.feitos === completude.total;
  const itens = Object.fromEntries(completude.itens.map((i) => [i.campo, i.ok]));
  const msg = mensagem(status, itens, completo);

  // O conteúdo (sem a autorização) é igual ao que está no ar? Então não há o que enviar.
  const igualAoPublicado = !!publicado
    && (publicado.nome_publico ?? '') === nome.trim()
    && (publicado.headline ?? '') === headline.trim()
    && (publicado.bio ?? '') === normalizarTextoPerfil(bio)
    && publicado.foto_url === fotoUrl;

  const podeEnviar = completo && !pendente && !enviandoFoto
    && (alterado || status === null || status === 'rascunho' || status === 'devolvido' || status === 'retirado')
    && !(status === 'aprovado' && igualAoPublicado)
    && !(status === 'em_analise' && !alterado);
  const podeSalvarRascunho = alterado && !pendente && !enviandoFoto && status !== 'em_analise';

  const previa = useMemo<OperadorPublico>(() => {
    const exibicao = nome.trim() || nomeDaConta || 'Seu nome';
    return {
      id: ownerId,
      nome: exibicao,
      primeiroNome: primeiroNome(exibicao),
      headline: headline.trim() || null,
      bio: normalizarTextoPerfil(bio) || 'A sua apresentação aparece aqui. Conte quem você é, há quanto tempo atua e como gosta de receber os clientes.',
      fotoUrl: fotoUrl ?? FOTO_EXEMPLO,
      desdeAno,
      media: resumo.media,
      totalAvaliacoes: resumo.totalAvaliacoes,
      experiencias: resumo.experiencias,
      embarcacoes: resumo.embarcacoes,
      passeiosRealizados: resumo.passeiosRealizados,
    };
  }, [nome, nomeDaConta, headline, bio, fotoUrl, ownerId, desdeAno, resumo]);

  async function escolherArquivo(file?: File) {
    if (inputFotoRef.current) inputFotoRef.current.value = '';
    if (!file) return;
    setErroFoto(null);
    const motivo = await validarImagem(file);
    if (motivo) { setErroFoto(`Não foi possível usar esta foto: ${motivo}`); return; }
    setArquivo(file);
  }

  async function enviarFoto(foto: { blob: Blob; extensao: 'webp' | 'jpg' }) {
    setArquivo(null);
    setEnviandoFoto(true);
    setErroFoto(null);
    try {
      const corpo = new FormData();
      corpo.append('file', new File([foto.blob], `perfil.${foto.extensao}`, { type: foto.blob.type }));
      const res = await fetch('/api/painel/perfil/upload', { method: 'POST', body: corpo });
      const json = (await res.json().catch(() => null)) as { publicUrl?: string; error?: string } | null;
      if (!res.ok || !json?.publicUrl) {
        setErroFoto(json?.error ?? 'Não foi possível enviar a foto agora. Tente novamente.');
        return;
      }
      setFotoUrl(json.publicUrl);
      setErros((e) => ({ ...e, foto: undefined }));
    } catch {
      setErroFoto('Sem conexão. Verifique a internet e tente de novo.');
    } finally {
      setEnviandoFoto(false);
    }
  }

  function salvar(enviar: boolean) {
    setFeedback(null);
    setErros({});
    iniciar(async () => {
      const r = await salvarPerfil({ nome, headline, bio, fotoUrl, consentimento, enviar, versao });
      if (!r.ok) {
        setErros(r.campos ?? {});
        setFeedback({ tipo: 'erro', texto: r.error });
        return;
      }
      const normalizado = { nome: nome.trim(), headline: headline.trim(), bio: normalizarTextoPerfil(bio), fotoUrl, consentimento };
      setNome(normalizado.nome);
      setHeadline(normalizado.headline);
      setBio(normalizado.bio);
      setSalvo(chaveDe(normalizado));
      setStatus(r.status);
      setVersao(r.atualizadoEm);
      setFeedback({
        tipo: 'ok',
        texto: r.enviado
          ? 'Perfil enviado para análise! Avisaremos por e-mail e aqui no painel assim que a equipe revisar.'
          : 'Rascunho salvo. Quando estiver pronto, envie para análise.',
      });
    });
  }

  const textoMax = OPERADOR_LIMITES.bio.max;
  const faltamNaBio = Math.max(0, OPERADOR_LIMITES.bio.min - normalizarTextoPerfil(bio).length);

  return (
    <div className="max-w-4xl space-y-5">
      <AvisoStatusPerfil
        status={status} enviadoEm={enviadoEm} recado={recado} ownerId={ownerId}
        alteracoesPendentes={alterado || (status === 'aprovado' && !igualAoPublicado)}
      />

      {/* Medidor + incentivo */}
      <section aria-label="Progresso do perfil" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50">
            <Sparkles className="h-5 w-5 text-teal-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#0B2447]">{msg.titulo}</p>
            <p className="mt-0.5 text-sm text-slate-600">{msg.texto}</p>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">{completude.percentual}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={completude.percentual} aria-label="Perfil preenchido">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0E2F4F] to-[#17B5B0] transition-all duration-500" style={{ width: `${completude.percentual}%` }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {completude.itens.map((i) => (
            <li key={i.campo} className={`flex items-center gap-1.5 text-xs ${i.ok ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
              {i.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-slate-300" />}
              {i.rotulo}
            </li>
          ))}
        </ul>
      </section>

      {feedback && (
        <div role={feedback.tipo === 'erro' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          }`}>
          {feedback.tipo === 'ok' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {feedback.texto}
        </div>
      )}

      {/* 1. Foto */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-700">1. Sua foto</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:w-32">
            <Image src={fotoUrl ?? FOTO_EXEMPLO} alt={fotoUrl ? 'Sua foto de perfil' : 'Exemplo de retrato'} fill sizes="128px"
              className="object-cover" unoptimized />
            {enviandoFoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => inputFotoRef.current?.click()} disabled={enviandoFoto}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2447] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91] disabled:opacity-50">
                <Camera className="h-4 w-4" /> {fotoUrl ? 'Trocar foto' : 'Enviar foto'}
              </button>
              {fotoUrl && (
                <button type="button" onClick={() => setFotoUrl(null)} disabled={enviandoFoto}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              )}
              <input ref={inputFotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => void escolherArquivo(e.target.files?.[0])} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Uma foto de rosto, com boa luz e sem óculos escuros, passa confiança. Você ajusta o enquadramento antes de enviar.
            </p>
            {(erroFoto || erros.foto) && <p role="alert" className="mt-2 text-xs text-red-600">{erroFoto ?? erros.foto}</p>}
          </div>
        </div>
      </section>

      {/* 2. Nome */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-700">2. Como quer ser chamado</h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="perfil-nome" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome de exibição <span className="text-red-500">*</span>
            </label>
            <input id="perfil-nome" className={inputCls} value={nome} maxLength={OPERADOR_LIMITES.nome.max}
              onChange={(e) => setNome(e.target.value)} aria-invalid={!!erros.nome}
              placeholder="Ex.: Jayme Fonseca ou Boat Rent" />
            <p className="mt-1 text-xs text-slate-500">É o nome que o cliente vê. Pode ser o seu nome ou o da sua empresa.</p>
            {erros.nome && <p role="alert" className="mt-1 text-xs text-red-600">{erros.nome}</p>}
          </div>
          <div>
            <label htmlFor="perfil-headline" className="mb-1.5 block text-sm font-medium text-slate-700">
              Frase de apresentação <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input id="perfil-headline" className={inputCls} value={headline} maxLength={OPERADOR_LIMITES.headline.max}
              onChange={(e) => setHeadline(e.target.value)} aria-invalid={!!erros.headline}
              placeholder="Ex.: Mestre amador há 20 anos na Lagoa da Conceição" />
            {erros.headline && <p role="alert" className="mt-1 text-xs text-red-600">{erros.headline}</p>}
          </div>
        </div>
      </section>

      {/* 3. Apresentação */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-700">3. Sobre você</h2>
        <p className="mt-1 text-xs text-slate-500">
          Conte quem você é, há quanto tempo atua, onde navega e como gosta de receber o cliente. Sem telefone, e-mail ou links — o contato acontece pelo chat do Boatzy.
        </p>
        <label htmlFor="perfil-bio" className="sr-only">Sua apresentação</label>
        <textarea id="perfil-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={8} maxLength={textoMax}
          aria-invalid={!!erros.bio} placeholder="Ex.: Sou mestre amador e navego na Lagoa da Conceição há mais de 20 anos…"
          className={`mt-3 ${inputCls} resize-y text-base leading-relaxed sm:text-sm`} />
        <div className="mt-1 flex items-start justify-between gap-3 text-xs">
          <span className={faltamNaBio > 0 ? 'text-slate-500' : 'font-semibold text-emerald-700'}>
            {faltamNaBio > 0 ? `Escreva mais ${faltamNaBio} caracteres para poder enviar` : 'Tamanho bom'}
          </span>
          <span className="tabular-nums text-slate-400">{normalizarTextoPerfil(bio).length} / {textoMax}</span>
        </div>
        {erros.bio && <p role="alert" className="mt-1 text-xs text-red-600">{erros.bio}</p>}
        <AssistenteDescricao
          alvo="operador"
          valorAtual={bio}
          fatos={[...(nome.trim() ? [{ rotulo: 'Nome', valor: nome.trim() }] : []), ...fatos.filter((f) => f.rotulo !== 'Nome')]}
          onAplicar={(texto) => { setBio(texto.slice(0, textoMax)); setErros((e) => ({ ...e, bio: undefined })); }}
        />
      </section>

      {/* 4. Autorização */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-700">4. Autorização</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-teal-600" aria-invalid={!!erros.consentimento} />
          <span className="text-sm text-slate-700">
            Autorizo o Boatzy a exibir publicamente o meu nome, a minha foto e o texto acima nas páginas dos meus passeios e embarcações.
            <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Nada é publicado antes da aprovação da equipe Boatzy. Você pode alterar ou pedir a retirada quando quiser.
            </span>
          </span>
        </label>
        {erros.consentimento && <p role="alert" className="mt-1 text-xs text-red-600">{erros.consentimento}</p>}
      </section>

      {/* Prévia */}
      <section aria-labelledby="perfil-previa" className="space-y-3">
        <div>
          <h2 id="perfil-previa" className="text-sm font-semibold text-slate-700">Como os clientes vão ver</h2>
          <p className="text-xs text-slate-500">É assim que o seu perfil aparece no fim das páginas dos seus passeios e embarcações.</p>
        </div>
        <OperadorSecao
          operador={previa}
          linkPerfil={false}
          acao={(
            <span className="inline-flex items-center justify-center rounded-xl bg-marinho px-5 py-3 text-sm font-semibold text-white opacity-90">
              Conversar com {previa.primeiroNome}
            </span>
          )}
        />
      </section>

      {/* Ações */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        {status !== 'em_analise' && (
          <button type="button" onClick={() => salvar(false)} disabled={!podeSalvarRascunho}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            {pendente && !podeEnviar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar rascunho
          </button>
        )}
        <button type="button" onClick={() => salvar(true)} disabled={!podeEnviar}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-40">
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'em_analise' ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {status === 'em_analise' ? 'Salvar e reenviar' : status === 'aprovado' ? 'Enviar alterações para análise' : 'Enviar para análise'}
        </button>
      </div>
      {!completo && (
        <p className="text-center text-xs text-slate-400 sm:text-right">
          Para enviar, falta: {completude.itens.filter((i) => !i.ok).map((i) => i.rotulo.toLowerCase()).join(', ')}.
        </p>
      )}

      {arquivo && <EnquadrarFoto arquivo={arquivo} onCancelar={() => setArquivo(null)} onConfirmar={(f) => void enviarFoto(f)} />}
    </div>
  );
}
