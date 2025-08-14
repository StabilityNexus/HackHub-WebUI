export const SPONSORSHIP_LIB_ABI = [
  { "type": "error", "name": "TokenTransferFailed", "inputs": [] },
  { "type": "error", "name": "InvalidParams", "inputs": [] },
  { "type": "error", "name": "TokenNotApproved", "inputs": [] },
  { "type": "error", "name": "TokenAlreadySubmitted", "inputs": [] },
  {
    "type": "event",
    "name": "TokenSubmitted",
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": true, "internalType": "address", "name": "submitter", "type": "address" }
    ]
  },
  {
    "type": "event",
    "name": "TokenApproved",
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "minAmount", "type": "uint256" }
    ]
  },
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
    "name": "SponsorListed",
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "sponsor", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "nonpayable",
    "name": "submitToken",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "string", "name": "tokenName", "type": "string" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "stateMutability": "nonpayable",
    "name": "approveToken",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "minAmount", "type": "uint256" }
    ],
    "outputs": []
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
    "stateMutability": "payable",
    "name": "addOrganizerFunds",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
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
    "name": "getTokenMinAmount",
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
    "name": "getApprovedTokensList",
    "inputs": [],
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
    ]
  },
  {
    "type": "function",
    "stateMutability": "view",
    "name": "getSubmittedTokensList",
    "inputs": [],
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
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
    "name": "getTokenSubmission",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "outputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "address", "name": "submitter", "type": "address" },
      { "internalType": "bool", "name": "exists", "type": "bool" }
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
    "stateMutability": "view",
    "name": "isTokenApproved",
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ]
  }
] as const;


