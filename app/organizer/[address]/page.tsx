import OrganizerClient from './OrganizerClient'

export default async function OrganizerAddressPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  return <OrganizerClient address={address} />
}