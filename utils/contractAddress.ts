export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  534351: '0x7ddde464666e0e70eefb74aeed99c303483206ee',
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}