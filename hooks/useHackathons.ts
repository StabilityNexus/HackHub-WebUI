'use client'

import { useState, useEffect } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { useChainId } from 'wagmi'
import { formatEther } from 'viem'
import { HACKHUB_FACTORY_ABI } from '@/utils/contractABI/HackHubFactory'
import { HACKHUB_ABI } from '@/utils/contractABI/HackHub'
import { getFactoryAddress } from '@/utils/contractAddress'

export interface Judge {
  address: string
  name: string
  tokensAllocated: number
  tokensRemaining: number
}

export interface Project {
  id: number
  submitter: string
  sourceCode: string
  documentation: string
  tokensReceived: number
  estimatedPrize: number
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
}

// Custom hook to fetch a single hackathon's data
export const useHackathon = (contractAddress: string) => {
  const [hackathonData, setHackathonData] = useState<HackathonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read basic hackathon info
  const { data: basicInfo, isLoading: basicLoading, error: basicError } = useReadContracts({
    contracts: [
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'hackathonName'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'startDate'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'startTime'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'endDate'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'endTime'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'prizePool'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'totalTokens'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'concluded'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'owner'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'factory'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'judgeCount'
      },
      {
        address: contractAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'projectCount'
      }
    ],
    query: {
      enabled: !!contractAddress
    }
  })

  const judgeCount = basicInfo?.[10]?.result as bigint
  const projectCount = basicInfo?.[11]?.result as bigint

  // Read judges data
  const judgeContracts = Array.from({ length: Number(judgeCount || BigInt(0)) }, (_, i) => [
    {
      address: contractAddress as `0x${string}`,
      abi: HACKHUB_ABI,
      functionName: 'judges',
      args: [BigInt(i)]
    },
    {
      address: contractAddress as `0x${string}`,
      abi: HACKHUB_ABI,
      functionName: 'judgeTokens',
      args: [basicInfo?.[0]?.result ? (basicInfo[0].result as any)[0] : '0x0']
    }
  ]).flat()

  const { data: judgesData } = useReadContracts({
    contracts: judgeContracts,
    query: {
      enabled: !!contractAddress && !!judgeCount && judgeCount > BigInt(0)
    }
  })

  // Read projects data
  const projectContracts = Array.from({ length: Number(projectCount || BigInt(0)) }, (_, i) => [
    {
      address: contractAddress as `0x${string}`,
      abi: HACKHUB_ABI,
      functionName: 'projects',
      args: [BigInt(i)]
    },
    {
      address: contractAddress as `0x${string}`,
      abi: HACKHUB_ABI,
      functionName: 'getProjectTokens',
      args: [BigInt(i)]
    },
    {
      address: contractAddress as `0x${string}`,
      abi: HACKHUB_ABI,
      functionName: 'prizeClaimed',
      args: [BigInt(i)]
    },
    {
      address: contractAddress as `0x${string}`,
      abi: HACKHUB_ABI,
      functionName: 'getProjectPrize',
      args: [BigInt(i)]
    }
  ]).flat()

  const { data: projectsData } = useReadContracts({
    contracts: projectContracts,
    query: {
      enabled: !!contractAddress && !!projectCount && projectCount > BigInt(0)
    }
  })

  useEffect(() => {
    if (!basicInfo || basicLoading) {
      setLoading(true)
      return
    }

    if (basicError) {
      setError('Failed to fetch hackathon data')
      setLoading(false)
      return
    }

    try {
      // Process judges data
      const judges: Judge[] = []
      if (judgesData && judgeCount && judgeCount > BigInt(0)) {
        for (let i = 0; i < Number(judgeCount); i++) {
          const judgeInfo = judgesData[i * 2]?.result as [string, string] | undefined
          const judgeTokens = judgesData[i * 2 + 1]?.result as bigint | undefined
          
          if (judgeInfo) {
            judges.push({
              address: judgeInfo[0],
              name: judgeInfo[1],
              tokensAllocated: Number(judgeTokens || BigInt(0)),
              tokensRemaining: Number(judgeTokens || BigInt(0)) // Will be updated with actual remaining
            })
          }
        }
      }

      // Process projects data
      const projects: Project[] = []
      if (projectsData && projectCount && projectCount > BigInt(0)) {
        for (let i = 0; i < Number(projectCount); i++) {
          const projectInfo = projectsData[i * 4]?.result as [string, string, string] | undefined
          const tokensReceived = projectsData[i * 4 + 1]?.result as bigint | undefined
          const prizeClaimed = projectsData[i * 4 + 2]?.result as boolean | undefined
          const estimatedPrize = projectsData[i * 4 + 3]?.result as bigint | undefined

          if (projectInfo) {
            projects.push({
              id: i,
              submitter: projectInfo[0],
              sourceCode: projectInfo[1],
              documentation: projectInfo[2],
              tokensReceived: Number(tokensReceived || BigInt(0)),
              estimatedPrize: parseFloat(formatEther(estimatedPrize || BigInt(0))),
              prizeClaimed: Boolean(prizeClaimed)
            })
          }
        }
      }

      const hackathon: HackathonData = {
        id: 0, // Will be set by parent component
        contractAddress,
        hackathonName: basicInfo[0]?.result as string || '',
        startDate: Number(basicInfo[1]?.result as bigint || BigInt(0)),
        startTime: Number(basicInfo[2]?.result as bigint || BigInt(0)),
        endDate: Number(basicInfo[3]?.result as bigint || BigInt(0)),
        endTime: Number(basicInfo[4]?.result as bigint || BigInt(0)),
        prizePool: formatEther(basicInfo[5]?.result as bigint || BigInt(0)),
        totalTokens: Number(basicInfo[6]?.result as bigint || BigInt(0)),
        concluded: Boolean(basicInfo[7]?.result),
        organizer: basicInfo[8]?.result as string || '',
        factory: basicInfo[9]?.result as string || '',
        judges,
        projects,
        projectCount: Number(projectCount || BigInt(0)),
        judgeCount: Number(judgeCount || BigInt(0)),
        description: `Web3 Hackathon with ${formatEther(basicInfo[5]?.result as bigint || BigInt(0))} ETH prize pool`,
        image: "/placeholder.svg?height=200&width=400",
        tags: ["Web3", "Blockchain"]
      }

      setHackathonData(hackathon)
      setError(null)
    } catch (err) {
      setError('Failed to process hackathon data')
      console.error('Error processing hackathon data:', err)
    } finally {
      setLoading(false)
    }
  }, [basicInfo, basicLoading, basicError, judgesData, projectsData, judgeCount, projectCount, contractAddress])

  return { hackathonData, loading, error }
}

