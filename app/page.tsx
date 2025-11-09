"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import DecryptedText from "@/components/DecryptedText"

import { HackathonData, getHackathonStatus } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { useChainId } from "wagmi"
import { hackathonDB } from "@/lib/indexedDB"
import {
  Code,
  Plus,
  Zap,
  DollarSign,
  ChevronDown,
  RefreshCw
} from "lucide-react"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  return path;
};

export default function HomePage() {
  const [recentHackathons, setRecentHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const chainId = useChainId()

  // Load recent hackathons from cache first, then blockchain if needed
  const loadRecentHackathons = async (forceSync = false) => {
    try {
      setLoading(!forceSync) // Don't show loading spinner if it's a sync
      if (forceSync) setSyncing(true)
      setError(null)

      // Try to load from cache first (unless force syncing)
      if (!forceSync) {
        const cachedData = await hackathonDB.getHackathons('recent_home', chainId)
        if (cachedData && cachedData.length > 0) {
          setRecentHackathons(cachedData)
          setLoading(false)
          setLastSyncTime(new Date())
          return
        }
      }

      // Fetch from blockchain
      await fetchFromBlockchain()
    } catch (err) {
      console.error('Error loading recent hackathons:', err)
      setError('Failed to load recent hackathons')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  // Fetch recent hackathons from blockchain
  const fetchFromBlockchain = async () => {
    const publicClient = getPublicClient(config)
    const factoryAddress = getFactoryAddress(chainId)

    if (!factoryAddress) {
      setError(`Factory contract not deployed on network ${chainId}`)
      setRecentHackathons([])
      return
    }

    // Get ongoing count only
    const [ongoingCount] = await publicClient.readContract({
      address: factoryAddress,
      abi: HACKHUB_FACTORY_ABI,
      functionName: 'getCounts',
    }) as [bigint, bigint]

    const ongoing = Number(ongoingCount)
    const maxHackathons = Math.min(ongoing, 10)

    if (maxHackathons === 0) {
      setRecentHackathons([])
      await hackathonDB.setHackathons('recent_home', chainId, [])
      return
    }

    // Get ongoing hackathons from 0 to maxHackathons
    const addresses = await publicClient.readContract({
      address: factoryAddress,
      abi: HACKHUB_FACTORY_ABI,
      functionName: 'getHackathons',
      args: [BigInt(0), BigInt(maxHackathons - 1), true],
    }) as `0x${string}`[]

    if (addresses.length === 0) {
      setRecentHackathons([])
      await hackathonDB.setHackathons('recent_home', chainId, [])
      return
    }

    // Fetch hackathon details
    const hackathonPromises = addresses.map(async (addr, index) => {
      try {
        const [
          name,
          startDate,
          startTime,
          endDate,
          endTime,
          totalTokens,
          concluded,
          organizer,
          projectCount,
          imageURL,
        ] = await Promise.all([
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
          publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'imageURL' }) as Promise<string>,
        ])

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
          factory: '',
          judgeCount: 0,
          projectCount: Number(projectCount),
          judges: [],
          projects: [],
          description: `Web3 Hackathon with sponsored multi-token prize pool`,
          image: imageURL || "/placeholder.svg?height=200&width=400",
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

    // Sort by start time ascending (earliest first, since we're fetching from index 0)
    const sortedHackathons = validHackathons.sort((a, b) => a.startTime - b.startTime)
    
    setRecentHackathons(sortedHackathons)
    setLastSyncTime(new Date())
    
    // Update cache
    await hackathonDB.setHackathons('recent_home', chainId, sortedHackathons)
  }

  // Handle sync button click
  const handleSync = () => {
    loadRecentHackathons(true)
  }

  // Load hackathons on component mount and chain change
  useEffect(() => {
    loadRecentHackathons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId])



  // Get status badge color and style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepting-submissions':
        return { className: 'bg-green-500 text-white', label: 'LIVE' }
      case 'upcoming':
        return { className: 'bg-blue-500 text-white', label: 'UPCOMING' }
      case 'judging-submissions':
        return { className: 'bg-orange-500 text-white', label: 'JUDGING' }
      case 'concluded':
        return { className: 'bg-gray-500 text-white', label: 'CONCLUDED' }
      default:
        return { className: 'bg-gray-500 text-white', label: 'UNKNOWN' }
    }
  }



  return (
    <div className="min-h-screen">
      {/* Hero Section - Full Viewport Height */}
      <div className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <div className="hidden lg:flex absolute inset-0 items-center justify-end overflow-hidden">
          <img 
            src={getImagePath("/handRevolution.png")} 
            alt="HackHub - Think, Build, Innovate" 
            className="w-[450px] xl:w-[500px] h-auto object-contain opacity-90 drop-shadow-2xl"
          />
        </div>

        <div className="w-full max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left side - Welcome to HackHub */}
            <div className="space-y-4 sm:space-y-6 w-full">
              <div className="relative">            
                {/* Main heading with enhanced styling */}
                <div className="relative">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 drop-shadow-sm">
                      <DecryptedText 
                        text="Welcome to the On-Chain"
                        animateOn="view"
                        speed={75}
                        maxIterations={15}
                        sequential={true}
                        revealDirection="start"
                        className=""
                        encryptedClassName="text-amber-400/40"
                      />
                    </span>
                    <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-orange-600 to-amber-800 mt-2 sm:mt-4 tracking-tight">
                      <DecryptedText 
                        text="Hackathon Hub."
                        animateOn="view"
                        speed={100}
                        maxIterations={20}
                        sequential={true}
                        revealDirection="center"
                        className=""
                        encryptedClassName="text-orange-400/30"
                      />
                    </span>
                  </h1>
                  
                  {/* Accent line */}
                   <div className="mt-4 sm:mt-6 w-20 sm:w-24 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-lg"></div>
                   
                   <div className="mt-6 sm:mt-8">
                     <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 tracking-wider">
                       <DecryptedText 
                         text="Transparent. Permissionless. Intuitive."
                         animateOn="view"
                         speed={60}
                         maxIterations={12}
                         sequential={true}
                         revealDirection="start"
                         className=""
                         encryptedClassName="text-amber-500/30"
                       />
                     </p>
                   </div>
                </div>
              </div>
            </div>
            
            {/* Right side - Image shown below text on mobile/tablet */}
            <div className="flex justify-center lg:hidden w-full mt-8">
              <img 
                src={getImagePath("/handRevolution.png")} 
                alt="HackHub - Think, Build, Innovate" 
                className="w-[280px] sm:w-[350px] md:w-[400px] h-auto object-contain drop-shadow-2xl opacity-80"
              />
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="flex flex-col items-center space-y-1 sm:space-y-2">
            <span className="text-xs sm:text-sm text-amber-600 font-medium">Scroll to explore</span>
            <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Revolution Section with Hackathons Carousel */}
      <div className="min-h-screen py-8 sm:py-12 lg:py-16 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <div className="w-full max-w-7xl mx-auto">
          <div className="space-y-6 sm:space-y-8">
              {/* Revolution Text - Moved Higher */}
              <div className="relative">
                {/* Small decorative elements */}
                
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                    <div>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700">
                          Think. Build. Innovate.
                        </span>
                      </h2>
                      
                      {/* Accent line */}
                      <div className="mt-4 sm:mt-6 w-16 sm:w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-lg"></div>
                    </div>
                    
                    {/* Sync Button */}
                    <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                      <Button
                        onClick={handleSync}
                        disabled={syncing || loading}
                        variant="outline"
                        size="sm"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 mb-2 w-full sm:w-auto"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
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
              
              {/* Circular Hackathons Carousel - Right Side */}
              {!loading && !error && recentHackathons.length > 0 && (
                <div className="overflow-hidden h-[40vh] sm:h-[45vh] md:h-[50vh]">
                  <div className="relative h-full flex items-center">
                    {/* Infinite scrolling container */}
                    <div className="flex animate-scroll-left">
                      {/* First set of hackathons */}
                      {recentHackathons.concat(recentHackathons).map((hackathon, index) => {
                        const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
                        const statusBadge = getStatusBadge(status)
                        
                        return (
                          <div key={`${hackathon.contractAddress}-${index}`} className="flex-shrink-0 mx-2 sm:mx-3 md:mx-4">
                        <Link 
                          href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}
                          className="block"
                        >
                          <Card className="w-[280px] sm:w-[320px] md:w-[350px] bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer">
                                <CardContent className="p-5">
                                  <div className="space-y-3">
                                    {/* Header */}
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Badge className={`${statusBadge.className} text-xs font-medium px-2 py-1 rounded-md`}>
                                          {statusBadge.label}
                                        </Badge>
                                        <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center">
                                          <Zap className="w-3 h-3 text-white" />
                                        </div>
                                      </div>
                                      
                                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                        {hackathon.hackathonName}
                                      </h3>
                                    </div>

                                    {/* Prize & Projects */}
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 text-xs">
                                        <DollarSign className="w-3 h-3 text-amber-600" />
                                        <span className="font-medium text-amber-700">
                                          {parseFloat(hackathon.prizePool).toFixed(2)} ETH
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Code className="w-3 h-3" />
                                        <span>{hackathon.projectCount} Projects</span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                    

                  </div>
                </div>
              )}
              
              {/* Loading State - Right Side */}
              {loading && (
                <div className="flex justify-center items-center h-[40vh] sm:h-[45vh] md:h-[50vh]">
                  <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-amber-300"></div>
                </div>
              )}
              
              {/* Error State - Right Side */}
              {error && (
                <div className="flex items-center justify-center h-[40vh] sm:h-[45vh] md:h-[50vh] px-4">
                  <div className="bg-red-50/80 rounded-lg p-4 sm:p-6 max-w-md w-full">
                    <p className="font-medium text-red-600 text-sm sm:text-base">{error}</p>
                    <Button 
                      onClick={() => loadRecentHackathons(true)} 
                      variant="outline" 
                      className="mt-4 w-full sm:w-auto"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Empty State - Right Side */}
              {!loading && !error && recentHackathons.length === 0 && (
                <div className="flex items-center justify-center h-[40vh] sm:h-[45vh] md:h-[50vh] px-4">
                  <div className="bg-white/50 rounded-lg p-6 sm:p-8 max-w-md text-center w-full">
                    <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No hackathons found</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4">Be the first to create an exciting hackathon!</p>
                    <Link href="/createHackathon">
                      <Button className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Hackathon
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

