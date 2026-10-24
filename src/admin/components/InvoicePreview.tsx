import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildInvoiceSheet, columnPx, SheetCell, SheetStyle } from '../invoice/invoiceSheet';
import type { InvoiceData } from '../invoice/types';

// Excel points -> screen pixels (columns: columnPx, the same widths the row heights are worked out with)
const pointsPx = (points: number) => points * (4 / 3);

const BORDER_CSS: Record<string, string> = {
  hair: '1px solid #9ca3af',
  thin: '1px solid #000',
  dotted: '1px dotted #000',
  dashed: '1px dashed #000',
  medium: '2px solid #000',
  mediumDashed: '2px dashed #000',
  thick: '3px solid #000',
  double: '3px double #000'
};

const border = (style: SheetStyle, side: string) => {
  const edge = style.border?.[side];
  return edge ? BORDER_CSS[edge.style] ?? '1px solid #000' : 'none';
};

// Shows numbers the way the cell's Excel number format would
function formatValue(cell: SheetCell) {
  const { value } = cell;
  if (value === null) return '';
  if (typeof value !== 'number') return value;
  const format = (cell.style.numFmt ?? 'General').split(';')[0];
  if (format === 'General' || format === '@') return String(value);
  const decimals = format.includes('.') ? (format.split('.')[1].match(/0/g) ?? []).length : 0;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: format.includes(',')
  });
}

// The invoice as it will be printed, drawn from the same sheet as the .xlsx download
export function InvoicePreview({ invoice }: { invoice: InvoiceData }) {
  const sheet = useMemo(() => buildInvoiceSheet(invoice), [invoice]);
  const wrapper = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  const widths = sheet.columns.map(columnPx);
  const tableWidth = widths.reduce((a, b) => a + b, 0);

  // Merged ranges: the first cell spans them, the others are not drawn
  const { spans, covered } = useMemo(() => {
    const spans = new Map<string, [number, number, number, number]>();
    const covered = new Set<string>();
    for (const [r1, c1, r2, c2] of sheet.merges) {
      spans.set(`${r1}:${c1}`, [r1, c1, r2, c2]);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) covered.add(`${r}:${c}`);
      }
    }
    return { spans, covered };
  }, [sheet]);

  useLayoutEffect(() => {
    const update = () => {
      if (!wrapper.current || !table.current) return;
      const next = Math.min(1, wrapper.current.clientWidth / tableWidth);
      setScale(next);
      setHeight(table.current.offsetHeight * next);
    };
    update();
    const observer = new ResizeObserver(update);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [tableWidth, sheet]);

  return (
    <div ref={wrapper} className="w-full overflow-hidden" style={{ height }}>
      <table
        ref={table}
        style={{
          width: tableWidth,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#000',
          background: '#fff'
        }}
      >
        <colgroup>
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <tbody>
          {sheet.rows.map((row, r) => (
            <tr key={r} style={{ height: pointsPx(row.height) }}>
              {row.cells.map((cell, c) => {
                const key = `${r + 1}:${c + 1}`;
                if (covered.has(key)) return null;
                const span = spans.get(key);
                const lastRow = span ? span[2] - 1 : r;
                const lastCol = span ? span[3] - 1 : c;
                const { style } = cell;
                const wrap = Boolean(style.alignment.wrapText);
                return (
                  <td
                    key={key}
                    rowSpan={span ? span[2] - span[0] + 1 : undefined}
                    colSpan={span ? span[3] - span[1] + 1 : undefined}
                    style={{
                      padding: '0 2px',
                      borderLeft: border(style, 'left'),
                      borderTop: border(style, 'top'),
                      borderRight: border(sheet.rows[r].cells[lastCol].style, 'right'),
                      borderBottom: border(sheet.rows[lastRow].cells[c].style, 'bottom'),
                      fontSize: pointsPx(style.font.size),
                      fontWeight: style.font.bold ? 700 : 400,
                      fontStyle: style.font.italic ? 'italic' : 'normal',
                      textDecoration: style.font.underline ? 'underline' : undefined,
                      color: style.font.color ? `#${style.font.color.slice(2)}` : undefined,
                      background: style.fill ? `#${style.fill.slice(2)}` : undefined,
                      textAlign: (style.alignment.horizontal as 'left' | 'center' | 'right') ?? (typeof cell.value === 'number' ? 'right' : 'left'),
                      verticalAlign: style.alignment.vertical === 'top' ? 'top' : style.alignment.vertical === 'bottom' ? 'bottom' : 'middle',
                      whiteSpace: wrap ? 'pre-wrap' : 'pre',
                      // Column widths are close to Excel's, not exact: a one-line text may run a little over its cell
                      overflow: wrap ? 'hidden' : 'visible',
                      lineHeight: 1.15
                    }}
                  >
                    {formatValue(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