// Main hook to fetch all hackathons
export const useHackathons = () => {
  const chainId = useChainId()
  const factoryAddress = getFactoryAddress(chainId)
  const [hackathons, setHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get ongoing and past hackathon counts
  const { data: ongoingCount, error: ongoingCountError } = useReadContract({
    address: factoryAddress as `0x${string}`,
    abi: HACKHUB_FACTORY_ABI,
    functionName: 'getOngoingCount',
    query: { enabled: !!factoryAddress }
  })

  const { data: pastCount, error: pastCountError } = useReadContract({
    address: factoryAddress as `0x${string}`,
    abi: HACKHUB_FACTORY_ABI,
    functionName: 'getPastCount',
    query: { enabled: !!factoryAddress }
  })

  // Get hackathon addresses
  const { data: ongoingAddresses, error: ongoingAddressesError } = useReadContract({
    address: factoryAddress as `0x${string}`,
    abi: HACKHUB_FACTORY_ABI,
    functionName: 'getOngoingHackathons',
    args: [BigInt(0), ongoingCount ? ongoingCount - BigInt(1) : BigInt(0)],
    query: { enabled: !!factoryAddress && !!ongoingCount && ongoingCount > BigInt(0) }
  })

  const { data: pastAddresses, error: pastAddressesError } = useReadContract({
    address: factoryAddress as `0x${string}`,
    abi: HACKHUB_FACTORY_ABI,
    functionName: 'getPastHackathons',
    args: [BigInt(0), pastCount ? pastCount - BigInt(1) : BigInt(0)],
    query: { enabled: !!factoryAddress && !!pastCount && pastCount > BigInt(0) }
  })

  useEffect(() => {
    // Add detailed error reporting
    console.log('useHackathons Debug Info:', {
      chainId,
      factoryAddress,
      ongoingCount: ongoingCount?.toString(),
      pastCount: pastCount?.toString(),
      ongoingAddresses,
      pastAddresses,
      errors: {
        ongoingCountError,
        pastCountError,
        ongoingAddressesError,
        pastAddressesError
      }
    })

    if (!factoryAddress) {
      setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
      setLoading(false)
      return
    }

    // Check for any contract call errors
    const contractErrors = [ongoingCountError, pastCountError, ongoingAddressesError, pastAddressesError].filter(Boolean)
    if (contractErrors.length > 0) {
      setError(`Failed to fetch hackathons: ${contractErrors[0]?.message || 'Contract call failed'}`)
      setLoading(false)
      return
    }

    const allAddresses = [
      ...(ongoingAddresses || []),
      ...(pastAddresses || [])
    ]

    console.log('All hackathon addresses found:', allAddresses)

    if (allAddresses.length === 0) {
      // Check if we've received the counts yet
      if (ongoingCount !== undefined && pastCount !== undefined) {
        setHackathons([])
        setError(null)
        setLoading(false)
        console.log('No hackathons found on the blockchain')
      }
      return
    }

    setLoading(false) // We'll show the addresses we have, individual hackathons will load separately
    setError(null)
    
    // Set empty hackathons with addresses - they'll be populated by individual useHackathon calls
    const emptyHackathons = allAddresses.map((address, index) => ({
      id: index,
      contractAddress: address,
      hackathonName: 'Loading...',
      startDate: 0,
      startTime: 0,
      endDate: 0,
      endTime: 0,
      prizePool: '0',
      totalTokens: 0,
      concluded: false,
      organizer: '',
      factory: '',
      judges: [],
      projects: [],
      projectCount: 0,
      judgeCount: 0
    }))
    
    console.log('Setting empty hackathons:', emptyHackathons)
    setHackathons(emptyHackathons)
  }, [chainId, factoryAddress, ongoingCount, pastCount, ongoingAddresses, pastAddresses, ongoingCountError, pastCountError, ongoingAddressesError, pastAddressesError])

  return { hackathons, loading, error, refetch: () => window.location.reload() }
}

// Utility functions
export const getTimeRemaining = (endTime: number): number => {
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, endTime - now)
}

export const getDaysRemaining = (endTime: number): number => {
  return Math.floor(getTimeRemaining(endTime) / 86400)
}

export const getHackathonStatus = (startTime: number, endTime: number, concluded: boolean): 'upcoming' | 'active' | 'ended' | 'concluded' => {
  if (concluded) return 'concluded'
  const now = Math.floor(Date.now() / 1000)
  if (now < startTime) return 'upcoming'
  if (now > endTime) return 'ended'
  return 'active'
} 