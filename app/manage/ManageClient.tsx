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

// ERC20 ABI for token symbol and decimals
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
import { 
  Users, 
  Gavel, 
  Settings, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
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
  totalTokens: number
  judgeCount: number
  projectCount: number
  concluded: boolean
  organizer: string
  startTime: number
  endTime: number
}

interface SubmittedTokenInfo {
  token: string
  name: string
  submitter: string
}

interface ApprovedTokenInfo {
  token: string
  minAmount: string
  totalAmount: string
  symbol?: string
  decimals?: number
}

export default function ManageHackathonPage() {
  const searchParams = useSearchParams()
  const hackAddr = searchParams.get('hackAddr') as `0x${string}` | null
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  
  // Contract interaction
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  // Supports adjusting judge tokens via contract function

  // State
  const [hackathonInfo, setHackathonInfo] = useState<HackathonInfo | null>(null)
  const [judges, setJudges] = useState<JudgeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsWallet, setNeedsWallet] = useState(false)
  const [adjustingTokens, setAdjustingTokens] = useState<{[key: string]: boolean}>({})
  const [tokenAdjustments, setTokenAdjustments] = useState<{[key: string]: string}>({})
  const [submittedTokens, setSubmittedTokens] = useState<SubmittedTokenInfo[]>([])
  const [approvedTokens, setApprovedTokens] = useState<ApprovedTokenInfo[]>([])
  const [minAmounts, setMinAmounts] = useState<{[token: string]: string}>({})
  const [approvingToken, setApprovingToken] = useState<{[token: string]: boolean}>({})

  // Handle judge token adjustment
  const handleAdjustJudgeTokens = async (judgeAddress: string, newAmount: number) => {
    if (!hackAddr || !userAddress) return
    if (newAmount < 0) {
      toast.error('Amount must be non-negative')
      return
    }
    try {
      setAdjustingTokens(prev => ({ ...prev, [judgeAddress]: true }))
      await writeContract({
        address: hackAddr,
        abi: HACKHUB_ABI,
        functionName: 'adjustJudgeTokens',
        args: [judgeAddress as `0x${string}`, BigInt(newAmount)]
      })
      toast.success('Judge tokens update submitted')
      // Clear input for this judge
      setTokenAdjustments(prev => ({ ...prev, [judgeAddress]: '' }))
      // Data will refresh on tx confirmation via existing effect
    } catch (err: any) {
      console.error('Error adjusting judge tokens:', err)
      toast.error(err?.message || 'Failed to adjust judge tokens')
    } finally {
      setAdjustingTokens(prev => ({ ...prev, [judgeAddress]: false }))
    }
  }

  const handleApproveSubmittedToken = async (token: string) => {
    if (!hackAddr) return
    const min = minAmounts[token]
    if (!min || isNaN(Number(min))) {
      setError('Please enter a valid minimum amount for this token')
      return
    }
    try {
      setApprovingToken(prev => ({ ...prev, [token]: true }))
      
      // Convert human-readable amount to base units (wei for ETH, smallest units for ERC20)
      let minAmountInBaseUnits: bigint
      if (token === '0x0000000000000000000000000000000000000000') {
        // ETH - convert to wei (18 decimals)
        minAmountInBaseUnits = BigInt(min) * BigInt(10) ** BigInt(18)
      } else {
        // ERC20 - get decimals and convert to base units
        try {
          const publicClient = getPublicClient(config)
          const decimals = await publicClient.readContract({ 
            address: token as `0x${string}`, 
            abi: ERC20_ABI, 
            functionName: 'decimals' 
          }) as number
          minAmountInBaseUnits = BigInt(min) * BigInt(10) ** BigInt(decimals)
        } catch {
          // Default to 18 decimals if we can't get token decimals
          minAmountInBaseUnits = BigInt(min) * BigInt(10) ** BigInt(18)
        }
      }
      
      await writeContract({
        address: hackAddr,
        abi: HACKHUB_ABI,
        functionName: 'approveToken',
        args: [token as `0x${string}`, minAmountInBaseUnits]
      })
      setMinAmounts(prev => ({ ...prev, [token]: '' }))
    } catch (err: any) {
      console.error('Error approving token:', err)
      setError('Failed to approve token: ' + (err?.message || 'Unknown error'))
    } finally {
      setApprovingToken(prev => ({ ...prev, [token]: false }))
    }
  }

  // Load hackathon data
  const loadHackathonData = async () => {
    if (!hackAddr) {
      setError('Invalid hackathon address')
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
        totalTokens,
        judgeCount,
        projectCount,
        concluded,
        organizer,
        startTime,
        endTime
      ] = await Promise.all([
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>
      ])

      // If no wallet connected, prompt to connect to manage actions
      if (!userAddress) {
        setNeedsWallet(true)
      } else if (organizer.toLowerCase() !== userAddress?.toLowerCase()) {
        setError('You are not the organizer of this hackathon')
        setLoading(false)
        return
      }

      setHackathonInfo({
        name,
        totalTokens: Number(totalTokens),
        judgeCount: Number(judgeCount),
        projectCount: Number(projectCount),
        concluded,
        organizer,
        startTime: Number(startTime),
        endTime: Number(endTime)
      })

      // Fetch judges
      const judgeList: JudgeInfo[] = []
      if (Number(judgeCount) > 0) {
        try {
          const judgeAddresses = await publicClient.readContract({ 
            address: hackAddr, 
            abi: HACKHUB_ABI, 
            functionName: 'getAllJudges'
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

      // Load submitted tokens
      try {
        const submitted = await publicClient.readContract({
          address: hackAddr,
          abi: HACKHUB_ABI,
          functionName: 'getSubmittedTokensList'
        }) as string[]
        const submittedInfos: SubmittedTokenInfo[] = []
        for (const t of submitted) {
          const [tokenName, submitter, exists] = await publicClient.readContract({
            address: hackAddr,
            abi: HACKHUB_ABI,
            functionName: 'getTokenSubmission',
            args: [t as `0x${string}`]
          }) as [string, string, boolean]
          if (exists) submittedInfos.push({ token: t, name: tokenName, submitter })
        }
        setSubmittedTokens(submittedInfos)
      } catch (e) {
        console.error('Error loading submitted tokens', e)
      }

      // Load approved tokens
      try {
        const approved = await publicClient.readContract({
          address: hackAddr,
          abi: HACKHUB_ABI,
          functionName: 'getApprovedTokensList'
        }) as string[]
        const approvedInfos: ApprovedTokenInfo[] = []
        for (const t of approved) {
          const [min, total] = await Promise.all([
            publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'getTokenMinAmount', args: [t as `0x${string}`] }) as Promise<bigint>,
            publicClient.readContract({ address: hackAddr, abi: HACKHUB_ABI, functionName: 'getTokenTotal', args: [t as `0x${string}`] }) as Promise<bigint>,
          ])
          
          // Get token symbol and decimals
          let symbol = 'Unknown'
          let decimals = 18
          try {
            if (t === '0x0000000000000000000000000000000000000000') {
              symbol = 'ETH'
              decimals = 18
            } else {
              const [sym, dec] = await Promise.all([
                publicClient.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
                publicClient.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>
              ])
              symbol = sym
              decimals = dec
            }
          } catch {
            symbol = short(t)
          }
          
          approvedInfos.push({ 
            token: t, 
            minAmount: String(min), 
            totalAmount: String(total),
            symbol,
            decimals
          })
        }
        setApprovedTokens(approvedInfos)
      } catch (e) {
        console.error('Error loading approved tokens', e)
      }

    } catch (err) {
      console.error('Error loading hackathon data:', err)
      setError('Failed to load hackathon data')
    } finally {
      setLoading(false)
    }
  }

  // Token address pretty
  const short = (addr: string) => `${addr.slice(0,6)}...${addr.slice(-4)}`

  // Format token amounts for display - convert from base units to human-readable
  const formatTokenAmount = (amount: string, token: string, decimals?: number): string => {
    const amountBigInt = BigInt(amount)
    if (token === '0x0000000000000000000000000000000000000000') {
      // ETH - convert from wei to ether for display with up to 4 decimal places
      const etherValue = Number(formatEther(amountBigInt))
      const result = etherValue.toFixed(4)
      // Remove trailing zeros and decimal point if not needed
      return parseFloat(result).toString()
    } else {
      // ERC20 - convert using token decimals
      const tokenDecimals = decimals ?? 18
      const divisor = BigInt(10) ** BigInt(tokenDecimals)
      const wholeTokens = amountBigInt / divisor
      return wholeTokens.toString()
    }
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
      {needsWallet && (
        <Alert className="max-w-2xl mx-auto border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-700" />
          <AlertDescription className="text-yellow-800">
            Please connect your wallet to manage this hackathon. You can still view details below.
          </AlertDescription>
        </Alert>
      )}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div key={judge.address} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-6">
                    {/* Left: judge details */}
                    <div>
                      <p className="font-semibold text-black">{judge.name}</p>
                      <p className="text-sm text-gray-800">{judge.address.slice(0, 10)}...{judge.address.slice(-6)}</p>
                      <p className="text-xs text-gray-600">Current tokens: {judge.tokensAllocated}</p>
                    </div>

                    {/* Right: input + update button */}
                    {!hackathonInfo?.concluded && (
                      <div className="flex flex-col items-end gap-2 min-w-[280px]">
                        <div className="flex items-center gap-3">
                          <Input
                            id={`tokens-${judge.address}`}
                            type="number"
                            min="0"
                            placeholder="New token amount (e.g., 10)"
                            value={tokenAdjustments[judge.address] || ""}
                            onChange={(e) => setTokenAdjustments(prev => ({
                              ...prev,
                              [judge.address]: e.target.value
                            }))}
                            className="w-60 bg-white border-gray-300 text-black"
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
                        <p className="text-xs text-gray-600">Set to 0 to remove voting power, increase to allocate more tokens</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submitted Tokens for Approval */}
      {!hackathonInfo.concluded && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-black">Submitted Tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {submittedTokens.length === 0 ? (
              <p className="text-gray-800">No token submissions yet.</p>
            ) : (
              submittedTokens.map((t) => (
                <div key={t.token} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-6">
                    {/* Left: token details */}
                    <div>
                      <p className="font-semibold text-black">{t.name || 'Token'}</p>
                      <p className="text-sm text-gray-800">{short(t.token)}</p>
                      <p className="text-xs text-gray-600">Submitted by {short(t.submitter)}</p>
                    </div>

                    {/* Right: input + approve button */}
                    <div className="flex flex-col items-end gap-2 min-w-[280px]">
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder="Min amount (e.g., 5 for 5 tokens)"
                          value={minAmounts[t.token] || ''}
                          onChange={(e) => setMinAmounts(prev => ({ ...prev, [t.token]: e.target.value }))}
                          className="w-60 bg-white border-gray-300 text-black"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleApproveSubmittedToken(t.token)}
                          disabled={approvingToken[t.token] || !minAmounts[t.token]}
                          className="bg-[#8B6914] text-white hover:bg-[#A0471D]"
                        >
                          {approvingToken[t.token] ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Approving...
                            </>
                          ) : 'Approve Token'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600">Enter human-readable amounts (e.g., 5 for 5 tokens). Decimals will be handled automatically.</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Approved Tokens Overview */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-black">Approved Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvedTokens.length === 0 ? (
            <p className="text-gray-800">No approved tokens yet.</p>
          ) : (
            approvedTokens.map((t) => (
              <div key={t.token} className="flex items-center justify-between border rounded-lg p-4 bg-gray-50">
                <div>
                  <p className="font-semibold text-black">{t.token === '0x0000000000000000000000000000000000000000' ? 'Native ETH' : (t.symbol || short(t.token))}</p>
                  <p className="text-xs text-gray-600">
                    Min: {
                      t.token === '0x0000000000000000000000000000000000000000'
                        ? '1 Wei' // Hardcode ETH minimum to 1 Wei
                        : BigInt(t.minAmount) > BigInt(0) 
                          ? formatTokenAmount(t.minAmount, t.token, t.decimals)
                          : 'No minimum'
                    }
                  </p>
                </div>
                <Badge variant="outline" className="text-black border-gray-400">
                  Total: {formatTokenAmount(t.totalAmount, t.token, t.decimals)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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