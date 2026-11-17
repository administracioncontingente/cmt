import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AGSCH Polonia 2027 • Mini CRM Contingente',
  description:
    'Sistema de registro de participantes y control de cuotas para el 26° World Scout Jamboree Polonia 2027 - Asociación de Guías y Scouts de Chile',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
