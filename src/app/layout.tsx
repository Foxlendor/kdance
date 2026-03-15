import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Everlock DJ",
  description: "Auto DJ using Spotify",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
