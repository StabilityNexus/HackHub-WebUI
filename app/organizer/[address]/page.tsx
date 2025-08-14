"use client"

import { Suspense } from 'react'
import OrganizerClient from './OrganizerClient'

export default function OrganizerAddressPage({ params }: { params: { address: string } }) {
  const { address } = params
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient address={address} />
    </Suspense>
  )
}