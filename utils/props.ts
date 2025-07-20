export type vaultsProps = {
    coinName: string
    coinSymbol: string
    coinAddress: `0x${string}`
    creatorAddress: `0x${string}`
    treasuryAddress: `0x${string}`
    creatorFee: bigint
    treasuryFee: bigint
  }