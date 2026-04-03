import { RootProvider } from 'fumadocs-ui/provider/next';
import Link from 'next/link';
import { LogoScramble } from '@/components/demo/logo-scramble';
import './global.css';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <Link href="/" className="fixed top-4 left-5 z-50 text-sm no-underline text-fd-foreground">
            <LogoScramble />
          </Link>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
