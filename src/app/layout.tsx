import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#001558',
};

export const metadata: Metadata = {
  title: 'Contingente AGSCH • Polonia 2027 | CRM de Gestión',
  description:
    'Plataforma oficial del Contingente de la Asociación de Guías y Scouts de Chile al 26° World Scout Jamboree Polonia 2027',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,300..900;1,6..12,300..900&family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#000c33] text-slate-100 font-sans selection:bg-[#FEB135] selection:text-[#001558]">
        {children}
      </body>
    </html>
  );
}
