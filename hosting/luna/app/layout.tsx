import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visiora Luna",
  description: "Ambientação por voz em português com análise Luna autorizada.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
