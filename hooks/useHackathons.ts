'use client'

import { getCurrentUTCTimestamp } from '@/utils/timeUtils'

export interface Judge {
  address: string
  name: string
  tokensAllocated: number
  tokensRemaining: number
}

export interface Project {
  id: number
  submitter: string
  recipient: string // Prize recipient address
  name: string // Project name
  sourceCode: string
  docs: string // Documentation link
  tokensReceived: number
  estimatedPrize: number
  formattedPrize?: string // Formatted prize with currency symbol
  prizeClaimed: boolean
}

export interface HackathonData {
  id: number
  contractAddress: string
  hackathonName: string
  description?: string // Not from contract, for UI
  startDate: number // YYYYMMDD format
  startTime: number // Unix timestamp
  endDate: number // YYYYMMDD format
  endTime: number // Unix timestamp
  prizePool: string // In ETH
  totalTokens: number
  concluded: boolean
  organizer: string // Contract owner
  factory: string
  image?: string // For UI
  tags?: string[] // For UI
  judges: Judge[]
  projects: Project[]
  projectCount: number
  judgeCount: number
  isERC20Prize?: boolean // Whether prize is ERC20 token
  prizeTokenSymbol?: string // Token symbol (e.g., "USDC", "DAI")
}

// Utility functions
export const getTimeRemaining = (endTime: number): number => {
  const now = getCurrentUTCTimestamp()
  return Math.max(0, endTime - now)
}

export const getDaysRemaining = (endTime: number): number => {
  return Math.floor(getTimeRemaining(endTime) / 86400)
}

export const getHackathonStatus = (startTime: number, endTime: number, concluded: boolean): 'upcoming' | 'accepting-submissions' | 'judging-submissions' | 'concluded' => {
  if (concluded) return 'concluded'
  const now = getCurrentUTCTimestamp()
  if (now < startTime) return 'upcoming'
  if (now > endTime) return 'judging-submissions'
  return 'accepting-submissions'
} 