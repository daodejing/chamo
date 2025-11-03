import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
export const revalidate = false;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chamo',
    short_name: 'Chamo',
    description:
      'Privacy-first family collaboration platform with end-to-end encryption.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [],
  };
}
