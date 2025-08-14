import OrganizerClient from './OrganizerClient'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ address: 'O' }]
}

export default async function OrganizerAddressPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient address={address} />
    </Suspense>
  )
}