import type { DataTable } from "@/lib/a11y/table";
import { NOT_MEASURED } from "@/lib/viz/format";
import { cn } from "@/lib/utils";

/**
 * The tabular form of a widget's data.
 *
 * One component serving three jobs (PLAN §5.3): the screen-reader view of a chart, the
 * `micro`-variant fallback on a phone, and the assertion surface for tests — which is
 * why tests query `getByRole("table")` rather than poking at SVG paths.
 */
export function DataTableView({
  table,
  className,
  captionHidden = false,
  formatCell,
}: {
  table: DataTable;
  className?: string;
  /** Hide the caption visually while keeping it for assistive tech. */
  captionHidden?: boolean;
  formatCell?: (value: number, columnIndex: number) => string;
}) {
  return (
    <table className={cn("w-full border-collapse text-left text-sm tabular-nums", className)}>
      <caption
        className={cn(
          "text-muted-foreground pb-2 text-left text-xs",
          captionHidden &&
            "absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)] [clip:rect(0_0_0_0)]",
        )}
      >
        {table.caption}
      </caption>
      <thead>
        <tr>
          {table.columns.map((column, index) => (
            <th
              key={column}
              scope="col"
              className={cn(
                "text-muted-foreground border-border border-b py-1.5 pr-3 text-xs font-medium",
                index > 0 && "text-right",
              )}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={String(row[0])} className="border-border/60 border-b last:border-0">
            {row.map((cell, index) =>
              index === 0 ? (
                <th key={index} scope="row" className="py-1.5 pr-3 font-normal">
                  {cell === null ? NOT_MEASURED : String(cell)}
                </th>
              ) : (
                <td key={index} className="py-1.5 pr-3 text-right">
                  {/*
                    A missing cell says so. Rendering 0 or an empty cell would both be
                    read as a measurement that was taken (PLAN §12.3).
                  */}
                  {cell === null ? (
                    <span className="text-muted-foreground">
                      {NOT_MEASURED}
                      <span className="sr-only"> not measured</span>
                    </span>
                  ) : typeof cell === "number" && formatCell ? (
                    formatCell(cell, index)
                  ) : (
                    String(cell)
                  )}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
