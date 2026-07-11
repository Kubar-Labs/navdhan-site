import { cn } from "@/src/lib/utils/cn";

export interface LegalTableProps {
  caption?: string;
  headers: string[];
  rows: string[][];
  className?: string;
}

export function LegalTable({ caption, headers, rows, className }: LegalTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-nt-slate-200", className)}>
      <table className="w-full border-collapse text-left text-sm text-nt-slate-700">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-nt-cream">
            {headers.map((header, index) => (
              <th key={index} scope="col" className="px-4 py-3 font-semibold text-nt-slate-900">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn("border-t border-nt-slate-200", rowIndex % 2 === 1 && "bg-nt-cream/50")}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
