"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HackathonData, getHackathonStatus, getDaysRemaining } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
// import { formatEther } from "viem"
import { Trophy, Target, Calendar, Users, Vote, Gavel, Code, Coins, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { useChainId, useAccount, useWriteContract } from "wagmi"
import Link from "next/link"
import { toast } from "sonner"
import { hackathonDB } from "@/lib/indexedDB"
import { useRouter, useSearchParams } from "next/navigation"

// ERC20 ABI for token symbol
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const

type TabType = "participating" | "judging" | "organizing"

function MyHackathonsPageContent() {
  const [activeTab, setActiveTab] = useState<TabType>("participating")

  
  // Blockchain data state
  const [participatingHackathons, setParticipatingHackathons] = useState<HackathonData[]>([])
  const [judgingHackathons, setJudgingHackathons] = useState<HackathonData[]>([])
  const [organizingHackathons, setOrganizingHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination state for each tab
  const [participatingPage, setParticipatingPage] = useState(1)
  const [judgingPage, setJudgingPage] = useState(1)
  const [organizingPage, setOrganizingPage] = useState(1)
  const [participatingTotal, setParticipatingTotal] = useState(0)
  const [judgingTotal, setJudgingTotal] = useState(0)
  const [organizingTotal, setOrganizingTotal] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const ITEMS_PER_PAGE = 6
  
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  const { writeContract } = useWriteContract()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize tab and page from URL on mount
  useEffect(() => {
    const tabParam = (searchParams?.get('tab') as TabType) || "participating"
    const pageParam = Number(searchParams?.get('page') || '1')
    if (["participating","judging","organizing"].includes(tabParam)) {
      setActiveTab(tabParam)
    }
    if (!Number.isNaN(pageParam) && pageParam > 0) {
      if (tabParam === 'participating') setParticipatingPage(pageParam)
      if (tabParam === 'judging') setJudgingPage(pageParam)
      if (tabParam === 'organizing') setOrganizingPage(pageParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect tab/page to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString())
    params.set('tab', activeTab)
    params.set('page', String(getCurrentPage()))
    router.replace(`/myHackathons?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, participatingPage, judgingPage, organizingPage])

  // Claim state
  const [claimingPrizes, setClaimingPrizes] = useState<{[key: string]: boolean}>({})

  // Helper function to format prize amounts
  const formatPrizeAmount = (_hackathon: HackathonData) => 'Sponsored multi-token pool'

  // Handle claim prize
  const handleClaimPrize = async (hackathonAddress: string, projectId: number) => {
    if (!userAddress || !isConnected) {
      toast.error("Please connect your wallet to claim prize")
      return
    }

    const key = `${hackathonAddress}-${projectId}`
    
    try {
      setClaimingPrizes(prev => ({ ...prev, [key]: true }))
      
      await writeContract({
        address: hackathonAddress as `0x${string}`,
        abi: HACKHUB_ABI,
        functionName: 'claimPrize',
        args: [BigInt(projectId)],
      })

      toast.success("Prize claimed successfully!")
      
      // Refresh data after a delay
      setTimeout(() => {
        loadUserHackathons()
      }, 2000)
      
    } catch (err: any) {
      console.error('Error claiming prize:', err)
      toast.error(err?.message || "Failed to claim prize")
    } finally {
      setClaimingPrizes(prev => ({ ...prev, [key]: false }))
    }
  }

  // Network info
  const getNetworkName = (chainId: number) => {
    switch (chainId) {
      case 534351: return "Scroll Sepolia"
      case 84532: return "Base Sepolia"
      case 1: return "Ethereum Mainnet"
      case 137: return "Polygon"
      case 11155111: return "Sepolia"
      default: return `Unknown (${chainId})`
    }
  }

  // Fetch hackathon details from contract address
  const fetchHackathonDetails = async (addr: `0x${string}`, index: number): Promise<HackathonData | null> => {
    try {
      const publicClient = getPublicClient(config)
      
      const [
        name,
        startDate,
        startTime,
        endDate,
        endTime,
        totalTokens,
        concluded,
        organizer,
        factory,
        judgeCount,
        projectCount,
      ] = await Promise.all([
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
      ])

      // Load approved tokens and totals for payout breakdown
      let approvedTokens: string[] = []
      const tokenTotals: Record<string, bigint> = {}
      const tokenSymbols: Record<string, string> = {}
      try {
        approvedTokens = await publicClient.readContract({
          address: addr,
          abi: HACKHUB_ABI,
          functionName: 'getApprovedTokensList'
        }) as string[]
        for (const t of approvedTokens) {
          try {
            const total = await publicClient.readContract({
              address: addr,
              abi: HACKHUB_ABI,
              functionName: 'getTokenTotal',
              args: [t as `0x${string}`]
            }) as bigint
            tokenTotals[t] = total
          } catch {}
          try {
            if (t === '0x0000000000000000000000000000000000000000') {
              tokenSymbols[t] = 'ETH'
            } else {
              const sym = await publicClient.readContract({
                address: t as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'symbol'
              }) as string
              tokenSymbols[t] = sym
            }
          } catch {
            tokenSymbols[t] = t === '0x0000000000000000000000000000000000000000' ? 'ETH' : `${t.slice(0,6)}...${t.slice(-4)}`
          }
        }
      } catch {}

      // Fetch judges - prioritize current user's judge info
      const judges = []
      if (Number(judgeCount) > 0) {
        try {
          // First, check if current user is a judge and get their info
          if (userAddress) {
            try {
              const isUserJudge = await publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'isJudge',
                args: [userAddress as `0x${string}`]
              }) as boolean

              if (isUserJudge) {
                const [judgeTokens, remainingTokens] = await Promise.all([
                  publicClient.readContract({
                    address: addr,
                    abi: HACKHUB_ABI,
                    functionName: 'judgeTokens',
                    args: [userAddress as `0x${string}`]
                  }) as Promise<bigint>,
                  publicClient.readContract({
                    address: addr,
                    abi: HACKHUB_ABI,
                    functionName: 'remainingJudgeTokens',
                    args: [userAddress as `0x${string}`]
                  }) as Promise<bigint>
                ])

                judges.push({
                  address: userAddress,
                  name: 'You (Judge)',
                  tokensAllocated: Number(judgeTokens),
                  tokensRemaining: Number(remainingTokens)
                })
              }
            } catch (userJudgeError) {
              console.error('Error fetching current user judge info:', userJudgeError)
            }
          }

          // Then fetch other judges if needed (for display purposes)
          const judgeAddresses = await publicClient.readContract({ 
            address: addr, 
            abi: HACKHUB_ABI, 
            functionName: 'getAllJudges'
          }) as string[]

          for (let i = 0; i < judgeAddresses.length; i++) {
            // Skip if we already added this judge (current user)
            if (userAddress && judgeAddresses[i].toLowerCase() === userAddress.toLowerCase()) {
              continue
            }

            try {
              // Get judge tokens allocated
              const judgeTokens = await publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'judgeTokens',
                args: [judgeAddresses[i] as `0x${string}`]
              }) as bigint

              const remainingTokens = await publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'remainingJudgeTokens',
                args: [judgeAddresses[i] as `0x${string}`]
              }) as bigint

              judges.push({
                address: judgeAddresses[i],
                name: `Judge ${i + 1}`, // Use generic name since names are no longer stored
                tokensAllocated: Number(judgeTokens),
                tokensRemaining: Number(remainingTokens)
              })
            } catch (judgeError) {
              console.error(`Error fetching judge ${i} data:`, judgeError)
            }
          }
        } catch (judgeError) {
          console.error('Error fetching judges:', judgeError)
        }
      }

      // Fetch projects if user is a participant
      const projects = []
      if (Number(projectCount) > 0 && userAddress) {
        try {
          const userProjectId = await publicClient.readContract({
            address: addr,
            abi: HACKHUB_ABI,
            functionName: 'participantProjectId',
            args: [userAddress]
          }) as bigint

          if (userProjectId !== undefined) {
            const [projectInfo, projectTokens, prizeClaimed] = await Promise.all([
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'projects',
                args: [userProjectId]
              }) as Promise<[string, string, string, string, string]>, // [submitter, recipient, sourceCode, docs]
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'projectTokens',
                args: [userProjectId]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'prizeClaimed',
                args: [userProjectId]
              }) as Promise<boolean>
            ])

            const total = Number(totalTokens)
            const sharePercent = total > 0 ? (Number(projectTokens) / total) * 100 : 0
            const payouts = approvedTokens.map((t) => {
              const poolTotal = tokenTotals[t] ?? BigInt(0)
              const denom = totalTokens === BigInt(0) ? BigInt(1) : totalTokens
              const amount = (poolTotal * (projectTokens as bigint)) / denom
              return { token: t, amount: String(amount), symbol: tokenSymbols[t] }
            })

            projects.push({
              id: Number(userProjectId),
              submitter: projectInfo[0],
              recipient: projectInfo[1],
              name: projectInfo[2],
              sourceCode: projectInfo[3],
              docs: projectInfo[4],
              tokensReceived: Number(projectTokens),
              estimatedPrize: 0,
              formattedPrize: `${sharePercent.toFixed(2)}% of each token pool`,
              payouts,
              prizeClaimed
            })
          }
        } catch (projectError) {
          console.error('Error fetching user project:', projectError)
        }
      }

      const hackathon: HackathonData = {
        id: index,
        contractAddress: addr,
        hackathonName: name,
        startDate: Number(startDate),
        startTime: Number(startTime),
        endDate: Number(endDate),
        endTime: Number(endTime),
        prizePool: '0',
        totalTokens: Number(totalTokens),
        concluded,
        organizer,
        factory,
        judgeCount: Number(judgeCount),
        projectCount: Number(projectCount),
        judges,
        projects,
        description: `Web3 Hackathon with sponsored multi-token prize pool`,
        image: "/placeholder.svg?height=200&width=400",
        tags: ["Web3", "Blockchain"],
      }

      return hackathon
    } catch (err) {
      console.error(`Error fetching hackathon ${addr}:`, err)
      return null
    }
  }

  // Load user's hackathons with cache-first approach
  const loadUserHackathons = async (forceSync = false) => {
    if (!userAddress || !isConnected) {
      setError('Please connect your wallet to view your hackathons')
      setLoading(false)
      return
    }

    try {
      setLoading(!forceSync) // Don't show loading spinner if it's a sync
      if (forceSync) setSyncing(true)
      setError(null)

      // Try to load from cache first (unless force syncing)
      if (!forceSync) {
        const cachedData = await hackathonDB.getUserHackathons(userAddress, chainId)
        if (cachedData) {
          // Always hydrate totals immediately for correct pagination numbers
          setParticipatingTotal(cachedData.participatingTotal)
          setJudgingTotal(cachedData.judgingTotal)
          setOrganizingTotal(cachedData.organizingTotal)
          setLastSyncTime(new Date())

          // Prefer multi-page caches if present; fallback to legacy single-page fields
          const participatingFromCache = cachedData.participatingPages?.[participatingPage] || (cachedData.participatingPage === participatingPage ? cachedData.participating : undefined)
          const judgingFromCache = cachedData.judgingPages?.[judgingPage] || (cachedData.judgingPage === judgingPage ? cachedData.judging : undefined)
          const organizingFromCache = cachedData.organizingPages?.[organizingPage] || (cachedData.organizingPage === organizingPage ? cachedData.organizing : undefined)



          if (participatingFromCache) setParticipatingHackathons(participatingFromCache)
          if (judgingFromCache) setJudgingHackathons(judgingFromCache)
          if (organizingFromCache) setOrganizingHackathons(organizingFromCache)

          const hydratedActive = (
            (activeTab === 'participating' && !!participatingFromCache) ||
            (activeTab === 'judging' && !!judgingFromCache) ||
            (activeTab === 'organizing' && !!organizingFromCache)
          )
          if (hydratedActive) setLoading(false)
        }
      }

      // Fetch from blockchain
      await fetchUserDataFromBlockchain()
    } catch (err) {
      console.error('Error loading user hackathons:', err)
      setError('Failed to load hackathons from blockchain')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  // Fetch user's hackathons from blockchain with pagination
  const fetchUserDataFromBlockchain = async () => {
    if (!userAddress) return

    try {

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
        return
      }

      // Get user counts for pagination (participants only trusted; judges will be recomputed for robustness)
      const [participantOngoingCount, participantPastCount, judgeOngoingCount, judgePastCount] = await publicClient.readContract({
        address: factoryAddress,
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'getUserCounts',
        args: [userAddress]
      }) as [bigint, bigint, bigint, bigint]

      const participantTotal = Number(participantOngoingCount) + Number(participantPastCount)
      // Do NOT trust judge counts from factory; recompute from hackathons for correctness
      let judgeTotal = 0

      setParticipatingTotal(participantTotal)
      // judging total will be set after recomputation below

      // For organizing, we need to get all hackathons and filter by owner
      const [ongoingCount, pastCount] = await publicClient.readContract({
        address: factoryAddress,
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'getCounts',
      }) as [bigint, bigint]

      // Load participating hackathons with pagination
      let participatingAddresses: `0x${string}`[] = []
      if (participantTotal > 0) {
        const startIndex = (participatingPage - 1) * ITEMS_PER_PAGE
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE - 1, participantTotal - 1)
        
        // Get participant ongoing hackathons
        const participantOngoing = Number(participantOngoingCount)
        if (participantOngoing > 0 && startIndex < participantOngoing) {
          const ongoingStart = Math.max(0, startIndex)
          const ongoingEnd = Math.min(participantOngoing - 1, endIndex)
          
          const ongoingAddrs = await publicClient.readContract({
            address: factoryAddress,
            abi: HACKHUB_FACTORY_ABI,
            functionName: 'getParticipantHackathons',
            args: [userAddress, BigInt(ongoingStart), BigInt(ongoingEnd), true],
          }) as `0x${string}`[]
          participatingAddresses = participatingAddresses.concat(ongoingAddrs)
        }

        // Get participant past hackathons if needed
        const participantPast = Number(participantPastCount)
        if (participantPast > 0 && endIndex >= participantOngoing) {
          const pastStartIndex = Math.max(0, startIndex - participantOngoing)
          const pastEndIndex = Math.min(participantPast - 1, endIndex - participantOngoing)
          
          if (pastStartIndex <= pastEndIndex) {
            const pastAddrs = await publicClient.readContract({
              address: factoryAddress,
              abi: HACKHUB_FACTORY_ABI,
              functionName: 'getParticipantHackathons',
              args: [userAddress, BigInt(pastStartIndex), BigInt(pastEndIndex), false],
            }) as `0x${string}`[]
            participatingAddresses = participatingAddresses.concat(pastAddrs)
          }
        }
      }

      // Load organizing hackathons (filter all hackathons by owner) and prepare a full list for judge recompute
      let organizingAddresses: `0x${string}`[] = []
      const organizingStartIndex = (organizingPage - 1) * ITEMS_PER_PAGE
      
      // Get all hackathons and filter by owner - this is not optimal but necessary
      // since there's no direct contract function for organizer hackathons
      let allAddresses: `0x${string}`[] = []
      
      if (Number(ongoingCount) > 0) {
        const ongoingAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getHackathons',
          args: [BigInt(0), BigInt(Number(ongoingCount) - 1), true],
        }) as `0x${string}`[]
        allAddresses = allAddresses.concat(ongoingAddrs)
      }

      if (Number(pastCount) > 0) {
        const pastAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getHackathons',
          args: [BigInt(0), BigInt(Number(pastCount) - 1), false],
        }) as `0x${string}`[]
        allAddresses = allAddresses.concat(pastAddrs)
      }

      // Recompute judge hackathons by checking isJudge(user) on each hackathon
      let recomputedJudgeAddresses: `0x${string}`[] = []
      if (allAddresses.length > 0) {
        const judgeFlags = await Promise.all(
          allAddresses.map(async (addr) => {
            try {
              const isJ = await publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'isJudge',
                args: [userAddress as `0x${string}`]
              }) as boolean
              return isJ
            } catch {
              return false
            }
          })
        )
        recomputedJudgeAddresses = allAddresses.filter((_, i) => judgeFlags[i])
      }

      judgeTotal = recomputedJudgeAddresses.length
      setJudgingTotal(judgeTotal)

      // Apply pagination to recomputed judge hackathons
      let judgingAddresses: `0x${string}`[] = []
      if (judgeTotal > 0) {
        const judgingStartIndex = (judgingPage - 1) * ITEMS_PER_PAGE
        const judgingEndIndex = Math.min(judgingStartIndex + ITEMS_PER_PAGE, judgeTotal)
        judgingAddresses = recomputedJudgeAddresses.slice(judgingStartIndex, judgingEndIndex)
      }

      // Filter by organizer and apply pagination
      const filteredOrganizerAddresses: `0x${string}`[] = []
      for (const addr of allAddresses) {
        try {
          const owner = await publicClient.readContract({
            address: addr,
            abi: HACKHUB_ABI,
            functionName: 'owner'
          }) as string
          
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            filteredOrganizerAddresses.push(addr)
          }
        } catch (err) {
          console.error(`Error checking owner for ${addr}:`, err)
        }
      }

      setOrganizingTotal(filteredOrganizerAddresses.length)
      
      // Apply pagination to organizing hackathons
      const organizingEndIndex = Math.min(organizingStartIndex + ITEMS_PER_PAGE, filteredOrganizerAddresses.length)
      organizingAddresses = filteredOrganizerAddresses.slice(organizingStartIndex, organizingEndIndex)

      // Fetch detailed data for hackathons
      const [participatingData, judgingData, organizingData] = await Promise.all([
        Promise.all(participatingAddresses.map((addr, index) => fetchHackathonDetails(addr, index))),
        Promise.all(judgingAddresses.map((addr, index) => fetchHackathonDetails(addr, index))),
        Promise.all(organizingAddresses.map((addr, index) => fetchHackathonDetails(addr, index)))
      ])

      const participatingFiltered = participatingData.filter((h): h is HackathonData => h !== null)
      const judgingFiltered = judgingData.filter((h): h is HackathonData => h !== null)
      const organizingFiltered = organizingData.filter((h): h is HackathonData => h !== null)

      setParticipatingHackathons(participatingFiltered)
      setJudgingHackathons(judgingFiltered)
      setOrganizingHackathons(organizingFiltered)
      setLastSyncTime(new Date())

      // Update cache: merge into multi-page stores for smooth client-side paging
      const existingCache = await hackathonDB.getUserHackathons(userAddress, chainId)
      const participatingPages = { ...(existingCache?.participatingPages || {}), [participatingPage]: participatingFiltered }
      const judgingPages = { ...(existingCache?.judgingPages || {}), [judgingPage]: judgingFiltered }
      const organizingPages = { ...(existingCache?.organizingPages || {}), [organizingPage]: organizingFiltered }

      await hackathonDB.setUserHackathons(userAddress, chainId, {
        participating: participatingFiltered,
        judging: judgingFiltered,
        organizing: organizingFiltered,
        participatingPages,
        judgingPages,
        organizingPages,
        participatingPage,
        judgingPage,
        organizingPage,
        participatingTotal,
        judgingTotal,
        organizingTotal
      })

    } catch (err) {
      console.error('Error loading user hackathons from blockchain:', err)
      throw err // Re-throw to be caught by loadUserHackathons
    }
  }

  // Handle sync button click
  const handleSync = () => {
    loadUserHackathons(true)
  }

  // Load data on mount and when user/network/page changes
  useEffect(() => {
    loadUserHackathons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, chainId, participatingPage, judgingPage, organizingPage])

  // Reset page to 1 when tab changes
  useEffect(() => {
    if (activeTab === 'participating') setParticipatingPage(1)
    if (activeTab === 'judging') setJudgingPage(1)
    if (activeTab === 'organizing') setOrganizingPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Helper functions for pagination
  const getCurrentPage = () => {
    switch (activeTab) {
      case "participating": return participatingPage
      case "judging": return judgingPage
      case "organizing": return organizingPage
      default: return 1
    }
  }

  const getCurrentTotal = () => {
    switch (activeTab) {
      case "participating": return participatingTotal
      case "judging": return judgingTotal
      case "organizing": return organizingTotal
      default: return 0
    }
  }

  const setCurrentPage = (page: number) => {
    switch (activeTab) {
      case "participating": setParticipatingPage(page); break
      case "judging": setJudgingPage(page); break
      case "organizing": setOrganizingPage(page); break
    }
  }

  // Get current data based on active tab
  const getCurrentHackathons = () => {
    switch (activeTab) {
      case "participating": return participatingHackathons
      case "judging": return judgingHackathons
      case "organizing": return organizingHackathons
      default: return []
    }
  }

  // Note: Backend already handles pagination, so we don't need to slice again
  // The hackathons arrays already contain the correct items for the current page

  const renderParticipatingCard = (hackathon: HackathonData) => {
    const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
    const userProject = hackathon.projects.find(p => 
      p.submitter.toLowerCase() === (userAddress || '').toLowerCase()
    )

    if (!userProject) return null

    return (
      <Card key={hackathon.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-gray-800">{hackathon.hackathonName}</h3>
                <p className="text-muted-foreground text-sm text-gray-600">{hackathon.description}</p>
              </div>
              <Badge className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                Participating
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#8B6914]" />
                <span className="font-semibold text-[#8B6914]">{formatPrizeAmount(hackathon)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">{userProject.tokensReceived} votes</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">
                  {userProject.formattedPrize ? userProject.formattedPrize : `${userProject.estimatedPrize.toFixed(4)} ${hackathon.prizeTokenSymbol || 'ETH'}`} estimated
                </span>
              </div>
              <div className="flex items-center gap-2">
                {userProject.prizeClaimed ? (
                  <CheckCircle className="w-4 h-4 text-[#8B6914]" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-600">
                  {userProject.prizeClaimed ? "Prize claimed" : "Prize pending"}
                </span>
              </div>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg border">
              <p className="text-sm font-semibold mb-1 text-gray-800">Your Project #{userProject.id}</p>
              <p className="text-sm text-gray-600">{userProject.docs}</p>
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">
                  {status === 'accepting-submissions' ? `${getDaysRemaining(hackathon.endTime)} days left` : 
                   status === 'upcoming' ? 'Not started' : 
                   status === 'judging-submissions' ? 'Judging Submissions' : 'Concluded'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {!userProject.prizeClaimed && hackathon.concluded && userProject.tokensReceived > 0 && (
                  <Button 
                    size="sm" 
                    className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white"
                    onClick={() => handleClaimPrize(hackathon.contractAddress, userProject.id)}
                    disabled={claimingPrizes[`${hackathon.contractAddress}-${userProject.id}`]}
                  >
                    {claimingPrizes[`${hackathon.contractAddress}-${userProject.id}`] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Claiming...
                      </>
                    ) : (
                      'Claim Prize'
                    )}
                  </Button>
                )}
                <Link href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none">
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderJudgingCard = (hackathon: HackathonData) => {
    const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
    const userJudge = hackathon.judges.find(j => 
      j.address.toLowerCase() === (userAddress || '').toLowerCase()
    )

    // Since this hackathon came from getJudgeHackathons, we know the user is a judge
    // If userJudge is not found in the judges array, create a default entry
    const judgeInfo = userJudge || {
      address: userAddress || '',
      name: 'Judge',
      tokensAllocated: 0,
      tokensRemaining: 0
    }

    const tokenUsagePercent = judgeInfo.tokensAllocated > 0 
      ? ((judgeInfo.tokensAllocated - judgeInfo.tokensRemaining) / judgeInfo.tokensAllocated) * 100
      : 0

    return (
      <Card key={hackathon.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-gray-800">{hackathon.hackathonName}</h3>
                <p className="text-muted-foreground text-sm text-gray-600">{hackathon.description}</p>
              </div>
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                Judging
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#8B6914]" />
                <span className="font-semibold text-[#8B6914]">{formatPrizeAmount(hackathon)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">{hackathon.projectCount} projects</span>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">
                  {judgeInfo.tokensRemaining} / {judgeInfo.tokensAllocated} tokens left
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">Judge: {judgeInfo.name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Voting Progress</span>
                <span className="text-sm text-gray-600">{tokenUsagePercent.toFixed(0)}% used</span>
              </div>
              <Progress value={tokenUsagePercent} className="h-2" />
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">
                  {status === 'accepting-submissions' ? `${getDaysRemaining(hackathon.endTime)} days left to submit` : 
                   status === 'upcoming' ? 'Not started' : 
                   status === 'judging-submissions' ? 'Voting period - submissions closed' : 'Concluded'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {status === 'judging-submissions' && judgeInfo.tokensRemaining > 0 && (
                  <Link href={`/h/judge?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                    <Button size="sm" className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                      Vote on Projects
                    </Button>
                  </Link>
                )}
                <Link href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none">
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderOrganizingCard = (hackathon: HackathonData) => {
    const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)

    return (
      <Card key={hackathon.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-gray-800">{hackathon.hackathonName}</h3>
                <p className="text-muted-foreground text-sm text-gray-600">{hackathon.description}</p>
              </div>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                Organizing
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#8B6914]" />
                <span className="font-semibold text-[#8B6914]">{formatPrizeAmount(hackathon)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">{hackathon.projectCount} projects</span>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">{hackathon.judgeCount} judges</span>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">{hackathon.totalTokens} total tokens</span>
              </div>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Contract Status</span>
                <span className="text-sm text-gray-600">
                  {hackathon.concluded ? "Concluded" : "Active"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {hackathon.contractAddress.slice(0, 10)}...{hackathon.contractAddress.slice(-6)}
              </p>
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#8B6914]" />
                <span className="text-sm text-gray-600">
                  {status === 'accepting-submissions' ? `${getDaysRemaining(hackathon.endTime)} days left` : 
                   status === 'upcoming' ? 'Not started' : 
                   status === 'judging-submissions' ? 'Judging Submissions' : 'Concluded'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {(status === 'judging-submissions' || status === 'accepting-submissions') && (
                  <Link href={`/manage?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                    <Button size="sm" className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                      Manage
                    </Button>
                  </Link>
                )}
                <Link href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none">
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
            My Hackathons
          </h1>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{color: '#8B6914'}} />
            <p className="text-gray-600">Loading your hackathons...</p>
            <p className="text-sm text-gray-500">
              {isConnected ? `Fetching from ${getNetworkName(chainId)}` : 'Please connect your wallet'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
            My Hackathons
          </h1>
          
          {/* Network Status */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span>Connected to {getNetworkName(chainId)}</span>
                <Badge variant="outline" className="ml-2 border-gray-300">Chain ID: {chainId}</Badge>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span>Wallet not connected</span>
              </>
            )}
          </div>
        </div>
        
        <Alert className="max-w-2xl mx-auto border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-red-700">{error}</span>
              {!isConnected && (
                <p className="text-sm text-red-600">
                  Please connect your wallet to view your hackathons.
                </p>
              )}
              {isConnected && chainId !== 534351 && (
                <p className="text-sm text-red-600">
                  Switch to Scroll Sepolia network to view your hackathons.
                </p>
              )}
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadUserHackathons(true)}
                className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 text-red-700" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const currentHackathons = getCurrentHackathons()
  const currentTotal = getCurrentTotal()
  const currentPageNum = getCurrentPage()
  const calculatedTotalPages = Math.ceil(currentTotal / ITEMS_PER_PAGE)
  


  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1"></div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
            My Hackathons
          </h1>
          <div className="flex-1 flex justify-end">
            <div className="flex flex-col items-end">
              <Button
                onClick={handleSync}
                disabled={syncing || loading}
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 mb-2"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </Button>
              {lastSyncTime && (
                <span className="text-xs text-gray-500">
                  Last synced: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 justify-center">
        <Button 
          variant={activeTab === "participating" ? "default" : "outline"}
          onClick={() => setActiveTab("participating")}
          className={activeTab === "participating" ? "bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white" : "border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-amber-400"}
        >
          Participating ({participatingHackathons.length})
        </Button>
        <Button 
          variant={activeTab === "judging" ? "default" : "outline"}
          onClick={() => setActiveTab("judging")}
          className={activeTab === "judging" ? "bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white" : "border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-amber-400"}
        >
          Judging ({judgingHackathons.length})
        </Button>
        <Button 
          variant={activeTab === "organizing" ? "default" : "outline"}
          onClick={() => setActiveTab("organizing")}
          className={activeTab === "organizing" ? "bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white" : "border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-amber-400"}
        >
          Organizing ({organizingHackathons.length})
        </Button>
      </div>

      {/* Results Info */}
      {getCurrentTotal() > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {((getCurrentPage() - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(getCurrentPage() * ITEMS_PER_PAGE, getCurrentTotal())} of {getCurrentTotal()} hackathons
          </span>
          <span>
            Page {getCurrentPage()} of {Math.ceil(getCurrentTotal() / ITEMS_PER_PAGE)}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === "participating" && currentHackathons.map(renderParticipatingCard)}
        {activeTab === "judging" && currentHackathons.map(renderJudgingCard)}
        {activeTab === "organizing" && currentHackathons.map(renderOrganizingCard)}
      </div>

      {/* Pagination Controls */}
      {(calculatedTotalPages > 1 || (!loading && getCurrentPage() > 1)) && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, getCurrentPage() - 1))}
            disabled={getCurrentPage() === 1}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, Math.max(1, calculatedTotalPages)) }, (_, i) => {
              const totalPages = Math.max(1, calculatedTotalPages)
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (getCurrentPage() <= 3) {
                pageNum = i + 1
              } else if (getCurrentPage() >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = getCurrentPage() - 2 + i
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={getCurrentPage() === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className={getCurrentPage() === pageNum 
                    ? "bg-amber-600 text-white hover:bg-amber-700" 
                    : "border-amber-300 text-amber-700 hover:bg-amber-50"
                  }
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(Math.max(1, calculatedTotalPages), getCurrentPage() + 1))}
            disabled={getCurrentPage() === Math.max(1, calculatedTotalPages)}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Empty State */}
      {currentHackathons.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            {activeTab === "participating" && <Target className="w-8 h-8 text-[#8B6914]" />}
            {activeTab === "judging" && <Gavel className="w-8 h-8 text-[#8B6914]" />}
            {activeTab === "organizing" && <Users className="w-8 h-8 text-[#8B6914]" />}
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">No hackathons found</h3>
          <p className="text-gray-600 mb-4">
            {activeTab === "participating" && "You haven't submitted to any hackathons yet. Find one to join!"}
            {activeTab === "judging" && "You're not currently assigned as a judge on any hackathons. Organizers invite judges, so you'll appear here when selected!"}
            {activeTab === "organizing" && "You haven't organized any hackathons yet. Create your first event!"}
          </p>
          <Link href={activeTab === "participating" ? "/explorer" : 
                     activeTab === "judging" ? "/explorer" : "/createHackathon"}>
            <Button className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
              {activeTab === "participating" ? "Explore Hackathons" : 
               activeTab === "judging" ? "Browse Opportunities" : "Create Hackathon"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

export default function MyHackathonsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    }>
      <MyHackathonsPageContent />
    </Suspense>
  )
}
