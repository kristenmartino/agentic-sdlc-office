import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic SDLC Office",
  description: "A visual operating model for the Agentic Development Lifecycle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-office-bg text-office-text">{children}</body>
    </html>
  );
}
