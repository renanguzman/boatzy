import { MapPin, Users, Anchor, Ruler, BedDouble, DoorOpen, Bath, LifeBuoy, BadgeCheck, Award, CheckCircle2 } from 'lucide-react';

export type EmbarcacaoInfo = {
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  comprimento: number | null;
  cabines: number | null;
  suites: number | null;
  banheiros: number | null;
  tripulacao: number | null;
  embarcacao_tipo: { nome: string } | null;
  embarcacao_categoria: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_comodidades: { comodidade: { nome: string } | null }[];
};

/**
 * Badges + título/localidade + descrição + specs + comodidades da embarcação.
 * Compartilhado entre `/embarcacoes/[id]` (detalhe com reserva direta) e
 * `/embarcacoes/[id]/roteiros` (roteiros da embarcação) — mesma "cara" nas
 * duas telas.
 */
export default function EmbarcacaoInfoSection({ embarcacao }: { embarcacao: EmbarcacaoInfo }) {
  const localidade = embarcacao.municipios
    ? embarcacao.municipios.estados
      ? `${embarcacao.municipios.nome}, ${embarcacao.municipios.estados.uf}`
      : embarcacao.municipios.nome
    : null;

  const specs: { icon: typeof Users; label: string; value: string }[] = [];
  if (embarcacao.capacidade) specs.push({ icon: Users, label: 'Capacidade', value: `${embarcacao.capacidade} pessoas` });
  if (embarcacao.comprimento) specs.push({ icon: Ruler, label: 'Comprimento', value: `${embarcacao.comprimento}m` });
  if (embarcacao.cabines) specs.push({ icon: DoorOpen, label: 'Cabines', value: String(embarcacao.cabines) });
  if (embarcacao.suites) specs.push({ icon: BedDouble, label: 'Suítes', value: String(embarcacao.suites) });
  if (embarcacao.banheiros) specs.push({ icon: Bath, label: 'Banheiros', value: String(embarcacao.banheiros) });
  if (embarcacao.tripulacao) specs.push({ icon: LifeBuoy, label: 'Tripulação', value: String(embarcacao.tripulacao) });

  return (
    <>
      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-full">
          <Award className="h-3 w-3" />
          Novo
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
          <BadgeCheck className="h-3 w-3" />
          Embarcação Verificada
        </span>
        {embarcacao.embarcacao_tipo && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1.5 rounded-full">
            <Anchor className="h-3 w-3" />
            {embarcacao.embarcacao_tipo.nome}
          </span>
        )}
        {embarcacao.embarcacao_categoria && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full">
            {embarcacao.embarcacao_categoria.nome}
          </span>
        )}
      </div>

      {/* Title & location */}
      <h1 className="text-3xl md:text-4xl font-bold text-[#0B2447] mb-2">
        {embarcacao.nome}
      </h1>
      {localidade && (
        <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-6">
          <MapPin className="h-4 w-4 shrink-0" />
          {localidade}
        </div>
      )}

      {/* Description */}
      {embarcacao.descricao && (
        <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-2xl">
          {embarcacao.descricao}
        </p>
      )}

      {/* Specs row */}
      {specs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-slate-100 mb-10">
          {specs.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[#0B3D91]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comodidades */}
      {embarcacao.embarcacao_comodidades.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-[#0B2447] mb-4">Comodidades a bordo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {embarcacao.embarcacao_comodidades.map((ec, i) =>
              ec.comodidade ? (
                <div
                  key={i}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/60"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-700 leading-tight">{ec.comodidade.nome}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </>
  );
}
