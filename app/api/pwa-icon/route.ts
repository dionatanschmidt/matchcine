import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createElement as h } from 'react';

export const runtime = 'edge';

export function GET(req: NextRequest) {
  const raw  = Number(req.nextUrl.searchParams.get('size') ?? '192');
  const size = [192, 512].includes(raw) ? raw : 192;
  const fs   = Math.round(size * 0.38);
  const r    = Math.round(size * 0.22);
  const ls   = `${-(size * 0.012).toFixed(1)}px`;

  return new ImageResponse(
    h('div', {
      style: {
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#13111C',
        borderRadius: r,
      },
    },
    h('span', {
      style: {
        color: '#FFB13C',
        fontSize: fs,
        fontWeight: 800,
        letterSpacing: ls,
        fontFamily: 'sans-serif',
      },
    }, 'MC')),
    { width: size, height: size }
  );
}
