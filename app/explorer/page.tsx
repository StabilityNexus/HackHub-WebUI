"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  return path;
};
import { HackathonData, getHackathonStatus } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { Search, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, Calendar, DollarSign, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useChainId, useAccount } from "wagmi"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'
import Image from "next/image"
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

function ExplorerPageContent() {
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

  const ITEMS_PER_PAGE = 8;

  // Helper function to format prize amounts
  const formatPrizeAmount = (_hackathon: HackathonData) => {
    return "Sponsored multi-token pool"
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

  // Format date function - now using UTC in 24-hour format
  const formatDate = (timestamp: number) => {
    return formatUTCTimestamp(timestamp)
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

      // Get image URL
      let imageURL = ""
      try {
        imageURL = await publicClient.readContract({
          address: addr,
          abi: HACKHUB_ABI,
          functionName: 'imageURL',
        }) as string
      } catch (err) {
        console.error('Error fetching image URL:', err)
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
        judges: [],
        projects: [],
        image: imageURL || getImagePath("/block.png"),
      }

      return hackathon
    } catch (err) {
      console.error(`Error fetching hackathon ${addr}:`, err)
      return null
    }
  }

  // Load hackathons with cache-first approach
  const loadHackathons = async (forceSync = false) => {
    try {
      setLoading(!forceSync) // Don't show loading spinner if it's a sync
      if (forceSync) setSyncing(true)
      setError(null)

      // Try to load from cache first (unless force syncing)
      if (!forceSync) {
        const hasFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
        const cacheKey = hasFilters ? `explorer_all` : `explorer_page_${currentPage}`
        const cachedData = await hackathonDB.getHackathons(cacheKey, chainId)
        if (cachedData && cachedData.length > 0) {
          setHackathons(cachedData)
          // For cached data, we need to estimate totalHackathons for pagination
          // If it's a paginated cache (no filters), we know there are at least currentPage worth of data
          // If it's a filtered cache, we use the cached data length
          if (hasFilters) {
            setTotalHackathons(cachedData.length)
          } else {
            // Estimate: if we're on page 2 with 6 items, there are at least 6+ items total
            const estimatedTotal = Math.max(cachedData.length, (currentPage - 1) * ITEMS_PER_PAGE + cachedData.length)
            setTotalHackathons(estimatedTotal)
          }
          setLoading(false)
          setLastSyncTime(new Date())
          // IMPORTANT: Do NOT return here. We still fetch from chain to ensure
          // totals and the specific page's data are up-to-date after navigation.
        }
      }

      // Fetch from blockchain
      await fetchFromBlockchain()
    } catch (err) {
      console.error('Error loading hackathons:', err)
      setError('Failed to load hackathons from blockchain')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  // Fetch hackathons from blockchain with pagination and proper ordering
  const fetchFromBlockchain = async () => {
    try {

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
        setHackathons([])
        return
      }

      // Get total counts
      const [ongoingCount, pastCount] = await publicClient.readContract({
        address: factoryAddress,
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'getCounts',
      }) as [bigint, bigint]

      const totalOngoing = Number(ongoingCount)
      const totalPast = Number(pastCount)
      const total = totalOngoing + totalPast
      
      setTotalHackathons(total)

      if (total === 0) {
        setHackathons([])
        const hasFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
        const cacheKey = hasFilters ? `explorer_all` : `explorer_page_${currentPage}`
        await hackathonDB.setHackathons(cacheKey, chainId, [])
        return
      }

      // Check if we need to fetch all data (for client-side filtering) or paginated data
      const needsAllData = searchTerm.trim() !== "" || statusFilter !== "All Status"
      
      let startIndex = 0
      let endIndex = total - 1
      
      if (!needsAllData) {
        // Only paginate at blockchain level if no filters are active
        startIndex = (currentPage - 1) * ITEMS_PER_PAGE
        endIndex = Math.min(startIndex + ITEMS_PER_PAGE - 1, total - 1)
      }

      // Fetch hackathons in order: ongoing first, then past
      let addresses: `0x${string}`[] = []
      
      // Get ongoing hackathons
      if (totalOngoing > 0) {
        if (startIndex < totalOngoing) {
          const actualStart = Math.max(0, startIndex)
          const actualEnd = Math.min(totalOngoing - 1, endIndex)
          
          const ongoingAddrs = await publicClient.readContract({
            address: factoryAddress,
            abi: HACKHUB_FACTORY_ABI,
            functionName: 'getHackathons',
            args: [BigInt(actualStart), BigInt(actualEnd), true],
          }) as `0x${string}`[]
          addresses = addresses.concat(ongoingAddrs)
        }
      }

      // Get past hackathons if needed
      if (totalPast > 0 && endIndex >= totalOngoing) {
        const pastStartIndex = Math.max(0, startIndex - totalOngoing)
        const pastEndIndex = Math.min(totalPast - 1, endIndex - totalOngoing)
        
        if (pastStartIndex <= pastEndIndex) {
          const pastAddrs = await publicClient.readContract({
            address: factoryAddress,
            abi: HACKHUB_FACTORY_ABI,
            functionName: 'getHackathons',
            args: [BigInt(pastStartIndex), BigInt(pastEndIndex), false],
          }) as `0x${string}`[]
          addresses = addresses.concat(pastAddrs)
        }
      }

      if (addresses.length === 0) {
        setHackathons([])
        const hasFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
        const cacheKey = hasFilters ? `explorer_all` : `explorer_page_${currentPage}`
        await hackathonDB.setHackathons(cacheKey, chainId, [])
        return
      }

      // Fetch hackathon details
      const hackathonPromises = addresses.map((addr, index) => fetchHackathonDetails(addr, index))
      const results = await Promise.all(hackathonPromises)
      const validHackathons = results.filter((h): h is HackathonData => h !== null)

      // Sort by status priority: active, judging, upcoming, past
      const sortedHackathons = validHackathons.sort((a, b) => {
        const statusA = getHackathonStatus(a.startTime, a.endTime, a.concluded)
        const statusB = getHackathonStatus(b.startTime, b.endTime, b.concluded)
        
        const statusPriority: Record<string, number> = { 
          'accepting-submissions': 0, 
          'judging-submissions': 1, 
          'upcoming': 2, 
          'concluded': 3 
        }
        return (statusPriority[statusA] || 3) - (statusPriority[statusB] || 3)
      })

      setHackathons(sortedHackathons)
      setLastSyncTime(new Date())
      
      // Update cache
      const hasFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
      const cacheKey = hasFilters ? `explorer_all` : `explorer_page_${currentPage}`
      await hackathonDB.setHackathons(cacheKey, chainId, sortedHackathons)
    } catch (err) {
      console.error('Error loading hackathons from blockchain:', err)
      throw err // Re-throw to be caught by loadHackathons
    }
  }

  // Handle sync button click
  const handleSync = () => {
    loadHackathons(true)
  }

  // Initial load & reload on network change and page change
  useEffect(() => {
    loadHackathons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, currentPage])

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  // Initialize page from URL
  useEffect(() => {
    const pageParam = searchParams?.get('page')
    const pageNum = pageParam ? Number(pageParam) : 1
    if (!Number.isNaN(pageNum) && pageNum > 0 && pageNum !== currentPage) {
      setCurrentPage(pageNum)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update URL when page changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString())
    params.set('page', String(currentPage))
    const q = params.toString()
    router.replace(`/explorer?${q}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // Apply client-side filtering to the fetched hackathons
  const filteredHackathons = hackathons.filter(hackathon => {
    // Search filter
    const matchesSearch = hackathon.hackathonName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         hackathon.judges.some(judge => judge.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // Status filter
    let matchesStatus = true
    if (statusFilter !== "All Status") {
      const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
      matchesStatus = statusFilter === status
    }
    
    return matchesSearch && matchesStatus
  })

  // Check if we have active filters
  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "All Status"
  
  // Calculate pagination info based on whether filters are active
  const effectiveTotal = hasActiveFilters ? filteredHackathons.length : totalHackathons
  const totalPages = Math.ceil(effectiveTotal / ITEMS_PER_PAGE)
  
  // Debug pagination
  console.log('Explorer pagination debug:', {
    hasActiveFilters,
    hackathonsLength: hackathons.length,
    filteredLength: filteredHackathons.length,
    totalHackathons,
    effectiveTotal,
    totalPages,
    currentPage,
    loading
  })
  
  // For display: if filters are active, paginate the filtered results client-side
  const displayHackathons = hasActiveFilters 
    ? filteredHackathons.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : filteredHackathons // Already paginated at blockchain level
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, effectiveTotal)

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
            Explore Hackathons
          </h1>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-600" />
            <p className="text-muted-foreground">Loading hackathons from blockchain...</p>
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
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
            Explore Hackathons
          </h1>
          <p className="text-muted-foreground text-lg">Discover amazing Web3 hackathons and join the innovation</p>
          
          {/* Network Status */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-amber-500" />
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
            <Button variant="outline" size="sm" onClick={() => loadHackathons(true)}>
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
      <div className="text-center space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1"></div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
            Explore Hackathons
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

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search hackathons, judges, or categories..." 
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
      <div className="space-y-8">
        {/* Active, Upcoming & Judging Hackathons */}
        {displayHackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) !== 'concluded').length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-amber-800 border-b border-amber-200 pb-2">
              🔥 Active, Upcoming & Judging Hackathons
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayHackathons
                .filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) !== 'concluded')
                .sort((a, b) => {
                  const statusA = getHackathonStatus(a.startTime, a.endTime, a.concluded)
                  const statusB = getHackathonStatus(b.startTime, b.endTime, b.concluded)
                  
                  // Priority: active first, then upcoming, then judging
                  const statusPriority: Record<string, number> = { 
                    'accepting-submissions': 0, 
                    'upcoming': 1, 
                    'judging-submissions': 2,
                    'concluded': 3 // fallback, though this section filters out concluded
                  }
                  return (statusPriority[statusA] || 3) - (statusPriority[statusB] || 3)
                })
                .map((hackathon) => {
                  const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
                  return (
                    <Link 
                      key={hackathon.contractAddress} 
                      href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}
                      className="block"
                    >
                      <div className="bg-white border border-amber-100 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group relative h-full">
                        {/* Gradient background overlay based on status */}
                        <div className={`absolute inset-0 transition-all duration-300 ${
                          status === 'accepting-submissions' 
                            ? 'bg-gradient-to-b from-amber-50/60 via-orange-50/30 to-amber-50/60 group-hover:from-amber-100/60 group-hover:via-orange-100/30 group-hover:to-amber-100/60'
                            : status === 'upcoming' 
                            ? 'bg-gradient-to-b from-blue-50/60 via-indigo-50/30 to-blue-50/60 group-hover:from-blue-100/60 group-hover:via-indigo-100/30 group-hover:to-blue-100/60'
                            : status === 'judging-submissions'
                            ? 'bg-gradient-to-b from-orange-50/60 via-amber-50/30 to-orange-50/60 group-hover:from-orange-100/60 group-hover:via-amber-100/30 group-hover:to-orange-100/60'
                            : 'bg-gradient-to-b from-gray-50/60 via-slate-50/30 to-gray-50/60 group-hover:from-gray-100/60 group-hover:via-slate-100/30 group-hover:to-gray-100/60'
                        }`}></div>
                        
                        <div className="relative z-10 p-6 flex flex-col h-full">
                          {/* Top section - Image */}
                          <div className="flex justify-center mb-4">
                            <div className="h-20 w-20 relative group-hover:scale-105 transition-transform duration-300">
                              <Image
                                src={hackathon.image || getImagePath("/block.png")}
                                alt="Hackathon Image"
                                width={80}
                                height={80}
                                className="h-full w-full object-contain rounded-lg"
                                priority
                                onError={(e) => {
                                  // Fallback to block.png if custom image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.src = getImagePath("/block.png");
                                }}
                              />
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-700 transition-colors text-center mb-3 line-clamp-2">
                            {hackathon.hackathonName}
                          </h3>

                          {/* Status Badge */}
                          <div className="flex justify-center mb-4">
                            <Badge className={`text-xs font-medium px-3 py-1 shadow-sm ${
                              status === 'accepting-submissions' 
                                ? 'bg-orange-100 text-orange-800 border-orange-200'
                                : status === 'upcoming'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : status === 'judging-submissions'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {status === 'accepting-submissions' && '🔥'} 
                              {status === 'upcoming' && '⏰'} 
                              {status === 'judging-submissions' && '⚖️'} 
                              {status === 'accepting-submissions' ? 'ACCEPTING SUBMISSIONS' : 
                               status === 'judging-submissions' ? 'JUDGING SUBMISSIONS' :
                               status === 'upcoming' ? 'UPCOMING' : 'CONCLUDED'}
                            </Badge>
                          </div>

                          {/* Date */}
                          <div className="flex items-center justify-center gap-2 text-gray-600 mb-3">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs font-medium text-center">
                              {formatDate(hackathon.startTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                            <span className="text-xs font-medium text-center">
                              to {formatDate(hackathon.endTime)}
                            </span>
                          </div>

                          {/* Prize - Push to bottom */}
                          <div className="mt-auto">
                            <div className="flex items-center justify-center gap-2 text-amber-700 font-bold bg-amber-50 px-3 py-2 rounded-full border border-amber-200">
                              <DollarSign className="w-4 h-4" />
                              <span className="text-sm">{formatPrizeAmount(hackathon)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
            </div>
          </div>
        )}

        

        {/* Past Hackathons */}
        {displayHackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'concluded').length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-700 border-b border-gray-200 pb-2">
              ✅ Past Hackathons
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayHackathons
                .filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'concluded')
                .map((hackathon) => {
                  const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
                  return (
                    <Link 
                      key={hackathon.contractAddress} 
                      href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}
                      className="block"
                    >
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group relative h-full opacity-80 hover:opacity-100">
                        {/* Gradient background overlay for past hackathons */}
                        <div className="absolute inset-0 transition-all duration-300 bg-gradient-to-b from-gray-50/60 via-slate-50/30 to-gray-50/60 group-hover:from-gray-100/60 group-hover:via-slate-100/30 group-hover:to-gray-100/60"></div>
                        
                        <div className="relative z-10 p-6 flex flex-col h-full">
                          {/* Top section - Image */}
                          <div className="flex justify-center mb-4">
                            <div className="h-20 w-20 relative group-hover:scale-105 transition-transform duration-300">
                              <Image
                                src={hackathon.image || getImagePath("/block.png")}
                                alt="Hackathon Image"
                                width={80}
                                height={80}
                                className="h-full w-full object-contain rounded-lg grayscale group-hover:grayscale-0 transition-all duration-300"
                                priority
                                onError={(e) => {
                                  // Fallback to block.png if custom image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.src = getImagePath("/block.png");
                                }}
                              />
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-semibold text-gray-700 group-hover:text-gray-900 transition-colors text-center mb-3 line-clamp-2">
                            {hackathon.hackathonName}
                          </h3>

                          {/* Status Badge */}
                          <div className="flex justify-center mb-4">
                            <Badge className="text-xs font-medium px-3 py-1 bg-gray-100 text-gray-700 border-gray-200 shadow-sm">
                              ✅ CONCLUDED
                            </Badge>
                          </div>

                          {/* Date */}
                          <div className="flex items-center justify-center gap-2 text-gray-500 mb-3">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs font-medium text-center">
                              {formatDate(hackathon.startTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-gray-500 mb-4">
                            <span className="text-xs font-medium text-center">
                              to {formatDate(hackathon.endTime)}
                            </span>
                          </div>

                          {/* Prize - Push to bottom */}
                          <div className="mt-auto">
                            <div className="flex items-center justify-center gap-2 text-gray-600 font-bold bg-gray-50 px-3 py-2 rounded-full border border-gray-200">
                              <DollarSign className="w-4 h-4" />
                              <span className="text-sm">{formatPrizeAmount(hackathon)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {(totalPages > 1 || (!loading && currentPage > 1)) && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, Math.max(1, totalPages)) }, (_, i) => {
              const safeTotalPages = Math.max(1, totalPages)
              let pageNum
              if (safeTotalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= safeTotalPages - 2) {
                pageNum = safeTotalPages - 4 + i
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
            onClick={() => setCurrentPage(prev => Math.min(Math.max(1, totalPages), prev + 1))}
            disabled={currentPage === Math.max(1, totalPages)}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* No Results */}
      {displayHackathons.length === 0 && hackathons.length > 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No hackathons found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search terms, category, or status filter
          </p>
          <Button 
            onClick={() => {
              setSearchTerm("")
              setStatusFilter("All Status")
            }}
            className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white"
          >
            Show All Hackathons
          </Button>
        </div>
      )}

      {/* Empty State - No hackathons on blockchain */}
      {hackathons.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No hackathons found</h3>
          <p className="text-muted-foreground mb-4">
            No hackathons have been created on this network yet. Be the first to create one!
          </p>
          <Button className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white">
            Create First Hackathon
          </Button>
        </div>
      )}

      {/* Statistics */}
      {/* {sortedHackathons.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-100/50 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-center text-amber-800">Platform Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-700">
                {hackathons.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Hackathons</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {hackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'accepting-submissions').length}
              </div>
              <div className="text-sm text-muted-foreground">Active Now</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {hackathons.reduce((sum, h) => sum + parseFloat(h.prizePool), 0).toFixed(1)} ETH
              </div>
              <div className="text-sm text-muted-foreground">Total Prize Pool</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {hackathons.reduce((sum, h) => sum + h.projectCount, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Projects Submitted</div>
            </div>
          </div>
        </div>
      )} */}
    </div>
  )
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    }>
      <ExplorerPageContent />
    </Suspense>
  )
}
