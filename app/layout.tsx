import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Panorama — Turn Carousel Slides into One Full Image',
  description: 'Reconstruct seamless carousel images into a single full-resolution panorama directly in your browser.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
