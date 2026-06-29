import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Acopios Venezuela – Centros Verificados",
  description:
    "Centros de acopio subidos por ti y verificados por personas confiables. Mira qué reciben hoy, su horario y cuándo sale la ayuda.",
  openGraph: {
    title: "Centros de Acopios por Venezuela – Centros Verificados",
    description: "Centros de acopio verificados cerca de ti.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans text-stone-900 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
