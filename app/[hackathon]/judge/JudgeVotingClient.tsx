"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HackathonData, getHackathonStatus, getDaysRemaining, Judge, Project } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { 
  Trophy, 
  Users, 
  Clock, 
  Award, 
  Target, 
  Calendar,
  ExternalLink,
  Share2,
  Vote,
  Gavel,
  Code,
  FileText,
  Coins,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Plus,
  Minus,
  Eye,
  History,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { useChainId, useAccount, useWriteContract } from "wagmi"
import { toast } from "sonner"
import Link from "next/link"

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

export default function JudgeVotingClient() {
  const [hackathonData, setHackathonData] = useState<HackathonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)
  const [expandedProject, setExpandedProject] = useState<number | null>(null)
  const [isERC20Prize, setIsERC20Prize] = useState(false)
  const [prizeTokenSymbol, setPrizeTokenSymbol] = useState<string>("")
  
  // Form state
  const [voteAmounts, setVoteAmounts] = useState<{[key: number]: number}>({})
  const [currentVotes, setCurrentVotes] = useState<{[key: number]: number}>({}) // Track current votes by this judge
  const [totalAllocated, setTotalAllocated] = useState(0)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const hackAddr = searchParams.get('hackAddr')
  const urlChainId = searchParams.get('chainId')
  
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  const { writeContract } = useWriteContract()
  
  // Validate hackAddr format
  const contractAddress = hackAddr && hackAddr.match(/^0x[a-fA-F0-9]{40}$/) 
    ? hackAddr as `0x${string}` 
    : null

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

  // Check if user is a judge
  const isUserJudge = hackathonData?.judges.some(j => 
    j.address.toLowerCase() === (userAddress || '').toLowerCase()
  )

  const userJudge = hackathonData?.judges.find(j => 
    j.address.toLowerCase() === (userAddress || '').toLowerCase()
  )

  // Calculate total allocated tokens
  useEffect(() => {
    const total = Object.values(voteAmounts).reduce((sum, amount) => {
      const numAmount = typeof amount === 'string' ? parseInt(amount) || 0 : amount || 0
      return sum + numAmount
    }, 0)
    setTotalAllocated(total)
  }, [voteAmounts])

  // Fetch hackathon data from contract
  const fetchHackathonData = async () => {
    if (!contractAddress) {
      setError('Invalid hackathon address provided')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

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
        isERC20,
        prizeToken,
      ] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'prizePool' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'isERC20Prize' }) as Promise<boolean>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'prizeToken' }) as Promise<string>,
      ])

      // Set prize type
      setIsERC20Prize(isERC20)

      // Get token symbol if it's an ERC20 prize
      let tokenSymbol = ""
      if (isERC20 && prizeToken !== "0x0000000000000000000000000000000000000000") {
        try {
          tokenSymbol = await publicClient.readContract({
            address: prizeToken as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }) as string
        } catch (err) {
          console.error('Error fetching token symbol:', err)
          tokenSymbol = "TOKEN"
        }
      }
      setPrizeTokenSymbol(tokenSymbol)

      // Fetch judges
      const judges: Judge[] = []
      if (Number(judgeCount) > 0) {
        try {
          const [judgeAddresses, judgeNames] = await Promise.all([
            publicClient.readContract({ 
              address: contractAddress, 
              abi: HACKHUB_ABI, 
              functionName: 'getJudges',
              args: [BigInt(0), BigInt(Number(judgeCount) - 1)]
            }) as Promise<string[]>,
            publicClient.readContract({ 
              address: contractAddress, 
              abi: HACKHUB_ABI, 
              functionName: 'getJudgeNames',
              args: [BigInt(0), BigInt(Number(judgeCount) - 1)]
            }) as Promise<string[]>
          ])

          for (let i = 0; i < judgeAddresses.length; i++) {
            try {
              // Get judge tokens allocated and remaining
              const [judgeTokens, remainingTokens] = await Promise.all([
                publicClient.readContract({
                  address: contractAddress,
                  abi: HACKHUB_ABI,
                  functionName: 'judgeTokens',
                  args: [judgeAddresses[i] as `0x${string}`]
                }) as Promise<bigint>,
                publicClient.readContract({
                  address: contractAddress,
                  abi: HACKHUB_ABI,
                  functionName: 'remainingJudgeTokens',
                  args: [judgeAddresses[i] as `0x${string}`]
                }) as Promise<bigint>
              ])

              judges.push({
                address: judgeAddresses[i],
                name: judgeNames[i],
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

      // Fetch projects
      const projects: Project[] = []
      if (Number(projectCount) > 0) {
        for (let i = 0; i < Number(projectCount); i++) {
          try {
            const [projectInfo, projectTokens, projectPrize, prizeClaimed] = await Promise.all([
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'projects',
                args: [BigInt(i)]
              }) as Promise<[string, string, string, string]>, // [submitter, recipient, sourceCode, docs]
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'projectTokens',
                args: [BigInt(i)]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'getProjectPrize',
                args: [BigInt(i)]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'prizeClaimed',
                args: [BigInt(i)]
              }) as Promise<boolean>
            ])

            const prizeAmount = Number(formatEther(projectPrize))
            projects.push({
              id: i,
              submitter: projectInfo[0],
              prizeRecipient: projectInfo[1],
              sourceCode: projectInfo[2],
              documentation: projectInfo[3],
              tokensReceived: Number(projectTokens),
              estimatedPrize: prizeAmount,
              formattedPrize: isERC20 && tokenSymbol ? `${prizeAmount.toFixed(4)} ${tokenSymbol}` : `${prizeAmount.toFixed(4)} ETH`,
              prizeClaimed
            })
          } catch (projectError) {
            console.error(`Error fetching project ${i}:`, projectError)
          }
        }
      }

      // Note: judges[i].tokens from contract already contains remaining tokens
      // No additional calculation needed as contract updates this in real-time

      // Fetch current votes by the logged-in judge for each project
      const judgeCurrentVotes: {[key: number]: number} = {}
      if (userAddress && Number(projectCount) > 0) {
        for (let projectId = 0; projectId < Number(projectCount); projectId++) {
          try {
            const voteAmount = await publicClient.readContract({
              address: contractAddress,
              abi: HACKHUB_ABI,
              functionName: 'judgeVotes',
              args: [userAddress as `0x${string}`, BigInt(projectId)]
            }) as bigint
            
            judgeCurrentVotes[projectId] = Number(voteAmount)
          } catch (err) {
            console.error(`Error fetching current vote for project ${projectId}:`, err)
            judgeCurrentVotes[projectId] = 0
          }
        }
      }
      setCurrentVotes(judgeCurrentVotes)

      const hackathon: HackathonData = {
        id: 0, // Not used for individual pages
        contractAddress,
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
        image: "/placeholder.svg?height=300&width=1200",
      }

      setHackathonData(hackathon)
    } catch (err) {
      console.error('Error fetching hackathon data:', err)
      setError('Failed to load hackathon data from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Vote on project
  const handleVoteOnProject = async (projectId: number, amount: number) => {
    if (!contractAddress || !userAddress) return

    try {
      setVoting(true)
      
      await writeContract({
        address: contractAddress,
        abi: HACKHUB_ABI,
        functionName: 'vote',
        args: [BigInt(projectId), BigInt(amount)],
      })

      toast.success(`Voted ${amount} tokens for project #${projectId}!`)
      
      // Clear the vote amount for this project
      setVoteAmounts(prev => ({
        ...prev,
        [projectId]: 0
      }))
      
      // Refresh data after voting
      setTimeout(() => {
        fetchHackathonData()
      }, 1000)
      
    } catch (err: any) {
      console.error('Error voting:', err)
      toast.error(err?.message || "Failed to vote")
    } finally {
      setVoting(false)
    }
  }

  // Batch vote on multiple projects
  const handleBatchVote = async () => {
    if (!contractAddress || !userAddress) return

    const projectsToVote = Object.entries(voteAmounts).filter(([_, amount]) => {
      const numAmount = typeof amount === 'string' ? parseInt(amount) || 0 : amount || 0
      return numAmount > 0
    })
    
    if (projectsToVote.length === 0) {
      toast.error("Please allocate tokens to at least one project")
      return
    }

    try {
      setVoting(true)
      
              // Vote on each project sequentially
        for (const [projectId, amount] of projectsToVote) {
          const numAmount = typeof amount === 'string' ? parseInt(amount) || 0 : amount || 0
          await writeContract({
            address: contractAddress,
            abi: HACKHUB_ABI,
            functionName: 'vote',
            args: [BigInt(projectId), BigInt(numAmount)],
          })
        }

      toast.success(`Successfully voted on ${projectsToVote.length} projects!`)
      
      // Clear all vote amounts
      setVoteAmounts({})
      
      // Refresh data after voting
      setTimeout(() => {
        fetchHackathonData()
      }, 1000)
      
    } catch (err: any) {
      console.error('Error batch voting:', err)
      toast.error(err?.message || "Failed to complete batch voting")
    } finally {
      setVoting(false)
    }
  }

  // Quick allocation functions
  const distributeEvenly = () => {
    if (!userJudge || !hackathonData || hackathonData.projects.length === 0) return
    
    const tokensPerProject = Math.floor(userJudge.tokensRemaining / hackathonData.projects.length)
    const newVoteAmounts: {[key: number]: number} = {}
    
    hackathonData.projects.forEach(project => {
      newVoteAmounts[project.id] = tokensPerProject
    })
    
    setVoteAmounts(newVoteAmounts)
  }

  const clearAllVotes = () => {
    setVoteAmounts({})
  }

  // Load data on mount
  useEffect(() => {
    if (contractAddress) {
      fetchHackathonData()
    }
  }, [contractAddress, chainId])

  // Redirect if not a judge
  useEffect(() => {
    if (hackathonData && !isUserJudge && !loading) {
      toast.error("Access denied: You are not a judge for this hackathon")
      router.push(`/h?hackAddr=${hackAddr}&chainId=${urlChainId}`)
    }
  }, [hackathonData, isUserJudge, loading])

  // Show error if no hackAddr provided
  if (!hackAddr) {
    return (
      <div className="flex items-center justify-center py-12">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No hackathon address provided. Please access this page through a valid hackathon link.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Show error if invalid hackAddr format
  if (!contractAddress) {
    return (
      <div className="flex items-center justify-center py-12">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid hackathon address format. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{color: '#8B6914'}} />
          <p className="text-muted-foreground">Loading hackathon data...</p>
          <p className="text-sm text-muted-foreground">
            {isConnected ? `Fetching from ${getNetworkName(chainId)}` : 'Please connect your wallet'}
          </p>
        </div>
      </div>
    )
  }

  if (error || !hackathonData) {
    return (
      <div className="space-y-8">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="space-y-2">
              <span>{error || 'Hackathon not found'}</span>
              {!isConnected && (
                <p className="text-sm text-muted-foreground">
                  Please connect your wallet to view hackathon details.
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHackathonData}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const status = getHackathonStatus(hackathonData.startTime, hackathonData.endTime, hackathonData.concluded)
  const daysRemaining = getDaysRemaining(hackathonData.endTime)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/h?hackAddr=${hackAddr}&chainId=${urlChainId}`}>
            <Button variant="outline" size="sm" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hackathon
            </Button>
          </Link>
          
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="w-6 h-6" style={{color: '#8B6914'}} />
              <span className="text-xl font-bold" style={{color: '#8B6914'}}>
                {userJudge?.tokensRemaining || 0} tokens remaining
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalAllocated > 0 && `${totalAllocated} tokens allocated`}
            </p>
          </div>
        </div>
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#8B6914]">{hackathonData.hackathonName}</h1>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border shadow-sm bg-gray-50 border-black">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Quick Actions</h3>
              <p className="text-sm text-muted-foreground text-gray-600">
                Distribute your {userJudge?.tokensRemaining || 0} voting tokens across {hackathonData.projects.length} projects
              </p>
            </div>
            <div className="flex items-center gap-3">
                              <Button
                variant="outline"
                size="sm"
                onClick={distributeEvenly}
                disabled={!hackathonData.projects.length || !userJudge?.tokensRemaining}
                className="border-[#8B6914] bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white border-none"
              >
                Distribute Evenly
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllVotes}
                disabled={totalAllocated === 0}
                className="border-gray-300 bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white border-none"
              >
                Clear All
              </Button>
              <Button
                onClick={handleBatchVote}
                disabled={voting || totalAllocated === 0}
                className="text-white hover:opacity-90"
                style={{backgroundColor: '#8B6914'}}
              >
                {voting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Voting...
                  </>
                ) : (
                  `Vote on ${Object.values(voteAmounts).filter(v => v > 0).length} Projects`
                )}
              </Button>
            </div>
          </div>
          
          {(() => {
            // Calculate total available tokens (remaining + current votes that can be reused)
            const totalAvailable = (userJudge?.tokensRemaining || 0) + 
              Object.values(currentVotes).reduce((sum, votes) => sum + votes, 0)
            return totalAllocated > totalAvailable && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You've allocated {totalAllocated} tokens but only have {totalAvailable} available 
                  ({userJudge?.tokensRemaining || 0} remaining + {Object.values(currentVotes).reduce((sum, votes) => sum + votes, 0)} from existing votes).
                  Please adjust your allocation.
                </AlertDescription>
              </Alert>
            )
          })()}
        </CardContent>
      </Card>

      {/* Projects List */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Submitted Projects ({hackathonData.projects.length})
        </h2>
        
        {hackathonData.projects.length === 0 ? (
          <Card className="border shadow-sm">
            <CardContent className="p-12 text-center">
              <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Projects Submitted Yet</h3>
              <p className="text-muted-foreground">
                Projects will appear here once participants start submitting.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {hackathonData.projects.map((project, index) => (
              <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow bg-white">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Project Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-800">Project #{project.id + 1}</h3>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium text-gray-800">Submitted by:</span> {project.submitter.slice(0, 6)}...{project.submitter.slice(-4)}
                          </p>
                          {project.prizeRecipient !== project.submitter && (
                            <p className="text-sm text-gray-700">
                              <span className="font-medium text-gray-800">Prize recipient:</span> {project.prizeRecipient.slice(0, 6)}...{project.prizeRecipient.slice(-4)}
                            </p>
                          )}
                          <p className="text-sm text-gray-700">
                            <span className="font-medium text-gray-800">Estimated prize:</span> {project.formattedPrize || `${project.estimatedPrize.toFixed(4)} ETH`}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                        className="text-[#8B6914] hover:bg-[#FAE5C3] hover:text-[#8B6914]"
                      >
                        {expandedProject === project.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Project Links */}
                    <div className="flex items-center gap-4">
                      <a 
                        href={project.sourceCode} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#8B6914] hover:text-[#A0471D] font-medium"
                      >
                        <Code className="w-4 h-4" />
                        Source Code
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a 
                        href={project.documentation} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#8B6914] hover:text-[#A0471D] font-medium"
                      >
                        <FileText className="w-4 h-4" />
                        Documentation
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Expanded Content */}
                    {expandedProject === project.id && (
                      <div className="pt-4 border-t space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Source Code URL</Label>
                            <p className="text-sm text-gray-600 mt-1 break-all">{project.sourceCode}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Documentation URL</Label>
                            <p className="text-sm text-gray-600 mt-1 break-all">{project.documentation}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Voting Interface */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Input
                                id={`vote-${project.id}`}
                                type="number"
                                min="0"
                                max={(userJudge?.tokensRemaining || 0) + (currentVotes[project.id] || 0)}
                                placeholder={currentVotes[project.id] ? `Current: ${currentVotes[project.id]}` : "Enter tokens"}
                                value={voteAmounts[project.id] || ""}
                                onFocus={(e) => {
                                  if (e.target.value === "0") {
                                    e.target.value = ""
                                  }
                                }}
                                onChange={(e) => setVoteAmounts(prev => ({
                                  ...prev,
                                  [project.id]: parseInt(e.target.value) || 0
                                }))}
                                className="w-32 bg-white border-black text-black"
                              />
                              <span className="text-sm text-muted-foreground">tokens</span>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => handleVoteOnProject(project.id, voteAmounts[project.id] || 0)}
                            disabled={
                              !voteAmounts[project.id] || 
                              voting || 
                              voteAmounts[project.id] > ((userJudge?.tokensRemaining || 0) + (currentVotes[project.id] || 0))
                            }
                            className="text-white hover:opacity-90"
                            style={{backgroundColor: '#8B6914'}}
                          >
                            {voting ? <Loader2 className="w-4 h-4 animate-spin" /> : (currentVotes[project.id] ? 'Update Vote' : 'Vote Now')}
                          </Button>
                        </div>

                        <div className="text-right space-y-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Your Current Vote</p>
                            <div className="flex items-center justify-end gap-1">
                              <Vote className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold text-blue-600">
                                {currentVotes[project.id] || 0}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Project Votes</p>
                            <div className="flex items-center justify-end gap-1">
                              <Vote className="w-4 h-4" style={{color: '#8B6914'}} />
                              <span className="font-semibold" style={{color: '#8B6914'}}>
                                {project.tokensReceived}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 