"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import HackathonCard from "@/components/hackathon-card"
import { HackathonData, getHackathonStatus } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { categories, featuredHackathons } from "@/lib/data"
import { Search, Filter, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, TestTube } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useChainId, useAccount } from "wagmi"
import { Badge } from "@/components/ui/badge"

export default function ExplorerPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [statusFilter, setStatusFilter] = useState("All Status")
  const [useMockData, setUseMockData] = useState(false)
  
  const [blockchainHackathons, setBlockchainHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chainId = useChainId()
  const { isConnected } = useAccount()

  // Use mock data if enabled or if there's an error and no blockchain data
  const hackathons = useMockData || (error && blockchainHackathons.length === 0) 
    ? featuredHackathons.map(h => ({
        ...h,
        startDate: parseInt(new Date(h.startTime * 1000).toISOString().slice(0, 10).replace(/-/g, '')), // Convert to YYYYMMDD
        endDate: parseInt(new Date(h.endTime * 1000).toISOString().slice(0, 10).replace(/-/g, '')), // Convert to YYYYMMDD
        description: h.description || undefined,
        image: h.image || undefined,
        tags: h.tags || undefined,
      }))
    : blockchainHackathons

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

  // Fetch hackathons directly via wagmi
  const loadHackathons = async () => {
    try {
      setLoading(true)
      setError(null)

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}. Please connect to Scroll Sepolia (Chain ID: 534351).`)
        setBlockchainHackathons([])
        return
      }

      // Get counts
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

      const ongoing = Number(ongoingCount)
      const past = Number(pastCount)

      let addresses: `0x${string}`[] = []

      if (ongoing > 0) {
        const ongoingAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getOngoingHackathons',
          args: [BigInt(0), BigInt(ongoing - 1)],
        }) as `0x${string}`[]
        addresses = addresses.concat(ongoingAddrs)
      }

      if (past > 0) {
        const pastAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getPastHackathons',
          args: [BigInt(0), BigInt(past - 1)],
        }) as `0x${string}`[]
        addresses = addresses.concat(pastAddrs)
      }

      if (addresses.length === 0) {
        setBlockchainHackathons([])
        return
      }

      const hackathonPromises = addresses.map(async (addr, index) => {
        try {
          const [
            hackathonName,
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
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'hackathonName' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'prizePool' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
          ])

          const hackathon: HackathonData = {
            id: index,
            contractAddress: addr,
            hackathonName,
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
            description: `Web3 Hackathon with ${formatEther(prizePool)} ETH prize pool`,
            image: "/placeholder.svg?height=200&width=400",
            tags: ["Web3", "Blockchain"],
          }

          return hackathon
        } catch (err) {
          console.error(`Error fetching hackathon ${addr}:`, err)
          return null
        }
      })

      const results = await Promise.all(hackathonPromises)
      const validHackathons = results.filter((h): h is HackathonData => h !== null)

      setBlockchainHackathons(validHackathons)
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
                         (hackathon.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (hackathon.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         hackathon.judges.some(judge => judge.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // Category filter
    const matchesCategory = selectedCategory === "All Categories" || 
                           (hackathon.tags || []).includes(selectedCategory)
    
    // Status filter
    let matchesStatus = true
    if (statusFilter !== "All Status") {
      const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
      matchesStatus = statusFilter.toLowerCase() === status
    }
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  // Sort hackathons by status priority (active first, then upcoming, then ended/concluded)
  const sortedHackathons = filteredHackathons.sort((a, b) => {
    const statusA = getHackathonStatus(a.startTime, a.endTime, a.concluded)
    const statusB = getHackathonStatus(b.startTime, b.endTime, b.concluded)
    
    const statusPriority = { 'active': 0, 'upcoming': 1, 'ended': 2, 'concluded': 3 }
    return statusPriority[statusA] - statusPriority[statusB]
  })

  if (loading) {
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setUseMockData(!useMockData)}
                className="text-xs"
              >
                <TestTube className="w-3 h-3 mr-1" />
                {useMockData ? 'Show Blockchain' : 'Show Demo Data'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadHackathons}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
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
        <p className="text-muted-foreground text-lg">Discover amazing Web3 hackathons and join the innovation</p>
        
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search hackathons, judges, or categories..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 flex-wrap lg:flex-nowrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Status">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
              <SelectItem value="concluded">Concluded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {sortedHackathons.length} hackathon{sortedHackathons.length !== 1 ? 's' : ''}
          {selectedCategory !== "All Categories" && ` in ${selectedCategory}`}
          {statusFilter !== "All Status" && ` with status: ${statusFilter}`}
          {searchTerm && ` matching "${searchTerm}"`}
          <Badge variant="secondary" className="ml-2 text-xs">
            {useMockData ? 'Demo Data' : 'Live Blockchain Data'}
          </Badge>
        </div>
        
        {(selectedCategory !== "All Categories" || statusFilter !== "All Status" || searchTerm) && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSearchTerm("")
              setSelectedCategory("All Categories")
              setStatusFilter("All Status")
            }}
            className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Hackathons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedHackathons.map((hackathon) => (
          <HackathonCard key={hackathon.contractAddress} hackathon={hackathon} />
        ))}
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
      {sortedHackathons.length > 0 && (
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
              <div className="text-2xl font-bold text-green-600">
                {hackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'active').length}
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
      )}
    </div>
  )
}
