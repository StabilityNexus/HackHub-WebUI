export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  534351: '0x8b5f09679b9a09992eebc0a5d13dc955d9864cf8',
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}

