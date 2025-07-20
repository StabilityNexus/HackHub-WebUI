// Mock data for hackathons based on contract structure
export interface Judge {
  address: string;
  name: string;
  tokensAllocated: number;
  tokensRemaining: number;
}

export interface Project {
  id: number;
  submitter: string;
  sourceCode: string;
  documentation: string;
  tokensReceived: number;
  estimatedPrize: number;
  prizeClaimed: boolean;
}

export interface HackathonData {
  id: number;
  contractAddress: string;
  hackathonName: string;
  description: string; // Not in contract, for UI
  startTime: number; // Unix timestamp
  endTime: number; // Unix timestamp  
  prizePool: string; // In ETH
  totalTokens: number;
  concluded: boolean;
  organizer: string; // Contract owner
  factory: string;
  image: string; // For UI
  tags: string[]; // For UI
  judges: Judge[];
  projects: Project[];
  projectCount: number;
  judgeCount: number;
}

export const featuredHackathons: HackathonData[] = [
  {
    id: 1,
    contractAddress: "0x1234567890123456789012345678901234567890",
    hackathonName: "DeFi Innovation Challenge 2024",
    description: "Build the next generation of decentralized finance applications",
    startTime: Math.floor(Date.now() / 1000) - 86400, // Started 1 day ago
    endTime: Math.floor(Date.now() / 1000) + 1296000, // Ends in 15 days
    prizePool: "50.0", // 50 ETH
    totalTokens: 1000,
    concluded: false,
    organizer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    factory: "0xfactoryfactoryfactoryfactoryfactoryfactory",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["DeFi", "Smart Contracts", "Ethereum"],
    judges: [
      {
        address: "0x1111111111111111111111111111111111111111",
        name: "Alice Cooper",
        tokensAllocated: 400,
        tokensRemaining: 320
      },
      {
        address: "0x2222222222222222222222222222222222222222", 
        name: "Bob Smith",
        tokensAllocated: 300,
        tokensRemaining: 150
      },
      {
        address: "0x3333333333333333333333333333333333333333",
        name: "Charlie Brown",
        tokensAllocated: 300,
        tokensRemaining: 280
      }
    ],
    projects: [
      {
        id: 0,
        submitter: "0x4444444444444444444444444444444444444444",
        sourceCode: "https://github.com/user1/defi-project",
        documentation: "A revolutionary DeFi lending protocol with automated yield optimization",
        tokensReceived: 230,
        estimatedPrize: 11.5,
        prizeClaimed: false
      },
      {
        id: 1,
        submitter: "0x5555555555555555555555555555555555555555",
        sourceCode: "https://github.com/user2/defi-swap",
        documentation: "Cross-chain DEX aggregator with minimal slippage",
        tokensReceived: 180,
        estimatedPrize: 9.0,
        prizeClaimed: false
      }
    ],
    projectCount: 2,
    judgeCount: 3
  },
  {
    id: 2,
    contractAddress: "0x2345678901234567890123456789012345678901",
    hackathonName: "NFT Marketplace Revolution",
    description: "Create innovative NFT marketplace solutions with cross-chain compatibility",
    startTime: Math.floor(Date.now() / 1000) - 172800, // Started 2 days ago
    endTime: Math.floor(Date.now() / 1000) + 691200, // Ends in 8 days
    prizePool: "30.0",
    totalTokens: 800,
    concluded: false,
    organizer: "0xbcdefabcdefabcdefabcdefabcdefabcdefabcde",
    factory: "0xfactoryfactoryfactoryfactoryfactoryfactory",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["NFT", "Marketplace", "Cross-chain"],
    judges: [
      {
        address: "0x6666666666666666666666666666666666666666",
        name: "Diana Prince",
        tokensAllocated: 400,
        tokensRemaining: 300
      },
      {
        address: "0x7777777777777777777777777777777777777777",
        name: "Eve Johnson",
        tokensAllocated: 400,
        tokensRemaining: 350
      }
    ],
    projects: [
      {
        id: 0,
        submitter: "0x8888888888888888888888888888888888888888",
        sourceCode: "https://github.com/user3/nft-marketplace",
        documentation: "Multi-chain NFT marketplace with gasless transactions",
        tokensReceived: 150,
        estimatedPrize: 5.625,
        prizeClaimed: false
      }
    ],
    projectCount: 1,
    judgeCount: 2
  },
  {
    id: 3,
    contractAddress: "0x3456789012345678901234567890123456789012",
    hackathonName: "Web3 Gaming Summit",
    description: "Develop blockchain-based gaming experiences that push boundaries",
    startTime: Math.floor(Date.now() / 1000) + 86400, // Starts in 1 day
    endTime: Math.floor(Date.now() / 1000) + 1900800, // Ends in 22 days
    prizePool: "75.0",
    totalTokens: 1200,
    concluded: false,
    organizer: "0xcdefabcdefabcdefabcdefabcdefabcdefabcdef",
    factory: "0xfactoryfactoryfactoryfactoryfactoryfactory",
    image: "/placeholder.svg?height=200&width=400",
    tags: ["Gaming", "Web3", "Metaverse"],
    judges: [
      {
        address: "0x9999999999999999999999999999999999999999",
        name: "Frank Miller",
        tokensAllocated: 600,
        tokensRemaining: 600
      },
      {
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Grace Lee",
        tokensAllocated: 600,
        tokensRemaining: 600
      }
    ],
    projects: [],
    projectCount: 0,
    judgeCount: 2
  }
]

export const stats = [
  { label: "Active Hackathons", value: "3", icon: "Rocket", color: "text-blue-500" },
  { label: "Total Judges", value: "7", icon: "Users", color: "text-green-500" },
  { label: "Prize Pool", value: "155 ETH", icon: "Coins", color: "text-yellow-500" },
  { label: "Projects Submitted", value: "3", icon: "Code", color: "text-purple-500" }
]

export const categories = [
  "DeFi",
  "NFT", 
  "Gaming",
  "DAO",
  "Infrastructure",
  "Social",
  "Climate",
  "Layer 2"
]

// Utility functions
export const getTimeRemaining = (endTime: number): number => {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, endTime - now);
}

export const getDaysRemaining = (endTime: number): number => {
  return Math.floor(getTimeRemaining(endTime) / 86400);
}

export const getHackathonStatus = (startTime: number, endTime: number, concluded: boolean): 'upcoming' | 'active' | 'ended' | 'concluded' => {
  if (concluded) return 'concluded';
  const now = Math.floor(Date.now() / 1000);
  if (now < startTime) return 'upcoming';
  if (now > endTime) return 'ended';
  return 'active';
} 