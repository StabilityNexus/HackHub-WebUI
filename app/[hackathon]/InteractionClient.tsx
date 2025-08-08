"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  const basePath = process.env.NODE_ENV === 'production' ? '/HackHub-WebUI' : '';
  return `${basePath}${path}`;
};

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
  Vote,
  Gavel,
  Code,
  FileText,
  Coins,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  History
} from "lucide-react"
import { useChainId, useAccount, useWriteContract } from "wagmi"
import { toast } from "sonner"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'

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

export default function InteractionClient() {
  const [hackathonData, setHackathonData] = useState<HackathonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [isERC20Prize, setIsERC20Prize] = useState(false)
  const [prizeTokenSymbol, setPrizeTokenSymbol] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [sourceCode, setSourceCode] = useState("")
  const [documentation, setDocumentation] = useState("")
  const [prizeRecipient, setPrizeRecipient] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  
  const searchParams = useSearchParams()
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

  // Helper function to format prize amounts
  const formatPrizeAmount = (amount: string | number) => {
    if (isERC20Prize && prizeTokenSymbol) {
      return `${amount} ${prizeTokenSymbol}`
    }
    return `${amount} ETH`
  }



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
            console.log(`Project ${i}: projectPrize=${projectPrize}, prizeAmount=${prizeAmount}, isERC20Prize=${isERC20Prize}, tokenSymbol=${tokenSymbol}`)
            projects.push({
              id: i,
              submitter: projectInfo[0],
              prizeRecipient: projectInfo[1],
              sourceCode: projectInfo[2],
              documentation: projectInfo[3],
              tokensReceived: Number(projectTokens),
              estimatedPrize: prizeAmount,
              formattedPrize: isERC20Prize && tokenSymbol ? `${prizeAmount.toFixed(4)} ${tokenSymbol}` : `${prizeAmount.toFixed(4)} ETH`,
              prizeClaimed
            })
          } catch (projectError) {
            console.error(`Error fetching project ${i}:`, projectError)
          }
        }
      }

      // Remaining tokens are already fetched directly from the contract above

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

  // Submit or edit project
  const handleSubmitProject = async () => {
    if (!sourceCode.trim() || !documentation.trim()) {
      toast.error("Please provide both source code and documentation links")
      return
    }

    if (!isConnected || !userAddress) {
      toast.error("Please connect your wallet to submit a project")
      return
    }

    if (!contractAddress) {
      toast.error("Invalid contract address")
      return
    }

    try {
      setSubmitting(true)
      
      // Use prize recipient if provided, otherwise use user's address
      const recipient = prizeRecipient.trim() || userAddress

      if (isEditing) {
        await writeContract({
          address: contractAddress,
          abi: HACKHUB_ABI,
          functionName: 'submitProject',
          args: [sourceCode.trim(), documentation.trim(), recipient as `0x${string}`],
        })
        toast.success("Project updated successfully!")
      } else {
        await writeContract({
          address: contractAddress,
          abi: HACKHUB_ABI,
          functionName: 'submitProject',
          args: [sourceCode.trim(), documentation.trim(), recipient as `0x${string}`],
        })
        toast.success("Project submitted successfully!")
      }

      setSubmissionOpen(false)
      setSourceCode("")
      setDocumentation("")
      setPrizeRecipient("")
      setIsEditing(false)
      
      // Refresh data after submission
      setTimeout(() => {
        fetchHackathonData()
      }, 1000)
      
    } catch (err: any) {
      console.error('Error submitting project:', err)
      toast.error(err?.message || "Failed to submit project")
    } finally {
      setSubmitting(false)
    }
  }

  // Handle edit project
  const handleEditProject = () => {
    if (!userProject) return
    
    setSourceCode(userProject.sourceCode)
    setDocumentation(userProject.documentation)
    setPrizeRecipient(userProject.prizeRecipient === userAddress ? "" : userProject.prizeRecipient)
    setIsEditing(true)
    setSubmissionOpen(true)
  }



  // Load data on mount
  useEffect(() => {
    if (contractAddress) {
      fetchHackathonData()
    }
  }, [contractAddress, chainId])

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
          {urlChainId && (
            <p className="text-xs text-muted-foreground">
              Expected Chain ID: {urlChainId}
            </p>
          )}
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
              {urlChainId && chainId !== parseInt(urlChainId) && (
                <p className="text-sm text-yellow-600">
                  Warning: You're connected to chain {chainId} but this hackathon is on chain {urlChainId}
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
  const startDate = new Date(hackathonData.startTime * 1000)
  const endDate = new Date(hackathonData.endTime * 1000)

  const getStatusBadge = () => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Upcoming</Badge>
      case 'accepting-submissions':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Accepting Submissions - {daysRemaining} days left</Badge>
      case 'judging-submissions':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Judging Submissions</Badge>
      case 'concluded':
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white">Concluded</Badge>
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white">Unknown</Badge>
    }
  }

  // Check if user has already submitted
  const userProject = hackathonData.projects.find(p => 
    p.submitter.toLowerCase() === (userAddress || '').toLowerCase()
  )

  return (
    <div className="space-y-8">
      {/* Header - Enhanced with custom image background */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={getImagePath("/hacka-thon.jpg")}
            alt="Hackathon Background"
            className="w-full h-80 object-cover"
          />
          {/* Gradient Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>
        
        {/* Content Overlay */}
        <div className="relative z-10 flex items-center justify-between h-80 p-8">
          {/* Left side - Hackathon Info */}
          <div className="flex-1 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center space-x-4">
              {getStatusBadge()}
              <span className="text-white/90 text-sm font-medium">
                Network: {getNetworkName(chainId)}
              </span>
            </div>
            
            {/* Hackathon Name - Main focal point */}
            <div className="space-y-3">
              <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
                {hackathonData.hackathonName}
              </h1>
              <div className="flex items-center space-x-6 text-white/90">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="text-xl font-bold">{formatPrizeAmount(hackathonData.prizePool)}</span>
                  <span className="text-lg">Prize Pool</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-lg">{hackathonData.projectCount} Projects</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Decorative Element */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About This Hackathon */}
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">About This Hackathon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-black leading-relaxed mb-4">
                Join this Web3 hackathon and compete for a share of the {formatPrizeAmount(hackathonData.prizePool)} prize pool. 
                Submit your project during the submission period and get votes from judges to win prizes.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg border">
                  <Vote className="w-8 h-8 mx-auto mb-2" style={{color: '#8B6914'}} />
                  <p className="text-2xl font-bold" style={{color: '#8B6914'}}>{hackathonData.totalTokens}</p>
                  <p className="text-md font-bold text-gray-800 text-muted-foreground">Total Voting Tokens</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border" >
                  <Coins className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold" style={{color: '#8B6914'}}>{formatPrizeAmount(hackathonData.prizePool)}</p>
                  <p className="text-md font-bold text-gray-800 text-muted-foreground">Prize Pool</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center text-black gap-2">
                <Calendar className="w-5 h-5" style={{color: '#8B6914'}} />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'upcoming' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                  <div>
                    <p className="font-semibold text-gray-800">Hackathon Starts</p>
                    <p className="text-sm text-muted-foreground">
                      {formatUTCTimestamp(hackathonData.startTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'judging-submissions' || status === 'concluded' ? 'bg-green-500' : status === 'accepting-submissions' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-semibold text-gray-800">Submission Deadline</p>
                    <p className="text-sm text-muted-foreground">
                      {formatUTCTimestamp(hackathonData.endTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${hackathonData.concluded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-semibold text-gray-800">Hackathon Concluded</p>
                    <p className="text-sm text-muted-foreground">
                      {hackathonData.concluded ? 'Completed - Winners can claim prizes' : 'Pending organizer conclusion'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Judges Section */}
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-black gap-2">
                <Gavel className="w-5 h-5" style={{color: '#8B6914'}} />
                Judges & Voting Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hackathonData.judges.map((judge, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-amber-100 text-amber-700">
                          {judge.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-gray-800">{judge.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {judge.address.slice(0, 6)}...{judge.address.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {judge.tokensAllocated} total
                          </span>
                          <Vote className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {judge.tokensRemaining} remaining
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats - Enhanced */}
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-gray-800">Status</span>
                {getStatusBadge()}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-gray-800">Contract</span>
                <span className="text-sm font-mono text-gray-800">
                  {hackathonData.contractAddress.slice(0, 6)}...{hackathonData.contractAddress.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-gray-800">Organizer</span>
                <span className="text-sm font-mono text-gray-800">
                  {hackathonData.organizer.slice(0, 6)}...{hackathonData.organizer.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-gray-800">Projects</span>
                <span className="font-semibold text-gray-800">{hackathonData.projectCount}</span>
              </div>
              
              {/* Organizer Past Events Button */}
              <div className="pt-2">
                <Link href={`/organizer?address=${hackathonData.organizer}`}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                  >
                    <History className="w-4 h-4 mr-2" />
                    View Organizer's Events
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Judge Voting Interface */}
          {isUserJudge && (
            <Card className="border shadow-sm border-black bg-white">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Gavel className="w-12 h-12 mx-auto" style={{color: '#8B6914'}} />
                  <h3 className="font-bold text-lg text-gray-800">Judge Panel</h3>
                  <p className="text-sm text-muted-foreground text-gray-800">
                    You have {userJudge?.tokensRemaining} voting tokens remaining
                  </p>
                  
                  <Link href={`/h/judge?hackAddr=${hackAddr}&chainId=${urlChainId}`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none mt-4 border-amber-300"
                      disabled={!hackathonData.projects.length}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Open Judge Panel
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Submission */}
          {status === 'accepting-submissions' && (
            <Card className="border shadow-sm border-black bg-white">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Target className="w-12 h-12 mx-auto" style={{color: '#8B6914'}} />
                  <h3 className="font-bold text-lg text-gray-800">Ready to Participate?</h3>
                  {userProject ? (
                    <div className="space-y-3">
                      <p className="text-sm text-green-600 text-gray-800">✓ You have already submitted a project!</p>
                      <p className="text-xs text-muted-foreground text-gray-800">
                        Project #{userProject.id} - {userProject.tokensReceived} votes received
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Submit your project before the deadline to compete for the prize pool!
                    </p>
                  )}
                  
                  <Dialog open={submissionOpen} onOpenChange={setSubmissionOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                        disabled={!isConnected}
                        onClick={() => {
                          if (userProject) {
                            handleEditProject()
                          } else {
                            setIsEditing(false)
                            setSourceCode("")
                            setDocumentation("")
                            setPrizeRecipient("")
                          }
                        }}
                      >
                        {!isConnected ? 'Connect Wallet' : userProject ? 'Edit Submission' : 'Submit Project'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Your Project' : 'Submit Your Project'}</DialogTitle>
                        <DialogDescription>
                          {isEditing 
                            ? 'Update your project submission details.' 
                            : 'Submit your project with source code and documentation links. Both must be publicly accessible.'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="sourceCode">Source Code URL</Label>
                          <Input
                            id="sourceCode"
                            placeholder="https://github.com/username/project"
                            value={sourceCode}
                            onChange={(e) => setSourceCode(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="documentation">Documentation Link</Label>
                          <Input
                            id="documentation"
                            placeholder="https://docs.google.com/document/... or README link"
                            value={documentation}
                            onChange={(e) => setDocumentation(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Link to your project documentation (README, Google Docs, etc.)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="prizeRecipient">Prize Recipient Address (Optional)</Label>
                          <Input
                            id="prizeRecipient"
                            placeholder="Leave empty to use your wallet address"
                            value={prizeRecipient}
                            onChange={(e) => setPrizeRecipient(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            The address that will receive the prize if your project wins. Leave empty to use your connected wallet address.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSubmissionOpen(false)
                            setIsEditing(false)
                            setSourceCode("")
                            setDocumentation("")
                            setPrizeRecipient("")
                          }}
                          disabled={submitting}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSubmitProject}
                          disabled={submitting || !sourceCode.trim() || !documentation.trim()}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {isEditing ? 'Updating...' : 'Submitting...'}
                            </>
                          ) : (
                            isEditing ? 'Update Project' : 'Submit Project'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>




    </div>
  )
}
