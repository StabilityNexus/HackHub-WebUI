"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  const basePath = process.env.NODE_ENV === 'production' ? '/HackHub-WebUI' : '';
  return `${basePath}${path}`;
};
import { HackathonData, getHackathonStatus } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { Search, Filter, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, Calendar, DollarSign } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useChainId, useAccount } from "wagmi"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'
import Image from "next/image"

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

export default function ExplorerPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [statusFilter, setStatusFilter] = useState("All Status")
  
  const [hackathons, setHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chainId = useChainId()
  const { isConnected } = useAccount()

  // Helper function to format prize amounts
  const formatPrizeAmount = (hackathon: HackathonData) => {
    if (hackathon.isERC20Prize && hackathon.prizeTokenSymbol) {
      return `${parseFloat(hackathon.prizePool).toFixed(2)} ${hackathon.prizeTokenSymbol}`
    }
    return `${parseFloat(hackathon.prizePool).toFixed(2)} ETH`
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

  // Fetch hackathons directly via wagmi
  const loadHackathons = async () => {
    try {
      setLoading(true)
      setError(null)

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
        setHackathons([])
        return
      }

      // Get counts using the optimized getCounts function
      const [ongoingCount, pastCount] = await publicClient.readContract({
        address: factoryAddress,
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'getCounts',
      }) as [bigint, bigint]

      const ongoing = Number(ongoingCount)
      const past = Number(pastCount)

      let addresses: `0x${string}`[] = []

      if (ongoing > 0) {
        const ongoingAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getHackathons',
          args: [BigInt(0), BigInt(ongoing - 1), true],
        }) as `0x${string}`[]
        addresses = addresses.concat(ongoingAddrs)
      }

      if (past > 0) {
        const pastAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getHackathons',
          args: [BigInt(0), BigInt(past - 1), false],
        }) as `0x${string}`[]
        addresses = addresses.concat(pastAddrs)
      }

      if (addresses.length === 0) {
        setHackathons([])
        return
      }

      const hackathonPromises = addresses.map(async (addr, index) => {
        try {
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
            isERC20Prize,
            prizeToken,
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
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'isERC20Prize' }) as Promise<boolean>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'prizeToken' }) as Promise<string>,
          ])

          // Get token symbol if it's an ERC20 prize
          let tokenSymbol = "ETH"
          if (isERC20Prize && prizeToken !== "0x0000000000000000000000000000000000000000") {
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
            prizePool: formatEther(prizePool),
            totalTokens: Number(totalTokens),
            concluded,
            organizer,
            factory,
            judgeCount: Number(judgeCount),
            projectCount: Number(projectCount),
            judges: [],
            projects: [],
            image: imageURL || getImagePath("/block.png"),
            isERC20Prize,
            prizeTokenSymbol: tokenSymbol,
          }

          return hackathon
        } catch (err) {
          console.error(`Error fetching hackathon ${addr}:`, err)
          return null
        }
      })

      const results = await Promise.all(hackathonPromises)
      const validHackathons = results.filter((h): h is HackathonData => h !== null)

      setHackathons(validHackathons)
    } catch (err) {
      console.error('Error loading hackathons:', err)
      setError('Failed to load hackathons from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Initial load & reload on network change
  useEffect(() => {
    loadHackathons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId])

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

  // Sort hackathons by status priority (accepting-submissions first, then upcoming, then judging-submissions/concluded)
  const sortedHackathons = filteredHackathons.sort((a, b) => {
    const statusA = getHackathonStatus(a.startTime, a.endTime, a.concluded)
    const statusB = getHackathonStatus(b.startTime, b.endTime, b.concluded)
    
    const statusPriority = { 'accepting-submissions': 0, 'upcoming': 1, 'judging-submissions': 2, 'concluded': 3 }
    return statusPriority[statusA] - statusPriority[statusB]
  })

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
            <Button variant="outline" size="sm" onClick={loadHackathons}>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
          Explore Hackathons
        </h1>
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

      {/* Hackathons List */}
      <div className="space-y-8">
        {/* Active Hackathons */}
        {sortedHackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'accepting-submissions').length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-amber-800 border-b border-amber-200 pb-2">
              🔥 Active Hackathons
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedHackathons
                .filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'accepting-submissions')
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
                            <Badge className={`text-xs font-medium px-3 py-1 bg-orange-100 text-orange-800 border-orange-200 shadow-sm`}>
                              🔥 {status === 'accepting-submissions' ? 'ACCEPTING SUBMISSIONS' : 
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

        {/* Other Hackathons */}
        {sortedHackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) !== 'accepting-submissions').length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-700 border-b border-gray-200 pb-2">
              Upcoming & Past Hackathons
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedHackathons
                .filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) !== 'accepting-submissions')
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
                          status === 'upcoming' 
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
                            <Badge className={`text-xs font-medium px-3 py-1 bg-orange-100 text-orange-800 border-orange-200 shadow-sm`}>
                              {status === 'upcoming' && '⏰'} 
                              {status === 'judging-submissions' && '⚖️'} 
                              {status === 'concluded' && '✅'} 
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
      </div>

      {/* No Results */}
      {sortedHackathons.length === 0 && hackathons.length > 0 && (
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
              setSelectedCategory("All Categories")
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
