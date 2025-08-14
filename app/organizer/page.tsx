"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import OrganizerClient from './[address]/OrganizerClient'

function OrganizerPageContent() {
  const searchParams = useSearchParams()
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    // Prefer address from query param; fallback to path segment; avoid stale hash issues
    const addressFromParams = searchParams.get('address')?.trim() || ''
    let next: string | null = null

    if (/^0x[a-fA-F0-9]{40}$/.test(addressFromParams)) {
      next = addressFromParams
    } else {
      // Try to read "/organizer/<address>" from pathname
      const parts = window.location.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex(p => p.toLowerCase() === 'organizer')
      if (idx >= 0 && parts[idx + 1] && /^0x[a-fA-F0-9]{40}$/.test(parts[idx + 1])) {
        next = parts[idx + 1]
      }
    }

    setAddress(next)
  }, [searchParams])

  if (!address) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Organizer Not Found</h1>
          <p className="text-muted-foreground">
            Please provide a valid organizer address in the URL.
          </p>
          <p className="text-sm text-muted-foreground">
            Use: /organizer?address=0x... or /organizer#0x...
          </p>
        </div>
      </div>
    )
  }

  return <OrganizerClient address={address} />
}

export default function OrganizerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerPageContent />
    </Suspense>
  )
} 