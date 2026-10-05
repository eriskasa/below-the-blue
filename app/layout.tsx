import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { viewportFit: "cover" };

export const metadata: Metadata = {
  title: "Below the Blue",
  description: "A real-time three-dimensional study of a whale, light, and the ocean.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
