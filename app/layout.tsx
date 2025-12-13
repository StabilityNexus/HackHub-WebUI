import '@rainbow-me/rainbowkit/styles.css'
import type { Metadata } from 'next'
import './globals.css'
// import { ThemeProvider } from '@/components/theme-provider'
import { WalletProvider } from '@/providers/WalletProvider'
import Navigation from '@/components/navigation'

export const metadata: Metadata = {
  title: 'HackHub - Decentralized Hackathon Platform',
  description: 'A modern platform for Web3 hackathons with project submission and judging capabilities',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f9fafb]">
        <WalletProvider>
          {/* <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          > */}
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
              {children}
            </main>
          {/* </ThemeProvider> */}
        </WalletProvider>
      </body>
    </html>
  )
}
