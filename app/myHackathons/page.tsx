"use client"

import { useState, useEffect } from "react"
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
import { formatEther } from "viem"
import { Trophy, Target, Calendar, Users, Vote, Gavel, Code, Coins, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { useChainId, useAccount } from "wagmi"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'

type TabType = "participating" | "judging" | "organizing"

export default function MyHackathonsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("participating")

  
  // Blockchain data state
  const [participatingHackathons, setParticipatingHackathons] = useState<HackathonData[]>([])
  const [judgingHackathons, setJudgingHackathons] = useState<HackathonData[]>([])
  const [organizingHackathons, setOrganizingHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()

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
        prizePool,
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
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'prizePool' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
      ])

      // Fetch judges if user is a judge
      const judges = []
      if (Number(judgeCount) > 0) {
        for (let i = 0; i < Number(judgeCount); i++) {
          try {
            const judgeInfo = await publicClient.readContract({ 
              address: addr, 
              abi: HACKHUB_ABI, 
              functionName: 'judges',
              args: [BigInt(i)]
            }) as [string, bigint, string] // [addr, tokens, name]

            judges.push({
              address: judgeInfo[0],
              name: judgeInfo[2],
              tokensAllocated: Number(judgeInfo[1]),
              tokensRemaining: Number(judgeInfo[1])
            })
          } catch (judgeError) {
            console.error(`Error fetching judge ${i}:`, judgeError)
          }
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
            const [projectInfo, projectTokens, projectPrize, prizeClaimed] = await Promise.all([
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'projects',
                args: [userProjectId]
              }) as Promise<[string, string, string, string]>, // [submitter, prizeRecipient, sourceCode, documentation]
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'projectTokens',
                args: [userProjectId]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'getProjectPrize',
                args: [userProjectId]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: addr,
                abi: HACKHUB_ABI,
                functionName: 'prizeClaimed',
                args: [userProjectId]
              }) as Promise<boolean>
            ])

            projects.push({
              id: Number(userProjectId),
              submitter: projectInfo[0],
              prizeRecipient: projectInfo[1],
              sourceCode: projectInfo[2],
              documentation: projectInfo[3],
              tokensReceived: Number(projectTokens),
              estimatedPrize: Number(formatEther(projectPrize)),
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
        prizePool: formatEther(prizePool),
        totalTokens: Number(totalTokens),
        concluded,
        organizer,
        factory,
        judgeCount: Number(judgeCount),
        projectCount: Number(projectCount),
        judges,
        projects,
        description: `Web3 Hackathon with ${formatEther(prizePool)} ETH prize pool`,
        image: "/placeholder.svg?height=200&width=400",
        tags: ["Web3", "Blockchain"],
      }

      return hackathon
    } catch (err) {
      console.error(`Error fetching hackathon ${addr}:`, err)
      return null
    }
  }

  // Load user's hackathons
  const loadUserHackathons = async () => {
    if (!userAddress || !isConnected) {
      setError('Please connect your wallet to view your hackathons')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
        return
      }

      // Get counts for each category
      const [
        participantOngoingCount,
        participantPastCount,
        judgeOngoingCount,
        judgePastCount
      ] = await Promise.all([
        publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getParticipantOngoingCount',
          args: [userAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getParticipantPastCount',
          args: [userAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getJudgeOngoingCount',
          args: [userAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getJudgePastCount',
          args: [userAddress],
        }) as Promise<bigint>
      ])

      // Fetch participating hackathons
      let participantAddresses: `0x${string}`[] = []
      const totalParticipating = Number(participantOngoingCount) + Number(participantPastCount)
      
      if (Number(participantOngoingCount) > 0) {
        const ongoingParticipant = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getParticipantOngoingHackathons',
          args: [userAddress, BigInt(0), BigInt(Number(participantOngoingCount) - 1)],
        }) as `0x${string}`[]
        participantAddresses = participantAddresses.concat(ongoingParticipant)
      }

      if (Number(participantPastCount) > 0) {
        const pastParticipant = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getParticipantPastHackathons',
          args: [userAddress, BigInt(0), BigInt(Number(participantPastCount) - 1)],
        }) as `0x${string}`[]
        participantAddresses = participantAddresses.concat(pastParticipant)
      }

      // Fetch judging hackathons
      let judgeAddresses: `0x${string}`[] = []
      const totalJudging = Number(judgeOngoingCount) + Number(judgePastCount)

      if (Number(judgeOngoingCount) > 0) {
        const ongoingJudge = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getJudgeOngoingHackathons',
          args: [userAddress, BigInt(0), BigInt(Number(judgeOngoingCount) - 1)],
        }) as `0x${string}`[]
        judgeAddresses = judgeAddresses.concat(ongoingJudge)
      }

      if (Number(judgePastCount) > 0) {
        const pastJudge = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getJudgePastHackathons',
          args: [userAddress, BigInt(0), BigInt(Number(judgePastCount) - 1)],
        }) as `0x${string}`[]
        judgeAddresses = judgeAddresses.concat(pastJudge)
      }

      // Fetch organizing hackathons (all hackathons where user is owner)
      const [ongoingCount, pastCount] = await Promise.all([
        publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getOngoingCount',
        }) as Promise<bigint>,
        publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getPastCount',
        }) as Promise<bigint>,
      ])

      let allAddresses: `0x${string}`[] = []
      
      if (Number(ongoingCount) > 0) {
        const ongoingAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getOngoingHackathons',
          args: [BigInt(0), BigInt(Number(ongoingCount) - 1)],
        }) as `0x${string}`[]
        allAddresses = allAddresses.concat(ongoingAddrs)
      }

      if (Number(pastCount) > 0) {
        const pastAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getPastHackathons',
          args: [BigInt(0), BigInt(Number(pastCount) - 1)],
        }) as `0x${string}`[]
        allAddresses = allAddresses.concat(pastAddrs)
      }

      // Filter organizing hackathons by owner
      const organizingAddresses: `0x${string}`[] = []
      for (const addr of allAddresses) {
        try {
          const owner = await publicClient.readContract({
            address: addr,
            abi: HACKHUB_ABI,
            functionName: 'owner'
          }) as string
          
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            organizingAddresses.push(addr)
          }
        } catch (err) {
          console.error(`Error checking owner for ${addr}:`, err)
        }
      }

      // Fetch detailed data for all hackathons
      const [participatingData, judgingData, organizingData] = await Promise.all([
        Promise.all(participantAddresses.map((addr, index) => fetchHackathonDetails(addr, index))),
        Promise.all(judgeAddresses.map((addr, index) => fetchHackathonDetails(addr, index))),
        Promise.all(organizingAddresses.map((addr, index) => fetchHackathonDetails(addr, index)))
      ])

      setParticipatingHackathons(participatingData.filter((h): h is HackathonData => h !== null))
      setJudgingHackathons(judgingData.filter((h): h is HackathonData => h !== null))
      setOrganizingHackathons(organizingData.filter((h): h is HackathonData => h !== null))

    } catch (err) {
      console.error('Error loading user hackathons:', err)
      setError('Failed to load hackathons from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount and when user/network changes
  useEffect(() => {
    loadUserHackathons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, chainId])

  // Get current data based on active tab
  const getCurrentHackathons = () => {
    switch (activeTab) {
      case "participating": return participatingHackathons
      case "judging": return judgingHackathons
      case "organizing": return organizingHackathons
      default: return []
    }
  }

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
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold text-yellow-700">{hackathon.prizePool} ETH</span>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4" style={{color: '#8B6914'}} />
                <span className="text-sm text-gray-600">{userProject.tokensReceived} votes</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">
                  {userProject.formattedPrize ? userProject.formattedPrize : `${userProject.estimatedPrize.toFixed(4)} ETH`} estimated
                </span>
              </div>
              <div className="flex items-center gap-2">
                {userProject.prizeClaimed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
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
              <p className="text-sm text-gray-600">{userProject.documentation}</p>
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">
                  {status === 'active' ? `${getDaysRemaining(hackathon.endTime)} days left` : 
                   status === 'upcoming' ? 'Not started' : 
                   status === 'ended' ? 'Ended' : 'Concluded'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {!userProject.prizeClaimed && hackathon.concluded && userProject.tokensReceived > 0 && (
                  <Button size="sm" className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                    Claim Prize
                  </Button>
                )}
                <Link href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-amber-400">
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

    if (!userJudge) return null

    const tokenUsagePercent = userJudge.tokensAllocated > 0 
      ? ((userJudge.tokensAllocated - userJudge.tokensRemaining) / userJudge.tokensAllocated) * 100
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
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold text-yellow-700">{hackathon.prizePool} ETH</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">{hackathon.projectCount} projects</span>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4" style={{color: '#8B6914'}} />
                <span className="text-sm text-gray-600">
                  {userJudge.tokensRemaining} / {userJudge.tokensAllocated} tokens left
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Judge: {userJudge.name}</span>
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
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">
                  {status === 'active' ? `${getDaysRemaining(hackathon.endTime)} days left to submit` : 
                   status === 'upcoming' ? 'Not started' : 
                   status === 'ended' ? 'Voting period - submissions closed' : 'Concluded'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {status === 'ended' && userJudge.tokensRemaining > 0 && (
                  <Link href={`/h/judge?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                    <Button size="sm" className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                      Vote on Projects
                    </Button>
                  </Link>
                )}
                <Link href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-amber-400">
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
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold text-yellow-700">{hackathon.prizePool} ETH</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">{hackathon.projectCount} projects</span>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4" style={{color: '#8B6914'}} />
                <span className="text-sm text-gray-600">{hackathon.judgeCount} judges</span>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-green-600" />
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
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">
                  {status === 'active' ? `${getDaysRemaining(hackathon.endTime)} days left` : 
                   status === 'upcoming' ? 'Not started' : 
                   status === 'ended' ? 'Ended' : 'Concluded'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {status === 'ended' && !hackathon.concluded && (
                  <Button size="sm" className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                    Conclude Hackathon
                  </Button>
                )}
                {status === 'active' && (
                  <Link href={`/manage?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                    <Button size="sm" className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
                      Manage
                    </Button>
                  </Link>
                )}
                <Link href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}>
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-amber-400">
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
          <p className="text-muted-foreground text-lg text-gray-600">Track your hackathon participation, judging, and organizing activities</p>
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
          <p className="text-muted-foreground text-lg text-gray-600">Track your hackathon participation, judging, and organizing activities</p>
          
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
                onClick={loadUserHackathons}
                className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const currentHackathons = getCurrentHackathons()

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
          My Hackathons
        </h1>
        <p className="text-muted-foreground text-lg text-gray-600">Track your hackathon participation, judging, and organizing activities</p>
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

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === "participating" && currentHackathons.map(renderParticipatingCard)}
        {activeTab === "judging" && currentHackathons.map(renderJudgingCard)}
        {activeTab === "organizing" && currentHackathons.map(renderOrganizingCard)}
      </div>

      {/* Empty State */}
      {currentHackathons.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            {activeTab === "participating" && <Target className="w-8 h-8 text-amber-600" />}
            {activeTab === "judging" && <Gavel className="w-8 h-8 text-amber-600" />}
            {activeTab === "organizing" && <Users className="w-8 h-8 text-amber-600" />}
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-800">No hackathons found</h3>
          <p className="text-gray-600 mb-4">
            {activeTab === "participating" && "You haven't submitted to any hackathons yet. Find one to join!"}
            {activeTab === "judging" && "You haven't been assigned as a judge yet. Stay tuned for opportunities!"}
            {activeTab === "organizing" && "You haven't organized any hackathons yet. Create your first event!"}
          </p>
          <Button className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white">
            {activeTab === "participating" ? "Explore Hackathons" : 
             activeTab === "judging" ? "Browse Opportunities" : "Create Hackathon"}
          </Button>
        </div>
      )}
    </div>
  )
}
