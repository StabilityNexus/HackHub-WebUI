"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  const basePath = process.env.NODE_ENV === 'production' ? '/HackHub-WebUI' : '';
  return `${basePath}${path}`;
};
import { HackathonData, getHackathonStatus, getDaysRemaining } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { Search, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, Calendar, DollarSign, User, ArrowLeft, Trophy, Code, Gavel, Vote, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useChainId, useAccount } from "wagmi"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { hackathonDB } from "@/lib/indexedDB"

interface OrganizerClientProps {
  address: string
}

export default function OrganizerClient({ address }: OrganizerClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All Status")
  
  const [hackathons, setHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalHackathons, setTotalHackathons] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const organizerAddress = address
  const ITEMS_PER_PAGE = 6

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

  // Format date function - now using UTC in 24-hour format
  const formatDate = (timestamp: number) => {
    return formatUTCTimestamp(timestamp)
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepting-submissions': return 'bg-green-100 text-green-800 border-green-200'
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'judging-submissions': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'concluded': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Validate organizer address format
  const isValidAddress = organizerAddress && organizerAddress.match(/^0x[a-fA-F0-9]{40}$/)

  // Initialize page from URL on mount
  useEffect(() => {
    const pageParam = Number(searchParams?.get('page') || '1')
    if (!Number.isNaN(pageParam) && pageParam > 0) {
      setCurrentPage(pageParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect page to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString())
    params.set('page', String(currentPage))
    params.set('address', organizerAddress)
    router.replace(`/organizer?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // Load organizer's hackathons with cache-first approach
  const loadOrganizerHackathons = async (forceSync = false) => {
    if (!isValidAddress) {
      setError('Invalid organizer address format')
      setLoading(false)
      return
    }

    try {
      setLoading(!forceSync) // Don't show loading spinner if it's a sync
      if (forceSync) setSyncing(true)
      setError(null)

      // Try to load from cache first (unless force syncing)
      if (!forceSync) {
        const hasFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
        const cacheKey = hasFilters ? `organizer_all_${organizerAddress}` : `organizer_page_${organizerAddress}_${currentPage}`
        const cachedData = await hackathonDB.getOrganizerHackathons(organizerAddress, chainId)
        if (cachedData) {
          setHackathons(cachedData.hackathons)
          setTotalHackathons(cachedData.totalHackathons)
          setLoading(false)
          setLastSyncTime(new Date())
          // Do not return; still refresh from chain to ensure up-to-date data
        }
      }

      // Fetch from blockchain
      await fetchOrganizerDataFromBlockchain()
    } catch (err) {
      console.error('Error loading organizer hackathons:', err)
      setError('Failed to load hackathons from blockchain')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  // Fetch organizer's hackathons from blockchain
  const fetchOrganizerDataFromBlockchain = async () => {
    try {

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
        setHackathons([])
        return
      }

      // Get all hackathon addresses using the optimized getCounts function
      const [ongoingCount, pastCount] = await publicClient.readContract({
        address: factoryAddress,
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'getCounts',
      }) as [bigint, bigint]

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

      if (allAddresses.length === 0) {
        setHackathons([])
        return
      }

      // Filter hackathons by organizer first to get total count
      const organizerAddresses: `0x${string}`[] = []
      for (const addr of allAddresses) {
        try {
          const owner = await publicClient.readContract({
            address: addr,
            abi: HACKHUB_ABI,
            functionName: 'owner'
          }) as string
          
          if (owner.toLowerCase() === organizerAddress.toLowerCase()) {
            organizerAddresses.push(addr)
          }
        } catch (err) {
          console.error(`Error checking owner for ${addr}:`, err)
        }
      }

      setTotalHackathons(organizerAddresses.length)

      if (organizerAddresses.length === 0) {
        setHackathons([])
        return
      }

      // Always fetch full details for organizer to enable consistent client-side filtering and pagination
      const paginatedAddresses = organizerAddresses

      // Fetch detailed data for paginated hackathons
      const organizerHackathons: HackathonData[] = []
      for (const addr of paginatedAddresses) {
        try {
          const [
            owner,
            name,
            startDate,
            startTime,
            endDate,
            endTime,
            totalTokens,
            concluded,
            factory,
            judgeCount,
            projectCount,
            imageURL,
          ] = await Promise.all([
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'imageURL' }) as Promise<string>,
          ])
          
            const hackathon: HackathonData = {
              id: organizerHackathons.length,
              contractAddress: addr,
              hackathonName: name,
              startDate: Number(startDate),
              startTime: Number(startTime),
              endDate: Number(endDate),
              endTime: Number(endTime),
              prizePool: '0',
              totalTokens: Number(totalTokens),
              concluded,
              organizer: owner,
              factory,
              judgeCount: Number(judgeCount),
              projectCount: Number(projectCount),
              judges: [],
              projects: [],
              image: imageURL || getImagePath("/block.png"),
            description: `Web3 Hackathon with sponsored multi-token prize pool`,
          }
          organizerHackathons.push(hackathon)
        } catch (err) {
          console.error(`Error fetching hackathon ${addr}:`, err)
        }
      }

      setHackathons(organizerHackathons)
      setLastSyncTime(new Date())
      
      // Update cache
      await hackathonDB.setOrganizerHackathons(organizerAddress, chainId, {
        hackathons: organizerHackathons,
        totalHackathons: organizerAddresses.length
      })
    } catch (err) {
      console.error('Error loading organizer hackathons from blockchain:', err)
      throw err // Re-throw to be caught by loadOrganizerHackathons
    }
  }

  // Handle sync button click
  const handleSync = () => {
    loadOrganizerHackathons(true)
  }

  // Helper function to format prize amounts
  const formatPrizeAmount = (_hackathon: HackathonData) => {
    return "Sponsored multi-token pool"
  }

  // Initial load & reload on network change and page change
  useEffect(() => {
    if (isValidAddress) {
      loadOrganizerHackathons()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, organizerAddress, currentPage])

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const filteredHackathons = hackathons.filter(hackathon => {
    // Search filter
    const matchesSearch = hackathon.hackathonName.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Status filter
    let matchesStatus = true
    if (statusFilter !== "All Status") {
      const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
      matchesStatus = statusFilter.toLowerCase() === status
    }
    
    return matchesSearch && matchesStatus
  })

  // Sort hackathons by status priority (active first, then upcoming, then ended/concluded)
  const sortedHackathons = filteredHackathons.sort((a, b) => {
    const statusA = getHackathonStatus(a.startTime, a.endTime, a.concluded)
    const statusB = getHackathonStatus(b.startTime, b.endTime, b.concluded)
    
    const statusPriority: Record<string, number> = { 'accepting-submissions': 0, 'upcoming': 1, 'judging-submissions': 2, 'concluded': 3 }
    return (statusPriority[statusA] || 3) - (statusPriority[statusB] || 3)
  })

  // Check if we have active filters
  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
  
  // Calculate pagination info based on whether filters are active
  const effectiveTotal = hasActiveFilters ? filteredHackathons.length : totalHackathons
  const totalPages = Math.ceil(effectiveTotal / ITEMS_PER_PAGE)
  
  // For display: always paginate client-side (cache stores full list)
  const displayHackathons = sortedHackathons.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, effectiveTotal)

  // Render organizing card (from myHackathons page design)
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
                  {status === 'accepting-submissions' ? 'Accepting submissions' : 
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

  if (!isValidAddress) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="flex items-center gap-2 border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid organizer address format. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="flex items-center gap-2 border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
            Organizer's Events
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <User className="w-5 h-5" />
            <span className="font-mono text-sm">
              {organizerAddress.slice(0, 6)}...{organizerAddress.slice(-4)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-600" />
            <p className="text-muted-foreground">Loading organizer's hackathons...</p>
            <p className="text-sm text-muted-foreground">
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
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="flex items-center gap-2 border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
            Organizer's Events
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <User className="w-5 h-5" />
            <span className="font-mono text-sm">
              {organizerAddress.slice(0, 6)}...{organizerAddress.slice(-4)}
            </span>
          </div>
          
          {/* Network Status */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span>Connected to {getNetworkName(chainId)}</span>
                <Badge variant="outline" className="ml-2">Chain ID: {chainId}</Badge>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span>Wallet not connected</span>
              </>
            )}
          </div>
        </div>
        
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="space-y-2">
              <span>{error}</span>
              {!isConnected && (
                <p className="text-sm text-muted-foreground">
                  Please connect your wallet to view hackathons.
                </p>
              )}
              {isConnected && chainId !== 534351 && (
                <p className="text-sm text-muted-foreground">
                  Switch to Scroll Sepolia network to view hackathons.
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => loadOrganizerHackathons(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with back button and title in line */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="flex items-center gap-2 border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
          Organizer's Events
        </h1>
        
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
      
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <User className="w-5 h-5" />
          <span className="font-mono text-sm">
            {organizerAddress.slice(0, 6)}...{organizerAddress.slice(-4)}
          </span>
        </div>
        {hackathons.length > 0 && (
          <p className="text-muted-foreground text-lg">
            {hackathons.length} event{hackathons.length !== 1 ? 's' : ''} organized
          </p>
        )}
      </div>

      {hackathons.length > 0 && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search hackathons..." 
                className="pl-10 bg-white text-[#8B6914]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 flex-wrap lg:flex-nowrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[140px] bg-white text-[#8B6914]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Status">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="accepting-submissions">Accepting Submissions</SelectItem>
                  <SelectItem value="judging-submissions">Judging Submissions</SelectItem>
                  <SelectItem value="concluded">Concluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Info */}
          {effectiveTotal > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {startItem}-{endItem} of {effectiveTotal} hackathons
                {hasActiveFilters && ` (filtered from ${totalHackathons} total)`}
              </span>
              <span>
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}

          {/* Hackathons List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayHackathons.map(renderOrganizingCard)}
                              </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={currentPage === pageNum 
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
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              </div>
            )}
        </>
      )}

      {/* Empty State - No hackathons found for this organizer */}
      {hackathons.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No events found</h3>
          <p className="text-muted-foreground mb-4">
            This organizer hasn't created any hackathons yet on this network.
          </p>
          <Link href="/explorer">
            <Button className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white">
              Explore All Hackathons
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
} 