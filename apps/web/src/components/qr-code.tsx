'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@foto/ui';

/**
 * The code on the table.
 *
 * Generated in the browser rather than on the server: it is three lines of work,
 * it needs no network round trip, and it means a host standing in a venue with a
 * dead laptop can still print a card from the browser's own cache.
 */
export function QrCode({
  value,
  size = 220,
  className,
  dark = '#0b0a09',
  light = '#f6efe4',
}: {
  value: string;
  size?: number;
  className?: string;
  dark?: string;
  light?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark, light },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, dark, light]);

  if (!dataUrl) {
    return (
      <div
        className={cn('animate-pulse rounded-2xl bg-muted/60', className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={cn('rounded-2xl', className)}
    />
  );
}
