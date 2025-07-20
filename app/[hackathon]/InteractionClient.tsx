"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { HackathonData, getHackathonStatus, Judge, Project } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"
import { getDaysRemaining } from "@/lib/data"
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
  WifiOff
} from "lucide-react"
import { useChainId, useAccount, useWriteContract } from "wagmi"
import { toast } from "sonner"

export default function InteractionClient() {
  const [hackathonData, setHackathonData] = useState<HackathonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [sourceCode, setSourceCode] = useState("")
  const [documentation, setDocumentation] = useState("")
  
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
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'hackathonName' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'prizePool' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
      ])

      // Fetch judges
      const judges: Judge[] = []
      if (Number(judgeCount) > 0) {
        for (let i = 0; i < Number(judgeCount); i++) {
          try {
            const judgeInfo = await publicClient.readContract({ 
              address: contractAddress, 
              abi: HACKHUB_ABI, 
              functionName: 'judges',
              args: [BigInt(i)]
            }) as [string, string] // [addr, name]

            const judgeTokens = await publicClient.readContract({ 
              address: contractAddress, 
              abi: HACKHUB_ABI, 
              functionName: 'judgeTokens',
              args: [judgeInfo[0] as `0x${string}`]
            }) as bigint

            judges.push({
              address: judgeInfo[0],
              name: judgeInfo[1],
              tokensAllocated: Number(judgeTokens), // For display, we'll show current as allocated
              tokensRemaining: Number(judgeTokens)
            })
          } catch (judgeError) {
            console.error(`Error fetching judge ${i}:`, judgeError)
          }
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
              }) as Promise<[string, string, string]>, // [submitter, sourceCode, documentation]
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'getProjectTokens',
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

            projects.push({
              id: i,
              submitter: projectInfo[0],
              sourceCode: projectInfo[1],
              documentation: projectInfo[2],
              tokensReceived: Number(projectTokens),
              estimatedPrize: Number(formatEther(projectPrize)),
              prizeClaimed
            })
          } catch (projectError) {
            console.error(`Error fetching project ${i}:`, projectError)
          }
        }
      }

      const hackathon: HackathonData = {
        id: 0, // Not used for individual pages
        contractAddress,
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
        judges,
        projects,
        description: `Web3 Hackathon with ${formatEther(prizePool)} ETH prize pool`,
        image: "/placeholder.svg?height=300&width=1200",
        tags: ["Web3", "Blockchain"],
      }

      setHackathonData(hackathon)
    } catch (err) {
      console.error('Error fetching hackathon data:', err)
      setError('Failed to load hackathon data from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Submit project
  const handleSubmitProject = async () => {
    if (!sourceCode.trim() || !documentation.trim()) {
      toast.error("Please fill in both source code URL and documentation")
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
      
      await writeContract({
        address: contractAddress,
        abi: HACKHUB_ABI,
        functionName: 'submitProject',
        args: [sourceCode.trim(), documentation.trim()],
      })

      toast.success("Project submitted successfully!")
      setSubmissionOpen(false)
      setSourceCode("")
      setDocumentation("")
      
      // Refresh data after submission
      setTimeout(() => {
        fetchHackathonData()
      }, 2000)
      
    } catch (err: any) {
      console.error('Error submitting project:', err)
      toast.error(err?.message || "Failed to submit project")
    } finally {
      setSubmitting(false)
    }
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
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
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
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Active - {daysRemaining} days left</Badge>
      case 'ended':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Submission Ended</Badge>
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
      {/* Header */}
      <div className="relative">
        <img 
          src={hackathonData.image?.replace("400", "1200").replace("200", "300") || "/placeholder.svg?height=300&width=1200"} 
          alt={hackathonData.hackathonName}
          className="w-full h-64 object-cover rounded-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 to-blue-900/80 rounded-2xl" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white p-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">{hackathonData.hackathonName}</h1>
            <p className="text-xl opacity-90">{hackathonData.description}</p>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-lg font-semibold">{hackathonData.prizePool} ETH Prize Pool</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-lg">{hackathonData.projectCount} Projects Submitted</span>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                <span className="text-lg">{hackathonData.judgeCount} Judges</span>
              </div>
            </div>
            <div className="flex justify-center">
              {getStatusBadge()}
            </div>
          </div>
        </div>
      </div>

      {/* Network Status */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4 text-green-500" />
            <span>Connected to {getNetworkName(chainId)}</span>
            <Badge variant="outline" className="ml-2">Chain ID: {chainId}</Badge>
            {urlChainId && chainId !== parseInt(urlChainId) && (
              <Badge variant="destructive" className="ml-2">Expected: {urlChainId}</Badge>
            )}
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-500" />
            <span>Wallet not connected</span>
            {urlChainId && (
              <Badge variant="outline" className="ml-2">Expected Chain: {urlChainId}</Badge>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>About This Hackathon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {hackathonData.description}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Vote className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">{hackathonData.totalTokens}</p>
                  <p className="text-sm text-muted-foreground">Total Voting Tokens</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Coins className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{hackathonData.prizePool} ETH</p>
                  <p className="text-sm text-muted-foreground">Prize Pool</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Judges Section */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-500" />
                Judges & Voting Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hackathonData.judges.map((judge, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          {judge.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{judge.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {judge.address.slice(0, 6)}...{judge.address.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {judge.tokensRemaining} tokens
                        </span>
                        <Vote className="w-4 h-4 text-purple-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Projects Section */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-500" />
                Submitted Projects ({hackathonData.projectCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hackathonData.projects.length > 0 ? (
                <div className="space-y-4">
                  {hackathonData.projects.map((project, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">Project #{project.id}</h4>
                          <p className="text-sm text-muted-foreground">
                            By {project.submitter.slice(0, 6)}...{project.submitter.slice(-4)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <Vote className="w-4 h-4 text-purple-500" />
                            <span className="font-semibold">{project.tokensReceived} tokens</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600">{project.estimatedPrize.toFixed(4)} ETH</span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{project.documentation}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <a 
                            href={project.sourceCode} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Source Code
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          {project.prizeClaimed ? (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Prize Claimed
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <XCircle className="w-3 h-3 mr-1" />
                              Prize Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">No projects submitted yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-500" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'upcoming' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                  <div>
                    <p className="font-semibold">Hackathon Starts</p>
                    <p className="text-sm text-muted-foreground">
                      {startDate.toLocaleDateString()} at {startDate.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'ended' || status === 'concluded' ? 'bg-green-500' : status === 'active' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-semibold">Submission Deadline</p>
                    <p className="text-sm text-muted-foreground">
                      {endDate.toLocaleDateString()} at {endDate.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${hackathonData.concluded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-semibold">Hackathon Concluded</p>
                    <p className="text-sm text-muted-foreground">
                      {hackathonData.concluded ? 'Completed - Winners can claim prizes' : 'Pending organizer conclusion'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getStatusBadge()}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contract</span>
                <span className="text-sm font-mono">
                  {hackathonData.contractAddress.slice(0, 6)}...{hackathonData.contractAddress.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Organizer</span>
                <span className="text-sm font-mono">
                  {hackathonData.organizer.slice(0, 6)}...{hackathonData.organizer.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Tokens</span>
                <span className="font-semibold">{hackathonData.totalTokens}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Projects</span>
                <span className="font-semibold">{hackathonData.projectCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {hackathonData.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Project Submission */}
          {status === 'active' && (
            <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Target className="w-12 h-12 text-purple-500 mx-auto" />
                  <h3 className="font-bold text-lg">Ready to Participate?</h3>
                  {userProject ? (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✓ You have already submitted a project!</p>
                      <p className="text-xs text-muted-foreground">
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
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                        disabled={!isConnected || !!userProject}
                      >
                        {!isConnected ? 'Connect Wallet' : userProject ? 'Already Submitted' : 'Submit Project'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Submit Your Project</DialogTitle>
                        <DialogDescription>
                          Submit your project to participate in this hackathon. Make sure your source code is publicly accessible.
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
                          <Label htmlFor="documentation">Project Documentation</Label>
                          <Textarea
                            id="documentation"
                            placeholder="Describe your project, features, and how it addresses the hackathon theme..."
                            value={documentation}
                            onChange={(e) => setDocumentation(e.target.value)}
                            rows={4}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setSubmissionOpen(false)}
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
                              Submitting...
                            </>
                          ) : (
                            'Submit Project'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <Share2 className="w-8 h-8 text-gray-400 mx-auto" />
                <h3 className="font-semibold">Share This Hackathon</h3>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    toast.success("Link copied to clipboard!")
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchHackathonData}
            className="w-full flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>
    </div>
  )
}
