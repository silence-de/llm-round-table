'use client';

interface PixelAgentAvatarProps {
  seed: string;
  color: string;
  size?: number;
  label?: string;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function PixelAgentAvatar({
  seed,
  color,
  size = 56,
  label,
}: PixelAgentAvatarProps) {
  const n = hashSeed(seed);
  const grid = 8;
  const cell = Math.floor(size / grid);
  const pixels: boolean[][] = [];

  for (let y = 0; y < grid; y++) {
    pixels[y] = [];
    for (let x = 0; x < grid; x++) {
      // Mirror horizontal halves to get clean pixel-art identity
      const sx = x <= 3 ? x : 7 - x;
      const bit = ((n >> ((y * 4 + sx) % 24)) & 1) === 1;
      const border = y === 0 || y === 7 || x === 0 || x === 7;
      pixels[y][x] = border ? false : bit;
    }
  }

  // Add deterministic eyes/mouth for portrait feel.
  const eyeRow = 2 + (n % 2);
  pixels[eyeRow][2] = true;
  pixels[eyeRow][5] = true;
  pixels[5][3] = true;
  pixels[5][4] = true;

  return (
    <div className="inline-flex flex-col items-center gap-1.5" title={label ?? seed}>
      <div
        className="rounded-md border-2 border-black/70 bg-neutral-900 p-1 shadow-[3px_3px_0_rgba(0,0,0,0.55)]"
        style={{ width: size + 10, height: size + 10 }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${grid}, ${cell}px)`,
            gridTemplateRows: `repeat(${grid}, ${cell}px)`,
          }}
        >
          {pixels.flatMap((row, y) =>
            row.map((on, x) => (
              <span
                key={`${x}-${y}`}
                style={{
                  width: cell,
                  height: cell,
                  background: on ? color : 'transparent',
                }}
              />
            ))
          )}
        </div>
      </div>
      {label && (
        <span className="max-w-[78px] truncate text-[10px] font-semibold uppercase tracking-wide text-foreground/85">
          {label}
        </span>
      )}
    </div>
  );
}
