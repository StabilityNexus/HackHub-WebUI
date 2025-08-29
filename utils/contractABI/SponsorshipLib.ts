export const SPONSORSHIP_LIB_ABI = [
  { "type": "error", "name": "TokenTransferFailed", "inputs": [] },
  { "type": "error", "name": "InvalidParams", "inputs": [] },
  { "type": "error", "name": "SponsorNotFound", "inputs": [] },
  {
    "type": "event",
    "name": "SponsorDeposited",
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "sponsor", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ]
  },
  {
    "type": "event",
    "name": "SponsorBlocked",
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "sponsor", "type": "address" }
    ]
  },
  {
    "type": "event",
    "name": "SponsorUnblocked",
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "sponsor", "type": "address" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "payable",
    "name": "depositToToken",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "string", "name": "sponsorName", "type": "string" },
      { "internalType": "string", "name": "sponsorImageURL", "type": "string" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "stateMutability": "nonpayable",
    "name": "distributePrizes",
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "projectShare", "type": "uint256" },
      { "internalType": "uint256", "name": "totalTokens", "type": "uint256" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "getTokenTotal",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "getSponsorTokenAmount",
    "inputs": [
      { "internalType": "address", "name": "sponsor", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "getAllSponsors",
    "inputs": [],
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "getDepositedTokensList",
    "inputs": [],
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "getSponsorProfile",
    "inputs": [
      { "internalType": "address", "name": "sponsor", "type": "address" }
    ],
    "outputs": [
      { "internalType": "string", "name": "sponsorName", "type": "string" },
      { "internalType": "string", "name": "imageURL", "type": "string" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "nonpayable",
    "name": "blockSponsor",
    "inputs": [
      { "internalType": "address", "name": "sponsor", "type": "address" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "stateMutability": "nonpayable",
    "name": "unblockSponsor",
    "inputs": [
      { "internalType": "address", "name": "sponsor", "type": "address" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "isSponsorBlocked",
    "inputs": [
      { "internalType": "address", "name": "sponsor", "type": "address" }
    ],
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ]
  }
] as const;


