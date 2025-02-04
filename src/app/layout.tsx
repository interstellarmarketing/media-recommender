import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ListsProvider } from '@/components/providers/ListsProvider';
import { Navigation } from "./components/Navigation";
import { Toaster } from '@/components/providers/ToastProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Media Recommender",
  description: "Your personal media recommendation app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
          <ListsProvider>
            <Navigation />
            {children}
            <Toaster />
          </ListsProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
} 