import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

/**
 * Renderiza o conteúdo (Markdown) de um termo de uso com tipografia formal.
 * HTML cru dentro do Markdown é ignorado (padrão do react-markdown) — sem risco de XSS.
 * Usado na pré-visualização do admin e, nas próximas fases, na tela de aceite.
 */
const components: Components = {
  h1: ({ children }) => <h2 className="text-xl font-bold text-[#0B2447] mt-8 mb-3 first:mt-0">{children}</h2>,
  h2: ({ children }) => (
    <h3 className="text-base font-bold text-[#0B2447] mt-7 mb-2.5 pb-1.5 border-b border-slate-200 first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => <h4 className="text-sm font-bold text-[#0B2447] mt-5 mb-2 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="text-sm font-semibold text-slate-800 mt-4 mb-1.5">{children}</h5>,
  p: ({ children }) => <p className="text-sm leading-relaxed text-slate-700 mb-3 text-justify">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1 text-sm text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1 text-sm text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  // Citação = cláusula em destaque (CDC art. 54, §4º: cláusulas que limitam direitos devem se destacar).
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-4 border-amber-400 bg-amber-50 px-4 pt-3 pb-0.5 text-amber-950 [&_p]:text-amber-950">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#0B3D91] underline underline-offset-2">
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-slate-200" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm text-slate-700">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-slate-200 px-3 py-2 align-top">{children}</td>,
};

export default function TermoMarkdown({ conteudo, className }: { conteudo: string; className?: string }) {
  return (
    <div className={clsx('break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {conteudo}
      </ReactMarkdown>
    </div>
  );
}
