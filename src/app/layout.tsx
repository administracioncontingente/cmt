import type { Metadata, Viewport } from 'next';
import { Nunito_Sans } from 'next/font/google';
import { ToastProvider } from '@/components/ui/ToastProvider';
import './globals.css';

const nunitoSans = Nunito_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['200', '300', '400', '600', '700', '800', '900'],
  variable: '--font-nunito-sans',
  display: 'swap',
});

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
    <html lang="es" className={`${nunitoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F5F6F8] text-slate-800 font-sans selection:bg-[#FEB135] selection:text-[#001558]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
