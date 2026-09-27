'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle, CheckCircle, ChevronDown, ChevronUp, GripVertical, ImagePlus,
  Loader2, Star, Trash2, Undo2, Upload,
} from 'lucide-react';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';
import { TITULO_IMAGEM_MAX, ordenarImagens } from '@/lib/galeria';

// ─── Tipos e helpers ──────────────────────────────────────────────────────────

/**
 * Item da galeria em edição. A posição no array É a ordem da galeria.
 * - `id` presente → imagem já salva no banco;
 * - `file` presente → imagem nova, enviada no submit do formulário.
 */
export type GaleriaItem = {
  key: string;
  id?: string;
  url: string;
  file?: File;
  titulo: string;
  principal: boolean;
  status?: 'uploading' | 'done' | 'error';
};

let seq = 0;
function novaKey() {
  seq += 1;
  return `img-${Date.now().toString(36)}-${seq}`;
}

/** Imagens salvas (linhas de `*_imagens`) → itens do editor, na ordem da galeria. */
export function itensDeImagensSalvas(
  imgs: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem?: number | null }[],
): GaleriaItem[] {
  return garantirPrincipal(
    ordenarImagens(imgs).map(img => ({
      key: img.id, id: img.id, url: img.url_imagem,
      titulo: img.titulo ?? '', principal: img.principal,
    })),
  );
}

/** Sempre exatamente uma principal quando houver fotos (a primeira, se nenhuma). */
function garantirPrincipal(items: GaleriaItem[]): GaleriaItem[] {
  if (items.length === 0 || items.some(i => i.principal)) return items;
  return items.map((it, i) => ({ ...it, principal: i === 0 }));
}

// ─── Componente ───────────────────────────────────────────────────────────────

type Props = {
  items: GaleriaItem[];
  onChange: (items: GaleriaItem[]) => void;
  /** Bloqueia a edição (ex.: durante o envio do formulário). */
  disabled?: boolean;
  /** Mensagem para arquivos recusados (tamanho). */
  onError?: (msg: string) => void;
  /** Exemplo de título no placeholder ("Proa do iate", "Vista do mirante"…). */
  exemploTitulo?: string;
};

