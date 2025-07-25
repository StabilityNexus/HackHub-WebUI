import { use, Suspense } from 'react'
import OrganizerClient from './OrganizerClient'

interface OrganizerPageProps {
  params: Promise<{
    address: string
  }>
}

export default function OrganizerPage({ params }: OrganizerPageProps) {
  const { address } = use(params)
  
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient address={address} />
    </Suspense>
  )
} 