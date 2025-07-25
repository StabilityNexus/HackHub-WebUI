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
import { Search, Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, Calendar, DollarSign, User, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useChainId, useAccount } from "wagmi"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'
import Image from "next/image"
import { useRouter } from "next/navigation"

interface OrganizerClientProps {
  address: string
}

export default function OrganizerClient({ address }: OrganizerClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All Status")
  
  const [hackathons, setHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const router = useRouter()
  
  const organizerAddress = address

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
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ended': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'concluded': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Validate organizer address format
  const isValidAddress = organizerAddress && organizerAddress.match(/^0x[a-fA-F0-9]{40}$/)

  // Fetch organizer's hackathons
  const loadOrganizerHackathons = async () => {
    if (!isValidAddress) {
      setError('Invalid organizer address format')
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

      // Filter and fetch hackathons by organizer
      const organizerHackathons: HackathonData[] = []
      for (const addr of allAddresses) {
        try {
          const [
            owner,
            name,
            startDate,
            startTime,
            endDate,
            endTime,
            prizePool,
            totalTokens,
            concluded,
            factory,
            judgeCount,
            projectCount,
          ] = await Promise.all([
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'prizePool' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
          ])
          
          if (owner.toLowerCase() === organizerAddress.toLowerCase()) {
            const hackathon: HackathonData = {
              id: organizerHackathons.length,
              contractAddress: addr,
              hackathonName: name,
              startDate: Number(startDate),
              startTime: Number(startTime),
              endDate: Number(endDate),
              endTime: Number(endTime),
              prizePool: formatEther(prizePool),
              totalTokens: Number(totalTokens),
              concluded,
              organizer: owner,
              factory,
              judgeCount: Number(judgeCount),
              projectCount: Number(projectCount),
              judges: [],
              projects: [],
              image: "/placeholder.svg?height=200&width=400",
            }
            organizerHackathons.push(hackathon)
          }
        } catch (err) {
          console.error(`Error fetching hackathon ${addr}:`, err)
        }
      }

      setHackathons(organizerHackathons)
    } catch (err) {
      console.error('Error loading organizer hackathons:', err)
      setError('Failed to load hackathons from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Initial load & reload on network change
  useEffect(() => {
    if (isValidAddress) {
      loadOrganizerHackathons()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, organizerAddress])

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
    
    const statusPriority = { 'active': 0, 'upcoming': 1, 'ended': 2, 'concluded': 3 }
    return statusPriority[statusA] - statusPriority[statusB]
  })

  if (!isValidAddress) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
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
            <Button variant="outline" size="sm" onClick={loadOrganizerHackathons}>
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
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="flex items-center gap-2"
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                  <SelectItem value="concluded">Concluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Hackathons List */}
          <div className="space-y-8">
            {/* Ongoing Hackathons */}
            {sortedHackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'active').length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-amber-800 border-b border-amber-200 pb-2">
                  🔥 Ongoing Hackathons
                </h2>
                <div className="space-y-4">
                  {sortedHackathons
                    .filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) === 'active')
                    .map((hackathon) => {
                      const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
                      return (
                        <Link 
                          key={hackathon.contractAddress} 
                          href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}
                          className="block"
                        >
                          <div className="w-full bg-white border border-amber-100 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group relative">
                            {/* Gradient background overlay based on status */}
                            <div className={`absolute inset-0 transition-all duration-300 ${
                              status === 'active' 
                                ? 'bg-gradient-to-r from-amber-50/60 via-orange-50/30 to-amber-50/60 group-hover:from-amber-100/60 group-hover:via-orange-100/30 group-hover:to-amber-100/60'
                                : status === 'upcoming' 
                                ? 'bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-blue-50/60 group-hover:from-blue-100/60 group-hover:via-indigo-100/30 group-hover:to-blue-100/60'
                                : status === 'ended'
                                ? 'bg-gradient-to-r from-orange-50/60 via-amber-50/30 to-orange-50/60 group-hover:from-orange-100/60 group-hover:via-amber-100/30 group-hover:to-orange-100/60'
                                : 'bg-gradient-to-r from-gray-50/60 via-slate-50/30 to-gray-50/60 group-hover:from-gray-100/60 group-hover:via-slate-100/30 group-hover:to-gray-100/60'
                            }`}></div>
                            
                            <div className="relative z-10 flex items-center justify-between p-6 min-h-[140px]">
                              {/* Left section - Name and Status */}
                              <div className="flex items-center gap-4 flex-1">
                                <div className="space-y-2">
                                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                                    {hackathon.hackathonName}
                                  </h3>
                                  <Badge className={`text-xs font-medium px-3 py-1 ${getStatusColor(status)} shadow-sm`}>
                                    🔥 {status.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>

                              {/* Center section - Block Image */}
                              <div className="flex-shrink-0 mx-8 relative h-full flex items-center">
                                <div className="h-32 w-32 relative group-hover:scale-105 transition-transform duration-300">
                                  <Image
                                    src={getImagePath("/block.png")}
                                    alt="Blockchain Block"
                                    width={128}
                                    height={128}
                                    className="h-full w-full object-contain"
                                    priority
                                  />
                                </div>
                              </div>

                              {/* Right section - Date and Prize */}
                              <div className="flex flex-col items-end gap-2 flex-1">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-4 h-4" />
                                  <span className="text-sm font-medium">
                                    {formatDate(hackathon.startTime)} - {formatDate(hackathon.endTime)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                  <DollarSign className="w-4 h-4" />
                                  <span>{parseFloat(hackathon.prizePool).toFixed(2)} ETH</span>
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
            {sortedHackathons.filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) !== 'active').length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-700 border-b border-gray-200 pb-2">
                  Upcoming & Past Hackathons
                </h2>
                <div className="space-y-4">
                  {sortedHackathons
                    .filter(h => getHackathonStatus(h.startTime, h.endTime, h.concluded) !== 'active')
                    .map((hackathon) => {
                      const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
                      return (
                        <Link 
                          key={hackathon.contractAddress} 
                          href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}
                          className="block"
                        >
                          <div className="w-full bg-white border border-amber-100 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group relative">
                            {/* Gradient background overlay based on status */}
                            <div className={`absolute inset-0 transition-all duration-300 ${
                              status === 'upcoming' 
                                ? 'bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-blue-50/60 group-hover:from-blue-100/60 group-hover:via-indigo-100/30 group-hover:to-blue-100/60'
                                : status === 'ended'
                                ? 'bg-gradient-to-r from-orange-50/60 via-amber-50/30 to-orange-50/60 group-hover:from-orange-100/60 group-hover:via-amber-100/30 group-hover:to-orange-100/60'
                                : 'bg-gradient-to-r from-gray-50/60 via-slate-50/30 to-gray-50/60 group-hover:from-gray-100/60 group-hover:via-slate-100/30 group-hover:to-gray-100/60'
                            }`}></div>
                            
                            <div className="relative z-10 flex items-center justify-between p-6 min-h-[140px]">
                              {/* Left section - Name and Status */}
                              <div className="flex items-center gap-4 flex-1">
                                <div className="space-y-2">
                                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                                    {hackathon.hackathonName}
                                  </h3>
                                  <Badge className={`text-xs font-medium px-3 py-1 ${getStatusColor(status)} shadow-sm`}>
                                    {status === 'upcoming' && '⏰'} 
                                    {status === 'ended' && '⏹️'} 
                                    {status === 'concluded' && '✅'} 
                                    {status.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>

                              {/* Center section - Block Image */}
                              <div className="flex-shrink-0 mx-8 relative h-full flex items-center">
                                <div className="h-32 w-32 relative group-hover:scale-105 transition-transform duration-300">
                                  <Image
                                    src={getImagePath("/block.png")}
                                    alt="Blockchain Block"
                                    width={128}
                                    height={128}
                                    className="h-full w-full object-contain"
                                    priority
                                  />
                                </div>
                              </div>

                              {/* Right section - Date and Prize */}
                              <div className="flex flex-col items-end gap-2 flex-1">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="w-4 h-4" />
                                  <span className="text-sm font-medium">
                                    {formatDate(hackathon.startTime)} - {formatDate(hackathon.endTime)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                  <DollarSign className="w-4 h-4" />
                                  <span>{parseFloat(hackathon.prizePool).toFixed(2)} ETH</span>
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
                Try adjusting your search terms or status filter
              </p>
              <Button 
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("All Status")
                }}
                className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white"
              >
                Show All Events
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