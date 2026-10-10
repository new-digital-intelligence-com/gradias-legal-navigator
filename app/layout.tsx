import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradias | Legal Navigator",
  description: "Explore the legal and regulatory requirements for AI-assisted exam grading with traceable evidence across Germany, the UK and the US.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
