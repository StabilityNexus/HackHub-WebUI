export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  534351: '0x451b43037c2224493ace56865a87a9cb17540474',
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}

