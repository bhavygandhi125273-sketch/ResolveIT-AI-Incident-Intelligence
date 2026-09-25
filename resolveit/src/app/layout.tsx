import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResolveIT — IT incident intelligence",
  description: "A clearer way to report and resolve IT issues.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
