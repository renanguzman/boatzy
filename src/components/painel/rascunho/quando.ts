import { dataISONoFuso, formatarData, formatarHora } from '@/lib/datas';

/** "hoje às 14:32" / "ontem às 09:10" / "02/11 às 18:05" — horário de Brasília. */
export function quandoRascunho(ms: number): string {
  const d = new Date(ms);
  const dia = dataISONoFuso(d);
  const hora = formatarHora(d);
  if (dia === dataISONoFuso()) return `hoje às ${hora}`;
  if (dia === dataISONoFuso(new Date(Date.now() - 24 * 60 * 60 * 1000))) return `ontem às ${hora}`;
  return `${formatarData(d, { day: '2-digit', month: '2-digit' })} às ${hora}`;
}
