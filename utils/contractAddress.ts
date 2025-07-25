export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  534351: '0x6a849b62070e1d059576a38153bb5058fb25276a',
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}