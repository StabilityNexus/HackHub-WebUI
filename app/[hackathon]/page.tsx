import InteractionClient from './InteractionClient'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ hackathon: 'h' }]
}

export default function HackathonPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <InteractionClient />
    </Suspense>
  )
}
