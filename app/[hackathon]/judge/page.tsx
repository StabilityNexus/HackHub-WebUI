import JudgeVotingClient from './JudgeVotingClient'
import { Suspense } from 'react'

export async function generateStaticParams() {
  return [{ hackathon: 'h' }]
}

export default function JudgeVotingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <JudgeVotingClient />
    </Suspense>
  )
} 