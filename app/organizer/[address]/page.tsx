import { Suspense } from 'react'
import OrganizerClient from './OrganizerClient'

export async function generateStaticParams() {
  return [{ address: "0xplaceholder" }]
}

export default async function OrganizerPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient address={address} />
    </Suspense>
  )
}