import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ARP · Gestão de Pregões e Saldos',
  description: 'Painel executivo de atas de registro de preços com dados da planilha, filtros, importação e relatórios.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className="dark"><body>{children}</body></html>;
}
