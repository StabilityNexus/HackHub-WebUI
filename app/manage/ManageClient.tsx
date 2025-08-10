"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther } from "viem"

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
import { 
  Trophy, 
  Users, 
  Gavel, 
  Settings, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
  Coins,
  CheckCircle
} from "lucide-react"
import { useChainId, useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { toast } from "sonner"
import Link from "next/link"

interface JudgeInfo {
  address: string
  name: string
  tokensAllocated: number
}

interface HackathonInfo {
  name: string
  prizePool: string
  totalTokens: number
  judgeCount: number
  projectCount: number
  concluded: boolean
  organizer: string
  startTime: number
  endTime: number
  isERC20Prize?: boolean
  prizeTokenSymbol?: string
}

export default function ManageHackathonPage() {
  const searchParams = useSearchParams()
  const hackAddr = searchParams.get('hackAddr') as `0x${string}` | null
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  
  // Contract interaction
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  // State
  const [hackathonInfo, setHackathonInfo] = useState<HackathonInfo | null>(null)
  const [judges, setJudges] = useState<JudgeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjustingTokens, setAdjustingTokens] = useState<{[key: string]: boolean}>({})
  const [tokenAdjustments, setTokenAdjustments] = useState<{[key: string]: string}>({})
  const [adjustingPrizePool, setAdjustingPrizePool] = useState(false)
  const [newPrizeAmount, setNewPrizeAmount] = useState("")

  // Handle judge token adjustment
  const handleAdjustJudgeTokens = async (judgeAddress: string, newAmount: number) => {
    if (!hackAddr || !userAddress) return

    try {
      setAdjustingTokens(prev => ({ ...prev, [judgeAddress]: true }))
      
      await writeContract({
        address: hackAddr,
        abi: HACKHUB_ABI,
        functionName: 'adjustJudgeTokens',
        args: [judgeAddress as `0x${string}`, BigInt(newAmount)],
      })

      // Clear the adjustment input
      setTokenAdjustments(prev => ({ ...prev, [judgeAddress]: "" }))
      
    } catch (err: any) {
      console.error('Error adjusting judge tokens:', err)
      setError('Failed to adjust judge tokens: ' + (err?.message || 'Unknown error'))
    } finally {
      setAdjustingTokens(prev => ({ ...prev, [judgeAddress]: false }))
    }
  }

  // Handle prize pool adjustment
  const handleAdjustPrizePool = async () => {
    if (!hackAddr || !userAddress || !newPrizeAmount) return

    const newAmountFloat = parseFloat(newPrizeAmount)
    const currentAmountFloat = parseFloat(hackathonInfo?.prizePool || "0")

    if (newAmountFloat <= currentAmountFloat) {
      setError('New prize amount must be greater than current prize pool')
      return
    }

    try {
      setAdjustingPrizePool(true)
      setError(null)

      if (hackathonInfo?.isERC20Prize) {
        // For ERC20 prizes, no ETH value needed
        await writeContract({
          address: hackAddr,
          abi: HACKHUB_ABI,
          functionName: 'adjustPrizePool',
          args: [BigInt(Math.floor(newAmountFloat * 1e18))], // Convert to wei-like units for ERC20
        })
      } else {
        // For ETH prizes, send the difference as value
        const differenceInWei = BigInt(Math.floor((newAmountFloat - currentAmountFloat) * 1e18))
        await writeContract({
          address: hackAddr,
          abi: HACKHUB_ABI,
          functionName: 'adjustPrizePool',
          args: [BigInt(Math.floor(newAmountFloat * 1e18))],
          value: differenceInWei
        })
      }

      // Clear the input
      setNewPrizeAmount("")
      
    } catch (err: any) {
      console.error('Error adjusting prize pool:', err)
      setError('Failed to adjust prize pool: ' + (err?.message || 'Unknown error'))
    } finally {
      setAdjustingPrizePool(false)
    }
  }

  // Load hackathon data
  const loadHackathonData = async () => {
    if (!hackAddr || !isConnected) {
      setError('Invalid hackathon address or wallet not connected')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const publicClient = getPublicClient(config)
      
      // Fetch basic hackathon info
      const [
        name,
        prizePool,
        totalTokens,
        judgeCount,
        projectCount,
        concluded,
        organizer,
        startTime,
        endTime,
        isERC20Prize,
        prizeToken
      ] = await Promise.all([
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'prizePool' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'isERC20Prize' }) as Promise<boolean>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'prizeToken' }) as Promise<string>
      ])

      // Get token symbol if it's an ERC20 prize
      let tokenSymbol = ""
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

      // Check if user is the organizer
      if (organizer.toLowerCase() !== userAddress?.toLowerCase()) {
        setError('You are not the organizer of this hackathon')
        setLoading(false)
        return
      }

      setHackathonInfo({
        name,
        prizePool: formatEther(prizePool),
        totalTokens: Number(totalTokens),
        judgeCount: Number(judgeCount),
        projectCount: Number(projectCount),
        concluded,
        organizer,
        startTime: Number(startTime),
        endTime: Number(endTime),
        isERC20Prize,
        prizeTokenSymbol: tokenSymbol
      })

      // Fetch judges
      const judgeList: JudgeInfo[] = []
      if (Number(judgeCount) > 0) {
        try {
          const judgeAddresses = await publicClient.readContract({ 
            address: hackAddr, 
            abi: HACKHUB_ABI, 
            functionName: 'getJudges',
            args: [BigInt(0), BigInt(Number(judgeCount) - 1)]
          }) as string[]

          for (let i = 0; i < judgeAddresses.length; i++) {
            try {
              // Get judge tokens allocated
              const judgeTokens = await publicClient.readContract({
                address: hackAddr,
                abi: HACKHUB_ABI,
                functionName: 'judgeTokens',
                args: [judgeAddresses[i] as `0x${string}`]
              }) as bigint

              judgeList.push({
                address: judgeAddresses[i],
                name: `Judge ${i + 1}`, // Use generic name since names are no longer stored
                tokensAllocated: Number(judgeTokens)
              })
            } catch (judgeError) {
              console.error(`Error fetching judge ${i} data:`, judgeError)
            }
          }
        } catch (judgeError) {
          console.error('Error fetching judges:', judgeError)
        }
      }

      setJudges(judgeList)

    } catch (err) {
      console.error('Error loading hackathon data:', err)
      setError('Failed to load hackathon data')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to format prize amounts
  const formatPrizeAmount = (amount: string) => {
    if (hackathonInfo?.isERC20Prize && hackathonInfo?.prizeTokenSymbol) {
      return `${amount} ${hackathonInfo.prizeTokenSymbol}`
    }
    return `${amount} ETH`
  }

  // Helper function to determine if we're in judging phase
  const isJudgingPhase = () => {
    if (!hackathonInfo) return false
    const currentTime = Math.floor(Date.now() / 1000)
    return currentTime > hackathonInfo.endTime && !hackathonInfo.concluded
  }

  // Handle conclude hackathon
  const handleConcludeHackathon = async () => {
    if (!hackAddr) return

    try {
      await writeContract({
        address: hackAddr,
        abi: HACKHUB_ABI,
        functionName: 'concludeHackathon'
      })
    } catch (err: any) {
      console.error('Error concluding hackathon:', err)
      setError('Failed to conclude hackathon: ' + (err?.message || 'Unknown error'))
    }
  }

  useEffect(() => {
    loadHackathonData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hackAddr, userAddress, chainId])

  // Handle successful transactions
  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success("Transaction confirmed successfully!")
      // Reload data after successful transaction
      setTimeout(() => {
        loadHackathonData()
      }, 1000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, hash])

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{color: '#8B6914'}} />
            <p className="text-gray-600">Loading hackathon management...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <Alert className="max-w-2xl mx-auto border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <Link href="/myHackathons">
            <Button variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Hackathons
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!hackathonInfo) return null

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
            Manage {hackathonInfo.name} Hackathon
          </h1>
        </div>
        <Link href="/myHackathons">
          <Button variant="outline" className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-800">Prize Pool</p>
                <p className="font-semibold text-black">{formatPrizeAmount(hackathonInfo.prizePool)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Gavel className="w-5 h-5" style={{color: '#8B6914'}} />
              <div>
                <p className="text-sm text-gray-800">Judges</p>
                <p className="font-semibold text-black">{hackathonInfo.judgeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm text-gray-800">Projects</p>
                <p className="font-semibold text-black">{hackathonInfo.projectCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-800">Total Tokens</p>
                <p className="font-semibold text-black">{hackathonInfo.totalTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Judges Information */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-black">
            <Gavel className="w-5 h-5" />
            Judges Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {judges.length === 0 ? (
            <p className="text-gray-800 text-center py-4">No judges assigned to this hackathon yet.</p>
          ) : (
            <div className="space-y-4">
              {judges.map((judge) => (
                <div key={judge.address} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-black">{judge.name}</p>
                      <p className="text-sm text-gray-800">{judge.address.slice(0, 10)}...{judge.address.slice(-6)}</p>
                    </div>
                    <Badge variant="outline" className="text-black border-gray-400">
                      {judge.tokensAllocated} tokens
                    </Badge>
                  </div>
                  
                  {/* Token Adjustment Section */}
                  {!hackathonInfo?.concluded && (
                    <div className="pt-3 border-t border-gray-200">
                      <Label htmlFor={`tokens-${judge.address}`} className="text-sm font-medium text-gray-700 mb-2 block">
                        Adjust Judge Tokens
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id={`tokens-${judge.address}`}
                          type="number"
                          min="0"
                          placeholder="Enter new token amount"
                          value={tokenAdjustments[judge.address] || ""}
                          onChange={(e) => setTokenAdjustments(prev => ({
                            ...prev,
                            [judge.address]: e.target.value
                          }))}
                          className="w-48 bg-white border-gray-300 text-black"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const newAmount = parseInt(tokenAdjustments[judge.address] || "0")
                            if (newAmount >= 0) {
                              handleAdjustJudgeTokens(judge.address, newAmount)
                            }
                          }}
                          disabled={
                            adjustingTokens[judge.address] || 
                            !tokenAdjustments[judge.address] || 
                            parseInt(tokenAdjustments[judge.address] || "0") < 0
                          }
                          className="bg-[#8B6914] text-white hover:bg-[#A0471D]"
                        >
                          {adjustingTokens[judge.address] ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Updating...
                            </>
                          ) : (
                            'Update Tokens'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Current tokens: {judge.tokensAllocated} | 
                        Set to 0 to remove voting power, increase to allocate more tokens
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Prize Pool */}
      {!hackathonInfo.concluded && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black">
              <Coins className="w-5 h-5" />
              Adjust Prize Pool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">Current Prize Pool:</span>
                <span className="font-bold text-lg text-[#8B6914]">
                  {formatPrizeAmount(hackathonInfo.prizePool)}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {hackathonInfo.isERC20Prize 
                  ? 'ERC20 token prize pool' 
                  : 'ETH prize pool'
                }
              </p>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="newPrizeAmount" className="text-sm font-medium text-gray-700">
                New Prize Amount {hackathonInfo.isERC20Prize ? `(${hackathonInfo.prizeTokenSymbol})` : '(ETH)'}
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="newPrizeAmount"
                  type="number"
                  step="0.001"
                  min={parseFloat(hackathonInfo.prizePool) + 0.001}
                  placeholder={`Enter amount greater than ${hackathonInfo.prizePool}`}
                  value={newPrizeAmount}
                  onChange={(e) => setNewPrizeAmount(e.target.value)}
                  className="bg-white border-gray-300 text-black"
                />
                <Button
                  onClick={handleAdjustPrizePool}
                  disabled={
                    adjustingPrizePool || 
                    !newPrizeAmount || 
                    parseFloat(newPrizeAmount) <= parseFloat(hackathonInfo.prizePool)
                  }
                  className="bg-[#8B6914] text-white hover:bg-[#A0471D]"
                >
                  {adjustingPrizePool ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Prize Pool'
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                {hackathonInfo.isERC20Prize 
                  ? 'You must approve additional tokens before calling this function.'
                  : 'Additional ETH will be sent with the transaction to increase the prize pool.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conclude Hackathon */}
      {!hackathonInfo.concluded && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black">
              <Settings className="w-5 h-5" />
              Conclude Hackathon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-800">
              Once you conclude the hackathon, the prize distribution will be finalized based on judge votes, 
              and winners will be able to claim their prizes. This action cannot be undone.
            </p>
            {!isJudgingPhase() && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  The hackathon can only be concluded after the submission period ends (judging phase).
                </p>
              </div>
            )}
            <Button 
              onClick={handleConcludeHackathon}
              disabled={isPending || isConfirming || !isJudgingPhase()}
              className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isPending ? 'Confirming...' : 'Processing...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Conclude Hackathon
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction Status */}
      {(isPending || isConfirming) && (
        <Alert className="border-blue-200 bg-blue-50">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <AlertDescription className="text-blue-700">
            {isPending ? 'Waiting for wallet confirmation...' : 'Transaction confirming...'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
} 