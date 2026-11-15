import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forward Deployed",
  description: "Forward deployed engineering roles, and nothing else. Refreshed hourly from public job boards.",
};

export const viewport: Viewport = { themeColor: "#3d4340" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
