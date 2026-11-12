import type { Metadata, Viewport } from "next";
import "./legacy.css";
import "./app.css";

export const metadata: Metadata = {
  title: "Roadmap by Dev",
  description: "Roadmap: one ranked backlog, dates forecast from capacity, dependencies and quarterly releases.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
