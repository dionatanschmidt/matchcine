import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'MatchCine',
    short_name:       'MatchCine',
    description:      'O filme certo pro seu momento',
    start_url:        '/',
    display:          'standalone',
    background_color: '#13111C',
    theme_color:      '#13111C',
    orientation:      'portrait',
    icons: [
      {
        src:     '/api/pwa-icon?size=192',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/api/pwa-icon?size=512',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
