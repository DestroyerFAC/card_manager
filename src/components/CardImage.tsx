import { useState } from 'react';

interface CardImageProps {
  readonly src: string | null;
  readonly alt: string;
  readonly className?: string;
  readonly eager?: boolean;
}

/** Images are always remote (TCGdex CDN): the repository ships no official artwork. */
export function CardImage({ src, alt, className = '', eager = false }: CardImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex aspect-[63/88] items-center justify-center rounded-lg bg-panel-2 p-2 text-center text-xs text-slate-500 ${className}`}
      >
        Image indisponible
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
      }}
      className={`aspect-[63/88] w-full rounded-lg bg-panel-2 object-cover ${className}`}
    />
  );
}
