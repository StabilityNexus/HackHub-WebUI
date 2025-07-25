import { Suspense } from 'react'
import OrganizerClient from './OrganizerClient'

export async function generateStaticParams() {
  return [{ address: "0xplaceholder" }]
}

// Allow runtime paths not defined in generateStaticParams
export const dynamicParams = true

export default async function OrganizerPage({
  params,
}: {
  params: { address: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const { address } = params
  
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <OrganizerClient address={address} />
    </Suspense>
  )
}