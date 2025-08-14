export const HackHubFactoryAddress: { [key: number]: `0x${string}` } = {
  // 534351: '0x3afd509838f06493d55ea63e0b0963b3d54955d9',
  534351: '0xf0fd31e412260b928b39efd6e2ea32e47e3b54b2',
}

export const getFactoryAddress = (chainId: number): `0x${string}` | undefined => {
  return HackHubFactoryAddress[chainId]
}

