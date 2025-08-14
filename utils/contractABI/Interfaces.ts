// TypeScript interfaces and ABIs for HackHub contracts

export interface IERC20Minimal {
  transfer: (to: string, amount: bigint) => Promise<boolean>;
  transferFrom: (from: string, to: string, amount: bigint) => Promise<boolean>;
  approve: (spender: string, amount: bigint) => Promise<boolean>;
  allowance: (owner: string, spender: string) => Promise<bigint>;
  balanceOf: (account: string) => Promise<bigint>;
}

export interface IHackHubFactory {
  hackathonConcluded: (hackathon: string) => Promise<void>;
  registerParticipant: (participant: string) => Promise<void>;
  registerJudge: (judge: string) => Promise<void>;
}

export interface IOwnable {
  owner: () => Promise<string>;
  transferOwnership?: (newOwner: string) => Promise<void>;
}

// ABI for IERC20Minimal interface
export const IERC20MinimalABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "account", type: "address", internalType: "address" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  }
] as const;

// ABI for IHackHubFactory interface
export const IHackHubFactoryABI = [
  {
    type: "function",
    name: "hackathonConcluded",
    inputs: [
      { name: "hackathon", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "registerParticipant",
    inputs: [
      { name: "participant", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "registerJudge",
    inputs: [
      { name: "judge", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

// ABI for Ownable contract
export const OwnableABI = [
  {
    type: "constructor",
    inputs: [
      { name: "initialOwner", type: "address", internalType: "address" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true, internalType: "address" },
      { name: "newOwner", type: "address", indexed: true, internalType: "address" }
    ],
    anonymous: false
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      { name: "account", type: "address", internalType: "address" }
    ]
  }
] as const;

// Combined ABI for contracts that inherit from Ownable
export const OwnableInterfaceABI = [
  ...OwnableABI,
  // Add other contract-specific functions here
] as const;

// Type definitions for contract interaction
export type ContractAddress = `0x${string}`;

export interface ContractConfig {
  address: ContractAddress;
  abi: readonly any[];
}

// Error types
export interface OwnableUnauthorizedAccountError {
  account: string;
}
