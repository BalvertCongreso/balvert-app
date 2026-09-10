import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import PwaInstall from "@/components/PwaInstall";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BALVERT 2027 — Panel de gestión",
  description: "Panel de gestión del Congreso BALVERT 2027",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Balvert",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/pwa/apple-touch-icon.png",
  },
  other: {
    // Next.js solo genera "mobile-web-app-capable" (estándar nuevo); las
    // versiones de Safari/iOS anteriores a 17.4 solo reconocen la etiqueta
    // con el prefijo "apple-", así que se añade también a mano.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#5BB8E8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50">
        <PwaInstall />
        <Providers>{children}</Providers>
        <footer className="py-4 text-center text-xs text-zinc-400">
          Desarrollado por{" "}
          <a
            href="https://atrapaesared.es/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#5F1F32" }}
          >
            AtrapaEsaRed
          </a>
        </footer>
      </body>
    </html>
  );
}
