import './globals.css'

export const metadata = {
  title: 'Vida Activa App',
  description: 'Reserva tus clases de entrenamiento',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased">{children}</body>
    </html>
  )
}
