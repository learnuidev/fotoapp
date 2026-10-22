'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { cn } from '@foto/ui';

/**
 * The code on the table, printed in dots.
 *
 * Drawn here, module by module, rather than by a component that fills in squares:
 * `qrcode-generator` produces the matrix (synchronously, in a few kilobytes) and this
 * file draws it — a circle for every dark module, and the three finder patterns as the
 * rounded ring-and-dot a stylised code is recognised by. SVG, so it stays sharp on a
 * projector and prints cleanly on a table card.
 *
 * The dressing is deliberately outside the modules, and the modules are deliberately
 * conservative for dots: they sit on a white panel with a real quiet zone, error
 * correction is `H` (a third of the code can be missing), each dot is a little under
 * half a module so the white gutters keep the grid legible, and the mark in the middle
 * is small. Fancy is the frame; the code still has to scan from across a room.
 */

/** The width of a finder pattern, in modules — three of these per code. */
const FINDER = 7;

/** Where the three finder patterns sit, as their top-left module. */
function finderOrigins(size: number): [number, number][] {
  return [
    [0, 0],
    [size - FINDER, 0],
    [0, size - FINDER],
  ];
}

/** Whether a module belongs to a finder pattern or its one-module separator. */
function isFinderArea(row: number, column: number, size: number): boolean {
  return finderOrigins(size).some(
    ([top, left]) =>
      row >= top - 1 && row <= top + FINDER && column >= left - 1 && column <= left + FINDER,
  );
}

interface Matrix {
  size: number;
  dark: boolean[][];
}

function buildMatrix(value: string): Matrix {
  // Version 0 lets the library pick the smallest code that fits; `H` is the error
  // correction level, and the reason the centre can carry a mark.
  const qr = qrcode(0, 'H');
  qr.addData(value);
  qr.make();

  const size = qr.getModuleCount();
  const dark: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    dark.push(Array.from({ length: size }, (_, column) => qr.isDark(row, column)));
  }
  return { size, dark };
}

export function QrCode({
  value,
  size = 220,
  className,
  label,
  mark = true,
  quiet = 3,
}: {
  value: string;
  size?: number;
  className?: string;
  /** A line under the code — the join code itself, or nothing at all. */
  label?: React.ReactNode;
  /** The ring-and-dot mark in the middle. Off for the smallest sizes. */
  mark?: boolean;
  /** The quiet zone, in modules. Real whitespace: scanners need it. */
  quiet?: number;
}) {
  const matrix = useMemo(() => buildMatrix(value), [value]);

  const total = matrix.size + quiet * 2;
  const module = size / total;
  const pad = Math.max(8, Math.round(module * quiet));

  return (
    <div
      className={cn(
        // Paper, a warm edge, and a lift — the card on the table.
        'relative inline-flex flex-col items-center gap-3 rounded-[1.75rem] bg-gradient-to-b from-white to-[#f4ede2] p-1 shadow-[0_18px_40px_-18px_rgba(70,40,10,0.45)] ring-1 ring-black/5',
        className,
      )}
    >
      {/* A gradient rim, drawn as a hairline so it reads as an edge and not a frame. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.75rem] p-[1.5px]"
        style={{
          background:
            'linear-gradient(140deg, rgba(246,211,101,0.9), rgba(240,128,128,0.55) 45%, rgba(167,139,250,0.6))',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      />

      <div className="relative rounded-[1.5rem] bg-white" style={{ padding: pad }}>
        <svg
          role="img"
          aria-label={`QR code for ${value}`}
          width={size}
          height={size}
          viewBox={`0 0 ${total} ${total}`}
          style={{ display: 'block' }}
          shapeRendering="geometricPrecision"
        >
          <rect width={total} height={total} fill="#ffffff" />

          {/* --- the data, as dots --------------------------------------------- */}
          <g fill="#171310">
            {matrix.dark.map((row, rowIndex) =>
              row.map((isDark, columnIndex) => {
                if (!isDark) return null;
                if (isFinderArea(rowIndex, columnIndex, matrix.size)) return null;
                return (
                  <circle
                    key={`${rowIndex}-${columnIndex}`}
                    cx={columnIndex + quiet + 0.5}
                    cy={rowIndex + quiet + 0.5}
                    r={0.46}
                  />
                );
              }),
            )}
          </g>

          {/* --- the three finder patterns, as ring and dot -------------------- */}
          <g fill="#171310">
            {finderOrigins(matrix.size).map(([top, left]) => {
              const x = left + quiet;
              const y = top + quiet;
              return (
                <g key={`${top}-${left}`}>
                  {/* The outer ring: the 7×7 square, drawn as a rounded frame. */}
                  <rect
                    x={x + 0.5}
                    y={y + 0.5}
                    width={FINDER - 1}
                    height={FINDER - 1}
                    rx={2.2}
                    ry={2.2}
                    fill="none"
                    stroke="#171310"
                    strokeWidth={1}
                  />
                  {/* The pupil: a 3×3 rounded dot in the middle. */}
                  <rect x={x + 2} y={y + 2} width={3} height={3} rx={1.2} ry={1.2} />
                </g>
              );
            })}
          </g>
        </svg>

        {mark && size >= 110 && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white"
            style={{ width: size * 0.2, height: size * 0.2, boxShadow: '0 0 0 4px #fff' }}
          >
            <span
              className="grid place-items-center rounded-full"
              style={{
                width: size * 0.16,
                height: size * 0.16,
                background: 'linear-gradient(140deg,#f6d365,#f08080 55%,#a78bfa)',
              }}
            >
              <span
                className="rounded-full bg-[#171310]"
                style={{ width: size * 0.055, height: size * 0.055 }}
              />
            </span>
          </span>
        )}
      </div>

      {label && (
        <span className="max-w-full truncate px-2 pb-1 text-center text-xs text-[#6b5a48]">
          {label}
        </span>
      )}
    </div>
  );
}
