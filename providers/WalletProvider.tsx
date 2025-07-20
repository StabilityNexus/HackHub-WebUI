'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { config } from '@/utils/config'
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
  lightTheme,
  Chain,
} from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { useTheme } from 'next-themes'

const queryClient = new QueryClient()

export function WalletProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={mounted && theme === 'dark' ? darkTheme({
            accentColor: 'hsl(var(--primary))',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          }) : lightTheme({
            accentColor: 'hsl(var(--primary))',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}