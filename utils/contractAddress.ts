export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  534351: '0x5e9170895bd054a43db822b770dea36697090fd6', 
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}