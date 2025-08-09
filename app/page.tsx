"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { HackathonData, getHackathonStatus } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { getFactoryAddress } from "@/utils/contractAddress"
import { HACKHUB_FACTORY_ABI } from "@/utils/contractABI/HackHubFactory"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { useChainId } from "wagmi"
import {
  Rocket,
  Users,
  Code,
  Search,
  Plus,
  Target,
  Zap,
  ArrowRight,
  Globe,
  Coins,
  Calendar,
  DollarSign,
  ChevronDown
} from "lucide-react"
import { formatUTCTimestamp } from '@/utils/timeUtils'

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  const basePath = process.env.NODE_ENV === 'production' ? '/HackHub-WebUI' : '';
  return `${basePath}${path}`;
};

export default function HomePage() {
  const [recentHackathons, setRecentHackathons] = useState<HackathonData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chainId = useChainId()

  // Fetch recent hackathons from blockchain
  const fetchRecentHackathons = async () => {
    try {
      setLoading(true)
      setError(null)

      const publicClient = getPublicClient(config)
      const factoryAddress = getFactoryAddress(chainId)

      if (!factoryAddress) {
        setError(`Factory contract not deployed on network ${chainId}`)
        setRecentHackathons([])
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

      // Get recent ongoing hackathons (last 5)
      if (ongoing > 0) {
        const startIndex = Math.max(0, ongoing - 5)
        const ongoingAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getHackathons',
          args: [BigInt(startIndex), BigInt(ongoing - 1), true],
        }) as `0x${string}`[]
        addresses = addresses.concat(ongoingAddrs)
      }

      // Get recent past hackathons (last 3)
      if (past > 0 && addresses.length < 8) {
        const remainingSlots = 8 - addresses.length
        const startIndex = Math.max(0, past - remainingSlots)
        const pastAddrs = await publicClient.readContract({
          address: factoryAddress,
          abi: HACKHUB_FACTORY_ABI,
          functionName: 'getHackathons',
          args: [BigInt(startIndex), BigInt(past - 1), false],
        }) as `0x${string}`[]
        addresses = addresses.concat(pastAddrs)
      }

      if (addresses.length === 0) {
        setRecentHackathons([])
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
            prizePool,
            totalTokens,
            concluded,
            organizer,
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
            publicClient.readContract({ address: addr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
          ])

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
            factory: '',
            judgeCount: 0,
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

      // Sort by start time descending (most recent first)
      const sortedHackathons = validHackathons.sort((a, b) => b.startTime - a.startTime)
      
      setRecentHackathons(sortedHackathons)
    } catch (err) {
      console.error('Error loading recent hackathons:', err)
      setError('Failed to load recent hackathons')
    } finally {
      setLoading(false)
    }
  }

  // Load hackathons on component mount and chain change
  useEffect(() => {
    fetchRecentHackathons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId])

  // Handle scroll to update current slide indicator
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const cardWidth = 400 // Approximate card width including gap
      const scrollLeft = container.scrollLeft
      const newSlide = Math.round(scrollLeft / cardWidth)
      setCurrentSlide(newSlide)
    }
  }

  // Scroll to specific slide
  const scrollToSlide = (slideIndex: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const cardWidth = 400 // Approximate card width including gap
      container.scrollTo({
        left: slideIndex * cardWidth,
        behavior: 'smooth'
      })
      setCurrentSlide(slideIndex)
    }
  }

  // Format date helper - now using UTC in 24-hour format
  const formatDate = (timestamp: number) => {
    return formatUTCTimestamp(timestamp)
  }

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
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Welcome to HackHub */}
            <div className="space-y-8">
              <div className="relative">            
                {/* Main heading with enhanced styling */}
                <div className="relative z-10">
                  <h1 className="text-6xl lg:text-7xl font-black leading-tight">
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 drop-shadow-sm">
                    Welcome to the Hub for
                    </span>
                    <span className="block text-6xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-orange-600 to-amber-800 mt-4 tracking-tight">
                      On-Chain Hackathons.
                    </span>
                  </h1>
                  
                  {/* Accent line */}
                   <div className="mt-6 w-24 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-lg"></div>
                   
                   <div className="mt-8">
                     <p className="text-xl lg:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 tracking-wider">
                     Transparent. Permissionless. Easy.
                     </p>
                   </div>
                </div>
              </div>
            </div>
            
            {/* Right side - HackHub image */}
            <div className="flex justify-center lg:justify-end pt-0">
              <div className="relative -mt-8">
                <img 
                  src={getImagePath("/handRevolution.png")} 
                  alt="HackHub - Think, Build, Innovate" 
                  className="w-full max-w-md h-auto object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="flex flex-col items-center space-y-2">
            <span className="text-sm text-amber-600 font-medium">Scroll to explore</span>
            <ChevronDown className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Revolution Section with Hackathons Carousel */}
      <div className="min-h-screen py-16">
        <div className="container mx-auto">
          <div className="space-y-8">
              {/* Revolution Text - Moved Higher */}
              <div className="relative -mt-8">
                {/* Small decorative elements */}
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-300 to-orange-300 rounded-full opacity-50"></div>
                
                <div className="relative z-10 mt-">
                  <h2 className="text-4xl lg:text-5xl font-black leading-tight">
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700">
                      Think. Build. Innovate.
                    </span>
                  </h2>
                  
                  {/* Accent line */}
                  <div className="mt-6 w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-lg"></div>
                </div>
              </div>
              
              {/* Circular Hackathons Carousel - Right Side */}
              {!loading && !error && recentHackathons.length > 0 && (
                <div className="overflow-hidden h-[50vh]">
                  <div className="relative h-full flex items-center">
                    {/* Infinite scrolling container */}
                    <div className="flex animate-scroll-left">
                      {/* First set of hackathons */}
                      {recentHackathons.concat(recentHackathons).map((hackathon, index) => {
                        const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
                        const statusBadge = getStatusBadge(status)
                        
                        return (
                                                <div key={`${hackathon.contractAddress}-${index}`} className="flex-shrink-0 mx-4">
                        <Link 
                          href={`/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`}
                          className="block"
                        >
                          <Card className="w-[350px] bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer">
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
                <div className="flex justify-center items-center h-[50vh]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                </div>
              )}
              
              {/* Error State - Right Side */}
              {error && (
                <div className="flex items-center justify-center h-[50vh]">
                  <div className="bg-red-50/80 rounded-lg p-6 max-w-md">
                    <p className="font-medium text-red-600">{error}</p>
                    <Button 
                      onClick={fetchRecentHackathons} 
                      variant="outline" 
                      className="mt-4"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Empty State - Right Side */}
              {!loading && !error && recentHackathons.length === 0 && (
                <div className="flex items-center justify-center h-[50vh]">
                  <div className="bg-white/50 rounded-lg p-8 max-w-md text-center">
                    <Zap className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No hackathons found</h3>
                    <p className="text-muted-foreground mb-4">Be the first to create an exciting hackathon!</p>
                    <Link href="/createHackathon">
                      <Button className="bg-amber-600 hover:bg-amber-700">
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

