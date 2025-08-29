"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  return path;
};

import { HackathonData, getHackathonStatus, getDaysRemaining, Judge, Project } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { 
  Trophy, 
  Users, 
  Target, 
  Calendar,
  Vote,
  Gavel,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  ArrowLeft,
  Code,
  FileText,
  ExternalLink,
  Search,
  SortAsc,
  SortDesc,
  Award
} from "lucide-react"
import { useChainId, useAccount } from "wagmi"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'
import { hackathonDB } from '@/lib/indexedDB'

// ERC20 ABI for token symbol/decimals
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const

type SortOption = 'votes-desc' | 'votes-asc' | 'name-asc' | 'name-desc' | 'recent' | 'oldest'

export default function ProjectsClient() {
  const [hackathonData, setHackathonData] = useState<HackathonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [approvedTokens, setApprovedTokens] = useState<string[]>([])
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({})
  const [tokenTotals, setTokenTotals] = useState<Record<string, bigint>>({})
  const [tokenDecimals, setTokenDecimals] = useState<Record<string, number>>({})

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>('votes-desc')
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])

  // Modal state for external links
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLink, setModalLink] = useState({ url: '', type: '' })

  const searchParams = useSearchParams()
  const router = useRouter()
  const hackAddr = searchParams.get('hackAddr')
  const urlChainId = searchParams.get('chainId')
  
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  
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

  const short = (addr: string) => `${addr.slice(0,6)}...${addr.slice(-4)}`

  // Handle opening external links with modal
  const handleOpenLink = (url: string, type: string) => {
    setModalLink({ url, type })
    setModalOpen(true)
  }

  // Format token amounts for display
  const formatTokenAmount = (amount: bigint, token: string): string => {
    if (token === '0x0000000000000000000000000000000000000000') {
      // ETH - convert from wei to ether for display with up to 4 decimal places
      const etherValue = Number(formatEther(amount))
      const result = etherValue.toFixed(4)
      // Remove trailing zeros and decimal point if not needed
      return parseFloat(result).toString()
    } else {
      // ERC20 - convert using token decimals for display
      const decimals = tokenDecimals[token] ?? 18
      const divisor = BigInt(10) ** BigInt(decimals)
      const wholeTokens = amount / divisor
      const result = wholeTokens.toString()
      return result
    }
  }

  // Manual sync function for the sync button
  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    await fetchHackathonData()
    setSyncing(false)
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
        totalTokens,
        concluded,
        organizer,
        factory,
        judgeCount,
        projectCount,
        imageURL,
      ] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'imageURL' }) as Promise<string>,
      ])

      // Load approved tokens and their symbols
      let localApprovedTokens: string[] = []
      let localTokenTotals: Record<string, bigint> = {}
      let localTokenSymbols: Record<string, string> = {}
      try {
        const tokens = await publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'getDepositedTokensList' }) as string[]
        setApprovedTokens(tokens)
        const symbols: Record<string, string> = {}
        const totals: Record<string, bigint> = {}
        const decimalsMap: Record<string, number> = {}
        for (const t of tokens) {
          try {
            const total = await publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'getTokenTotal', args: [t as `0x${string}`] }) as bigint
            totals[t] = total
          } catch (e) {
            totals[t] = BigInt(0)
          }
          try {
            if (t === '0x0000000000000000000000000000000000000000') {
              symbols[t] = 'ETH'
              decimalsMap[t] = 18
            } else {
              const sym = await publicClient.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }) as string
              symbols[t] = sym
              try {
                const dec = await publicClient.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }) as number
                decimalsMap[t] = dec
              } catch {}
            }
          } catch {
            symbols[t] = t === '0x0000000000000000000000000000000000000000' ? 'ETH' : short(t)
            if (t === '0x0000000000000000000000000000000000000000') {
              decimalsMap[t] = 18
            }
          }
        }
        setTokenSymbols(symbols)
        setTokenTotals(totals)
        setTokenDecimals(decimalsMap)
        localApprovedTokens = tokens
        localTokenTotals = totals
        localTokenSymbols = symbols
      } catch (e) {
        setApprovedTokens([])
        setTokenSymbols({})
        setTokenTotals({})
        localApprovedTokens = []
        localTokenTotals = {}
        localTokenSymbols = {}
      }

      // Fetch judges
      const judges: Judge[] = []
      if (Number(judgeCount) > 0) {
        try {
          const judgeAddresses = await publicClient.readContract({ 
            address: contractAddress, 
            abi: HACKHUB_ABI, 
            functionName: 'getAllJudges'
          }) as string[]

          for (let i = 0; i < judgeAddresses.length; i++) {
            try {
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
                name: `Judge ${i + 1}`,
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
            const [projectInfo, projectTokens, prizeClaimed] = await Promise.all([
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'projects',
                args: [BigInt(i)]
              }) as Promise<[string, string, string, string, string]>,
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'projectTokens',
                args: [BigInt(i)]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'prizeClaimed',
                args: [BigInt(i)]
              }) as Promise<boolean>
            ])

            const total = Number(totalTokens)
            const sharePercent = total > 0 ? (Number(projectTokens) / total) * 100 : 0
            const payouts = localApprovedTokens.map((t) => {
              const poolTotal = localTokenTotals[t] ?? BigInt(0)
              const denom = totalTokens === BigInt(0) ? BigInt(1) : totalTokens
              const amount = (poolTotal * (projectTokens as bigint)) / denom
              return { token: t, amount: Math.floor(Number(amount)).toString(), symbol: localTokenSymbols[t] }
            })
            projects.push({
              id: i,
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
          } catch (projectError) {
            console.error(`Error fetching project ${i}:`, projectError)
          }
        }
      }

      const hackathon: HackathonData = {
        id: 0,
        contractAddress,
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
        image: imageURL || getImagePath("/block.png"),
      }

      setHackathonData(hackathon)
      setLastSynced(new Date())
    } catch (err) {
      console.error('Error fetching hackathon data:', err)
      setError('Failed to load hackathon data from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort projects
  useEffect(() => {
    if (!hackathonData?.projects) {
      setFilteredProjects([])
      return
    }

    let filtered = hackathonData.projects

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.submitter.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.recipient.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'votes-desc':
          return b.tokensReceived - a.tokensReceived
        case 'votes-asc':
          return a.tokensReceived - b.tokensReceived
        case 'name-asc':
          return (a.name || `Project ${a.id}`).localeCompare(b.name || `Project ${b.id}`)
        case 'name-desc':
          return (b.name || `Project ${b.id}`).localeCompare(a.name || `Project ${a.id}`)
        case 'recent':
          return b.id - a.id
        case 'oldest':
          return a.id - b.id
        default:
          return b.tokensReceived - a.tokensReceived
      }
    })

    setFilteredProjects(sorted)
  }, [hackathonData?.projects, searchTerm, sortBy])

  // Load data on mount
  useEffect(() => {
    fetchHackathonData()
  }, [contractAddress, chainId])

  // Show error if no hackAddr provided
  if (!hackAddr) {
    return (
      <div className="container mx-auto py-8">
        <Alert className="max-w-md mx-auto">
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
      <div className="container mx-auto py-8">
        <Alert className="max-w-md mx-auto">
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
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{color: '#8B6914'}} />
            <p className="text-muted-foreground">Loading hackathon projects...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !hackathonData) {
    return (
      <div className="container mx-auto py-8">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <span>{error || 'Hackathon not found'}</span>
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

  const getStatusBadge = () => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Upcoming</Badge>
      case 'accepting-submissions':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Accepting Submissions</Badge>
      case 'judging-submissions':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Judging Submissions</Badge>
      case 'concluded':
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white">Concluded</Badge>
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white">Unknown</Badge>
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Left: Back Button */}
        <div className="flex items-center gap-4">
          <Link href={`/?hackAddr=${hackAddr}&chainId=${urlChainId}`}>
            <Button variant="outline" size="sm" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hackathon
            </Button>
          </Link>
        </div>

        {/* Center: Title and Info */}
        <div className="flex-1 text-center space-y-2">
          <div className="flex items-center justify-center gap-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
              {hackathonData.hackathonName} - Projects
            </h1>
            {getStatusBadge()}
          </div>
          <p className="text-muted-foreground">
            {hackathonData.projects.length} projects submitted • Total voting tokens: {hackathonData.totalTokens}
          </p>
        </div>

        {/* Right: Sync Button */}
        <div>
          <Button
            onClick={handleSync}
            disabled={syncing || loading}
            className="bg-white/20 backdrop-blur-sm text-black border border-gray-300 hover:bg-white/30 hover:border-white/50 transition-all duration-200 flex items-center gap-2"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="bg-white border-gray-300">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search projects by name, submitter, or recipient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-gray-300"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="votes-desc">Most Votes</SelectItem>
                  <SelectItem value="votes-asc">Least Votes</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="recent">Recently Submitted</SelectItem>
                  <SelectItem value="oldest">Oldest Submissions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card className="bg-white border-gray-300">
          <CardContent className="p-12 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {hackathonData.projects.length === 0 ? 'No Projects Submitted' : 'No Projects Found'}
            </h3>
            <p className="text-gray-600">
              {hackathonData.projects.length === 0 
                ? 'No projects have been submitted to this hackathon yet.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="bg-white border-gray-300 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg text-black">
                        {project.name || `Project #${project.id}`}
                      </CardTitle>
                      {project.prizeClaimed && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <Award className="w-3 h-3 mr-1" />
                          Prize Claimed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <span>Submitted by:</span>
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                          {project.submitter.slice(2, 4).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono">{short(project.submitter)}</span>
                    </div>
                    {project.recipient !== project.submitter && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Prize recipient:</span>
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="text-xs bg-green-100 text-green-700">
                            {project.recipient.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-mono">{short(project.recipient)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <Vote className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-lg text-black">{project.tokensReceived}</span>
                    </div>
                    <p className="text-xs text-gray-600">votes received</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Prize Information */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-sm text-gray-800">Prize Breakdown</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{project.formattedPrize}</p>
                    {project.payouts && project.payouts.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {project.payouts.map((payout, idx) => (
                          <div key={idx} className="text-xs text-gray-700 bg-white rounded px-2 py-1">
                            <span className="font-medium">{payout.symbol === 'ETH' ? 'Native ETH' : payout.symbol}:</span> {payout.amount}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Project Links */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenLink(project.sourceCode, 'Source Code')}
                      className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                    >
                      <Code className="w-4 h-4" />
                      Source Code
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenLink(project.docs, 'Documentation')}
                      className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                    >
                      <FileText className="w-4 h-4" />
                      Documentation
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* External Link Warning Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#8B6914]">
              <AlertCircle className="w-5 h-5" />
              External Link Warning
            </DialogTitle>
            <DialogDescription>
              You are about to visit an external website. Please verify the URL before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">{modalLink.type} URL:</Label>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-sm font-mono text-gray-800 break-all">{modalLink.url}</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.open(modalLink.url, '_blank', 'noopener,noreferrer')
                setModalOpen(false)
              }}
              className="hover:bg-[#8B6914] hover:text-white hover:border-amber-300 bg-[#FAE5C3] text-gray-800 border-none"
            >
              Open Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
