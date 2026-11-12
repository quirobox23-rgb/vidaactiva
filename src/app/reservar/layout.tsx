import type { Metadata } from 'next'

// Vista previa del enlace cuando se comparte por WhatsApp (logo + título).
export const metadata: Metadata = {
  metadataBase: new URL('https://vidaactiva-kappa.vercel.app'),
  title: "Vida Activa · Apunta't a les classes",
  description: "Toca les classes on vols venir i mira qui més s'hi apunta.",
  openGraph: {
    title: "Vida Activa · Apunta't a les classes",
    description: "Toca les classes on vols venir i mira qui més s'hi apunta.",
    images: [{ url: '/logopng.png', alt: 'Vida Activa' }],
    locale: 'ca_ES',
    type: 'website',
  },
}

export default function ReservarLayout({ children }: { children: React.ReactNode }) {
  return children
}
