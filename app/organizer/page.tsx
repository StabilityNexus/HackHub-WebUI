"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import OrganizerClient from './[address]/OrganizerClient'

function OrganizerPageContent() {
  const searchParams = useSearchParams()
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    // Get address from URL hash or search params
    const addressFromHash = window.location.hash.replace('#', '')
    const addressFromParams = searchParams.get('address')
    
    if (addressFromHash && addressFromHash.match(/^0x[a-fA-F0-9]{40}$/)) {
      setAddress(addressFromHash)
    } else if (addressFromParams && addressFromParams.match(/^0x[a-fA-F0-9]{40}$/)) {
      setAddress(addressFromParams)
    }
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