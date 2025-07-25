import { Suspense } from 'react'
import OrganizerClient from './OrganizerClient'

interface OrganizerPageProps {
  params: {
    address: string
  }
}


export async function generateStaticParams() {
  return [{ address: "0xplaceholder" }]
}

export default function OrganizerPage({ params }: OrganizerPageProps) {
  const { address } = params
  
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient address={address} />
    </Suspense>
  )
} 