export default function GaleriaImagensEditor({
  items, onChange, disabled = false, onError, exemploTitulo = 'Proa do iate',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [removida, setRemovida] = useState<{ item: GaleriaItem; index: number } | null>(null);

  // O aviso "Foto removida · Desfazer" some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!removida) return;
    const t = setTimeout(() => setRemovida(null), 6000);
    return () => clearTimeout(t);
  }, [removida]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Arraste pela alça: sem atraso, só uma pequena tolerância para não
    // confundir com o toque nos botões.
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Mutações ────────────────────────────────────────────────────────────────

  function addFiles(files: FileList | File[]) {
    const imagens = Array.from(files).filter(f => f.type.startsWith('image/'));
    const aceitas = imagens.filter(f => f.size <= MAX_IMAGE_SIZE_BYTES);
    if (aceitas.length < imagens.length) onError?.(MAX_IMAGE_SIZE_ERROR);
    if (aceitas.length === 0) return;
    onChange(garantirPrincipal([
      ...items,
      ...aceitas.map(file => ({
        key: novaKey(), file, url: URL.createObjectURL(file), titulo: '', principal: false,
      })),
    ]));
  }

  function update(key: string, patch: Partial<GaleriaItem>) {
    onChange(items.map(it => (it.key === key ? { ...it, ...patch } : it)));
  }

  function setPrincipal(key: string) {
    onChange(items.map(it => ({ ...it, principal: it.key === key })));
  }

  function mover(index: number, delta: -1 | 1) {
    const alvo = index + delta;
    if (alvo < 0 || alvo >= items.length) return;
    onChange(arrayMove(items, index, alvo));
  }

  function remover(index: number) {
    const item = items[index];
    onChange(garantirPrincipal(items.filter((_, i) => i !== index)));
    setRemovida({ item, index });
  }

  function desfazerRemocao() {
    if (!removida) return;
    const { item, index } = removida;
    const next = [...items];
    next.splice(Math.min(index, next.length), 0, item);
    // Se a removida era a principal, ela volta a ser.
    onChange(item.principal ? next.map(it => ({ ...it, principal: it.key === item.key })) : next);
    setRemovida(null);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveKey(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveKey(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex(i => i.key === active.id);
    const to = items.findIndex(i => i.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  }

  const activeIndex = activeKey ? items.findIndex(i => i.key === activeKey) : -1;
  const compacto = items.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Área de envio */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={e => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); }
        }}
        className={`flex items-center justify-center rounded-xl border-2 border-dashed transition-colors
          ${compacto ? 'flex-row gap-3 px-4 py-4' : 'flex-col gap-3 p-8'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${dragging ? 'border-[#0B2447] bg-[#0B2447]/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}
      >
        {compacto
          ? <ImagePlus className="w-5 h-5 text-slate-400 shrink-0" />
          : <Upload className="w-8 h-8 text-slate-300" />}
        <div className={compacto ? 'text-left' : 'text-center'}>
          <p className="text-sm font-medium text-slate-600">
            {compacto ? 'Adicionar mais fotos — ' : 'Arraste as imagens ou '}
            <span className="text-[#0B3D91] underline">clique para selecionar</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">JPG, PNG ou WEBP • Máximo 20 MB por arquivo</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
          multiple className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* Lista ordenável */}
      {items.length > 0 && (
        <>
          <div className="mt-5 mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-xs font-semibold text-slate-600">
              {items.length} {items.length === 1 ? 'foto' : 'fotos'} · ordem da galeria
            </p>
            <p className="text-[11px] text-slate-400">
              Arraste pela alça <GripVertical className="inline w-3 h-3 -mt-0.5" /> ou use as setas para reordenar.
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveKey(null)}
            accessibility={{
              screenReaderInstructions: {
                draggable: 'Para reordenar, pressione espaço para pegar a foto, use as setas para mover e espaço de novo para soltar. Esc cancela.',
              },
              announcements: {
                onDragStart: ({ active }) => `Foto ${items.findIndex(i => i.key === active.id) + 1} selecionada.`,
                onDragOver: ({ over }) => (over ? `Sobre a posição ${items.findIndex(i => i.key === over.id) + 1}.` : ''),
                onDragEnd: ({ over }) => (over ? `Foto movida para a posição ${items.findIndex(i => i.key === over.id) + 1}.` : 'Movimento cancelado.'),
                onDragCancel: () => 'Movimento cancelado.',
              },
            }}
          >
            <SortableContext items={items.map(i => i.key)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2.5">
                {items.map((item, index) => (
                  <SortableRow
                    key={item.key}
                    item={item}
                    index={index}
                    total={items.length}
                    disabled={disabled}
                    exemploTitulo={exemploTitulo}
                    onTitulo={titulo => update(item.key, { titulo })}
                    onPrincipal={() => setPrincipal(item.key)}
                    onMover={delta => mover(index, delta)}
                    onRemover={() => remover(index)}
                  />
                ))}
              </ul>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
              {activeIndex >= 0 && (
                <RowView
                  item={items[activeIndex]}
                  index={activeIndex}
                  total={items.length}
                  disabled
                  overlay
                  exemploTitulo={exemploTitulo}
                />
              )}
            </DragOverlay>
          </DndContext>

          <p className="mt-3 text-xs text-slate-400">
            A ordem acima é a sequência das fotos na galeria do site, e o título aparece junto da foto.
            A <span className="font-semibold text-slate-500">principal</span> é a capa exibida nos cards e nas buscas.
          </p>
        </>
      )}

      {/* Desfazer remoção */}
      {removida && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white shadow-lg">
          <span>Foto removida{removida.item.id ? ' — será excluída ao salvar' : ''}.</span>
          <button type="button" onClick={desfazerRemocao}
            className="inline-flex items-center gap-1.5 font-semibold text-cyan-300 hover:text-cyan-200">
            <Undo2 className="w-4 h-4" /> Desfazer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Linha ────────────────────────────────────────────────────────────────────

type RowProps = {
  item: GaleriaItem;
  index: number;
  total: number;
  disabled: boolean;
  exemploTitulo: string;
  onTitulo?: (titulo: string) => void;
  onPrincipal?: () => void;
  onMover?: (delta: -1 | 1) => void;
  onRemover?: () => void;
};

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.item.key, disabled: props.disabled });

  return (
    <RowView
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      placeholder={isDragging}
      handleRef={setActivatorNodeRef}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
}

function RowView({
  item, index, total, disabled, exemploTitulo, onTitulo, onPrincipal, onMover, onRemover,
  rowRef, style, placeholder, overlay, handleRef, handleProps,
}: RowProps & {
  rowRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  placeholder?: boolean;
  overlay?: boolean;
  handleRef?: (el: HTMLElement | null) => void;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const Tag = overlay ? 'div' : 'li';
  const bloqueado = disabled || !!item.status;
  const iconBtn = `w-8 h-8 rounded-lg flex items-center justify-center transition
    text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed`;

  return (
    <Tag
      ref={rowRef}
      style={style}
      className={`flex items-stretch gap-2 sm:gap-3 rounded-xl border bg-white p-2 sm:p-2.5 transition-shadow
        ${item.principal ? 'border-[#0B2447]/40 ring-1 ring-[#0B2447]/10' : 'border-slate-200'}
        ${placeholder ? 'opacity-40' : ''}
        ${overlay ? 'shadow-xl ring-2 ring-[#0B2447]/20 cursor-grabbing' : ''}`}
    >
      {/* Alça de arraste */}
      <button
        type="button"
        ref={handleRef}
        {...handleProps}
        disabled={bloqueado}
        aria-label={`Arrastar foto ${index + 1} para reordenar`}
        className="touch-none shrink-0 flex items-center rounded-lg px-0.5 text-slate-300 hover:text-slate-500
          hover:bg-slate-50 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Miniatura */}
      <div className="relative shrink-0 w-20 h-20 sm:w-28 sm:h-[5.25rem] rounded-lg overflow-hidden bg-slate-100">
        <Image src={item.url} alt={item.titulo || `Foto ${index + 1}`} fill sizes="112px"
          className="object-cover" unoptimized draggable={false} />
        <span className="absolute top-1 left-1 min-w-5 h-5 px-1 rounded-md bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
          {index + 1}
        </span>
        {item.status === 'uploading' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
        {item.status === 'done' && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        )}
        {item.status === 'error' && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center" title="Falha no envio">
            <AlertCircle className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Título + principal/remover */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={item.titulo}
            maxLength={TITULO_IMAGEM_MAX}
            disabled={bloqueado}
            onChange={e => onTitulo?.(e.target.value)}
            placeholder={`Título da foto (ex.: ${exemploTitulo})`}
            aria-label={`Título da foto ${index + 1}`}
            className="peer w-full rounded-lg border border-slate-200 bg-white pl-3 pr-12 py-2 text-sm text-slate-800
              placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
              focus:border-[#0B2447]/40 transition disabled:bg-slate-50"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-slate-300
            opacity-0 peer-focus:opacity-100 transition-opacity">
            {item.titulo.length}/{TITULO_IMAGEM_MAX}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {item.principal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0B2447] px-2.5 py-1 text-[11px] font-semibold text-white">
              <Star className="w-3 h-3 fill-current" /> Principal
            </span>
          ) : (
            <button type="button" onClick={onPrincipal} disabled={bloqueado}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium
                text-slate-500 hover:border-[#0B2447]/40 hover:text-[#0B2447] transition disabled:opacity-50">
              <Star className="w-3 h-3" /> Tornar principal
            </button>
          )}
          <button type="button" onClick={onRemover} disabled={bloqueado}
            aria-label={`Remover foto ${index + 1}`} title="Remover foto"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50
              transition disabled:opacity-30 disabled:hover:bg-transparent">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subir / descer */}
      <div className="shrink-0 flex flex-col justify-center gap-1">
        <button type="button" onClick={() => onMover?.(-1)} disabled={bloqueado || index === 0}
          aria-label={`Mover foto ${index + 1} para cima`} title="Mover para cima" className={iconBtn}>
          <ChevronUp className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onMover?.(1)} disabled={bloqueado || index === total - 1}
          aria-label={`Mover foto ${index + 1} para baixo`} title="Mover para baixo" className={iconBtn}>
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </Tag>
  );
}
