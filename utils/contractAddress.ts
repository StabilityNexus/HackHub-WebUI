export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  534351: '0xbb60427723ce7fdb4e9a57125e9a8f4dca3437f6',
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}

