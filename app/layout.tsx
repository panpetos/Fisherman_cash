import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fisherman Cash",
  description: "Fisherman cash application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
