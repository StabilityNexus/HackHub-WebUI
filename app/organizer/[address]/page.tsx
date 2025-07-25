import { Suspense } from 'react'
import OrganizerClient from './OrganizerClient'

export default function OrganizerPage() {
  
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient />
    </Suspense>
  )
}