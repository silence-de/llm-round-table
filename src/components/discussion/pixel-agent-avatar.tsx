'use client';

import { useState } from 'react';
import Image from 'next/image';

interface PixelAgentAvatarProps {
  seed: string;
  color: string;
  size?: number;
  label?: string;
  sprite?: string;
}

export function PixelAgentAvatar({
  seed,
  color,
  size = 56,
  label,
  sprite,
}: PixelAgentAvatarProps) {
  const [broken, setBroken] = useState(false);
  const imageSrc = !broken && sprite ? sprite : '/sprites/fallback.svg';

  return (
    <div className="inline-flex flex-col items-center gap-1.5" title={label ?? seed}>
      <div
        className="rt-surface-strong rounded-md border-2 p-1"
        style={{
          width: size + 10,
          height: size + 10,
          borderColor: `${color}66`,
          boxShadow: `2px 2px 0 ${color}33`,
        }}
      >
        <Image
          src={imageSrc}
          alt={label ?? seed}
          width={size}
          height={size}
          className="pixelated h-full w-full rounded-[4px]"
          draggable={false}
          style={{
            border: `1px solid ${color}33`,
            imageRendering: 'pixelated',
          }}
          onError={() => setBroken(true)}
          loading="lazy"
          unoptimized
        />
      </div>
      {label && (
        <span className="max-w-[84px] truncate text-[10px] font-semibold uppercase tracking-wide text-foreground/85">
          {label}
        </span>
      )}
    </div>
  );
}
