import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://axso.vercel.app"),
  title: {
    default: "Axso — Ta boutique en ligne en 3 minutes",
    template: "%s | Axso",
  },
  description:
    "Crée ta boutique en ligne en 3 minutes. 100% gratuit, 3% par vente seulement. Paiements Mobile Money, Orange Money, Wave, carte bancaire.",
  keywords: ["e-commerce", "boutique en ligne", "mobile money", "vendre en ligne", "axso"],
  openGraph: {
    title: "Axso — Ta boutique en ligne en 3 minutes",
    description: "Crée ta boutique en ligne, vends partout, encaisse facilement.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={poppins.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=Playfair+Display:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
