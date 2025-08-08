'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Calendar, Clock, Users, Trophy, Sparkles, Info, Globe, Coins, CheckCircle } from 'lucide-react'
import { HACKHUB_FACTORY_ABI } from '@/utils/contractABI/HackHubFactory'
import { IERC20MinimalABI } from '@/utils/contractABI/Interfaces'
import { HackHubFactoryAddress } from '@/utils/contractAddress'
import { isAddress, parseEther } from 'viem'
import { 
  convertLocalToUTC, 
  convertUTCToTimestamp, 
  timestampToContractDate, 
  isInFuture, 
  getCurrentUTCTimestamp,
  type TimezoneMode 
} from '@/utils/timeUtils'

interface Judge {
  address: string
  name: string
  tokens: string
}

export default function CreateHackathon() {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    prizePool: '',
    tokenAddress: ''
  })
  
  const [timezoneMode, setTimezoneMode] = useState<TimezoneMode>('local')
  const [prizePoolType, setPrizePoolType] = useState<'eth' | 'token'>('eth')
  const [tokenSymbol, setTokenSymbol] = useState<string>('')
  
  const [judges, setJudges] = useState<Judge[]>([
    { address: '', name: '', tokens: '' }
  ])
  
  const [validationError, setValidationError] = useState<string>('')
  const [showInfo, setShowInfo] = useState<{ [key: string]: boolean }>({})
  const [needsApproval, setNeedsApproval] = useState(false)
  const [isApprovingToken, setIsApprovingToken] = useState(false)

  const { writeContract, data: hash, error: writeError } = useWriteContract()
  const { isLoading, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })

  // Token approval hooks
  const { 
    writeContract: writeApproval, 
    data: approvalHash, 
    error: approvalError 
  } = useWriteContract()
  
  const { 
    isLoading: isApprovalLoading, 
    isSuccess: isApprovalSuccess, 
    error: approvalReceiptError 
  } = useWaitForTransactionReceipt({ hash: approvalHash })

  // Check current token allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: IERC20MinimalABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, HackHubFactoryAddress[534351] as `0x${string}`],
    query: {
      enabled: prizePoolType === 'token' && 
               isAddress(formData.tokenAddress) && 
               !!address && 
               !!formData.prizePool
    }
  })

  // Fetch token symbol
  const { data: fetchedTokenSymbol } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: [
      {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      }
    ] as const,
    functionName: 'symbol',
    query: {
      enabled: prizePoolType === 'token' && isAddress(formData.tokenAddress)
    }
  })

  // Update token symbol when fetched
  useEffect(() => {
    if (fetchedTokenSymbol) {
      setTokenSymbol(String(fetchedTokenSymbol))
    } else {
      setTokenSymbol('')
    }
  }, [fetchedTokenSymbol])

  // Smart contract has been fixed! 
  // Factory now transfers tokens directly from user to the created Hackathon contract

  // Log any contract write errors
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError)
      setValidationError(`Transaction failed: ${writeError.message}`)
    }
  }, [writeError])

  useEffect(() => {
    if (receiptError) {
      console.error('Transaction receipt error:', receiptError)
      setValidationError(`Transaction failed: ${receiptError.message}`)
    }
  }, [receiptError])

  // Handle approval errors
  useEffect(() => {
    if (approvalError) {
      console.error('Approval error:', approvalError)
      setValidationError(`Token approval failed: ${approvalError.message}`)
      setIsApprovingToken(false)
    }
  }, [approvalError])

  useEffect(() => {
    if (approvalReceiptError) {
      console.error('Approval receipt error:', approvalReceiptError)
      setValidationError(`Token approval failed: ${approvalReceiptError.message}`)
      setIsApprovingToken(false)
    }
  }, [approvalReceiptError])

  // Handle successful approval
  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApprovingToken(false)
      setNeedsApproval(false)
      refetchAllowance()
    }
  }, [isApprovalSuccess, refetchAllowance])

  // Check if token approval is needed
  useEffect(() => {
    if (prizePoolType === 'token' && formData.prizePool && currentAllowance !== undefined) {
      const requiredAmount = parseEther(formData.prizePool)
      setNeedsApproval(currentAllowance < requiredAmount)
    } else {
      setNeedsApproval(false)
    }
  }, [prizePoolType, formData.prizePool, currentAllowance])

  const addJudge = () => {
    setJudges([...judges, { address: '', name: '', tokens: '' }])
  }

  const removeJudge = (index: number) => {
    if (judges.length > 1) {
      setJudges(judges.filter((_, i) => i !== index))
    }
  }

  const updateJudge = (index: number, field: keyof Judge, value: string) => {
    const newJudges = [...judges]
    newJudges[index] = { ...newJudges[index], [field]: value }
    setJudges(newJudges)
  }

  const toggleInfo = (fieldId: string) => {
    setShowInfo(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }))
  }

  const handleApproveToken = async () => {
    if (!formData.tokenAddress || !formData.prizePool) {
      setValidationError('Please enter token address and prize pool amount first')
      return
    }

    try {
      setValidationError('')
      setIsApprovingToken(true)
      
      const requiredAmount = parseEther(formData.prizePool)
      
      await writeApproval({
        address: formData.tokenAddress as `0x${string}`,
        abi: IERC20MinimalABI,
        functionName: 'approve',
        args: [HackHubFactoryAddress[534351] as `0x${string}`, requiredAmount]
      })
    } catch (err) {
      console.error('Approval error:', err)
      setValidationError(`Token approval failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setIsApprovingToken(false)
    }
  }

  const validateForm = (): boolean => {
    // Check if we're on the correct chain
    if (chainId !== 534351) {
      setValidationError('Please switch to Scroll Sepolia Testnet (Chain ID: 534351)')
      return false
    }

    // Check if factory address exists for this chain
    const factoryAddress = HackHubFactoryAddress[chainId]
    if (!factoryAddress) {
      setValidationError(`Factory contract not deployed on chain ${chainId}`)
      return false
    }

    // Check required fields
    if (!formData.name || !formData.startDate || !formData.startTime || 
        !formData.endDate || !formData.endTime || !formData.prizePool) {
      setValidationError('Please fill in all required fields')
      return false
    }

    // Check token address if prize pool type is token
    if (prizePoolType === 'token' && (!formData.tokenAddress || !isAddress(formData.tokenAddress))) {
      setValidationError('Please enter a valid token contract address')
      return false
    }

    // Check if token approval is needed
    if (prizePoolType === 'token' && needsApproval) {
      setValidationError('Please approve the token spending first')
      return false
    }

    // Check prize pool is valid
    const prizeAmount = parseFloat(formData.prizePool)
    if (isNaN(prizeAmount) || prizeAmount <= 0) {
      setValidationError('Prize pool must be a positive number')
      return false
    }

    // Check dates - use UTC validation
    if (!isInFuture(formData.startDate, formData.startTime, timezoneMode)) {
      setValidationError('Start date and time cannot be in the past (UTC)')
      return false
    }

    const startTimestamp = timezoneMode === 'local' 
      ? convertLocalToUTC(formData.startDate, formData.startTime)
      : convertUTCToTimestamp(formData.startDate, formData.startTime)
    
    const endTimestamp = timezoneMode === 'local' 
      ? convertLocalToUTC(formData.endDate, formData.endTime)
      : convertUTCToTimestamp(formData.endDate, formData.endTime)

    if (endTimestamp <= startTimestamp) {
      setValidationError('End date must be after start date')
      return false
    }

    // Check judges
    const judgeAddresses = new Set<string>()
    for (let i = 0; i < judges.length; i++) {
      const judge = judges[i]
      if (!judge.address || !judge.name || !judge.tokens) {
        setValidationError(`Please fill in all fields for judge ${i + 1}`)
        return false
      }

      if (!isAddress(judge.address)) {
        setValidationError(`Invalid address for judge ${i + 1}`)
        return false
      }

      // Check for duplicate addresses
      const normalizedAddress = judge.address.toLowerCase()
      if (judgeAddresses.has(normalizedAddress)) {
        setValidationError(`Duplicate judge address found. Each judge must have a unique wallet address.`)
        return false
      }
      judgeAddresses.add(normalizedAddress)

      const tokens = parseInt(judge.tokens)
      if (isNaN(tokens) || tokens <= 0) {
        setValidationError(`Invalid token amount for judge ${i + 1}`)
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected) {
      setValidationError('Please connect your wallet')
      return
    }

    if (!validateForm()) {
      return
    }

    try {
      setValidationError('')

      // Convert dates to UTC timestamps for contract
      const startTimestamp = timezoneMode === 'local' 
        ? convertLocalToUTC(formData.startDate, formData.startTime)
        : convertUTCToTimestamp(formData.startDate, formData.startTime)
      
      const endTimestamp = timezoneMode === 'local' 
        ? convertLocalToUTC(formData.endDate, formData.endTime)
        : convertUTCToTimestamp(formData.endDate, formData.endTime)
      
      const startDate = timestampToContractDate(startTimestamp).toString() // YYYYMMDD format as string
      const startTime = startTimestamp // Unix timestamp
      const endDate = timestampToContractDate(endTimestamp).toString() // YYYYMMDD format as string
      const endTime = endTimestamp // Unix timestamp

      // Prepare judge data
      const judgeAddresses = judges.map(j => j.address as `0x${string}`)
      const judgeNames = judges.map(j => j.name)
      const tokenPerJudge = judges.map(j => BigInt(parseInt(j.tokens)))

      // Log the parameters being sent
      console.log('Creating hackathon with params:', {
        name: formData.name,
        startTime: BigInt(startTime),
        endTime: BigInt(endTime),
        startDate,
        endDate,
        judges: judgeAddresses,
        tokenPerJudge,
        judgeNames,
        prizeToken: prizePoolType === 'eth' ? '0x0000000000000000000000000000000000000000' : formData.tokenAddress,
        prizeAmount: formData.prizePool + (prizePoolType === 'eth' ? ' ETH' : ' tokens'),
        chainId,
        factoryAddress: HackHubFactoryAddress[chainId]
      })

      await writeContract({
        address: HackHubFactoryAddress[534351],
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'createHackathon',
        args: [
          formData.name,
          BigInt(startTime),
          BigInt(endTime),
          startDate,
          endDate,
          judgeAddresses,
          tokenPerJudge,
          judgeNames,
          prizePoolType === 'eth' 
            ? '0x0000000000000000000000000000000000000000' as `0x${string}`
            : formData.tokenAddress as `0x${string}`,
          parseEther(formData.prizePool)
        ],
        value: prizePoolType === 'eth' ? parseEther(formData.prizePool) : undefined
      })
    } catch (err) {
      console.error('Transaction error:', err)
      setValidationError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Navigate to explorer after successful transaction
  useEffect(() => {
    if (isSuccess) {
      router.push('/explorer')
    }
  }, [isSuccess, router])

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Connect Wallet</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Please connect your wallet to create a hackathon
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="outline"
            
            onClick={() => router.push('/explorer')}
            className="flex items-center gap-2 border-amber-600 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explorer
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
              Create Hackathon
            </h1>
          </div>
          
          <div className="w-32" /> {/* Spacer for centering */}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="border-0 shadow-lg bg-white backdrop-blur-sm">
            <CardContent className="space-y-6 pt-6">
              {/* Hackathon Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <Label htmlFor="name" className="text-gray-700 font-medium">Hackathon Name *</Label>
                    <button
                      type="button"
                      onClick={() => toggleInfo('name')}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter hackathon name"
                    className="border-amber-200 focus:border-amber-500 bg-white text-gray-900 placeholder:text-gray-500 flex-1"
                  />
                </div>
                {showInfo.name && (
                  <p className="text-sm text-gray-600 ml-[212px]">
                    Choose a unique and descriptive name for your hackathon
                  </p>
                )}
              </div>



              {/* Date and Time */}
              <div className="space-y-4">
                {/* Timezone Toggle */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <Label className="text-gray-700 font-medium">Timezone</Label>
                    <button
                      type="button"
                      onClick={() => toggleInfo('timezone')}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={timezoneMode === 'local' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimezoneMode('local')}
                      className={timezoneMode === 'local' 
                        ? 'bg-[#8B6914] text-white hover:bg-[#8B6914] hover:bg-[#FAE5C3] hover:text-[#8B6914] border-none'
                        : 'bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white border-none'
                      }
                    >
                      Local Time
                    </Button>
                    <Button
                      type="button"
                      variant={timezoneMode === 'utc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimezoneMode('utc')}
                      className={timezoneMode === 'utc' 
                        ? 'bg-[#8B6914] text-white hover:bg-[#8B6914] hover:bg-[#FAE5C3] hover:text-[#8B6914] border-none'
                        : 'bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white border-none'
                      }
                    >
                      UTC
                    </Button>
                  </div>
                </div>
                {showInfo.timezone && (
                  <p className="text-sm text-gray-600 mb-4 ml-[212px]">
                    Choose how you want to input times. Local time will be converted to UTC for storage on the blockchain.
                    All times are ultimately stored and displayed in UTC format.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <Label className="text-gray-700 font-medium">Start Date & Time *</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="border-blue-200 focus:border-blue-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="border-blue-200 focus:border-blue-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-red-500" />
                      <Label className="text-gray-700 font-medium">End Date & Time *</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="border-red-200 focus:border-red-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="border-red-200 focus:border-red-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prize Pool */}
              <div className="space-y-4">
                {/* Prize Pool Type Toggle */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <Label className="text-gray-700 font-medium">Prize Pool Type</Label>
                    <button
                      type="button"
                      onClick={() => toggleInfo('prizePoolType')}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={prizePoolType === 'eth' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPrizePoolType('eth')}
                      className={prizePoolType === 'eth' 
                        ? 'bg-[#8B6914] text-white hover:bg-[#8B6914] hover:bg-[#FAE5C3] hover:text-[#8B6914] border-none'
                        : 'bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white border-none'
                      }
                    >
                      <Coins className="w-4 h-4 mr-1" />
                      ETH
                    </Button>
                    <Button
                      type="button"
                      variant={prizePoolType === 'token' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPrizePoolType('token')}
                      className={prizePoolType === 'token' 
                        ? 'bg-[#8B6914] text-white hover:bg-[#8B6914] hover:bg-[#FAE5C3] hover:text-[#8B6914] border-none'
                        : 'bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white border-none'
                      }
                    >
                      Token
                    </Button>
                  </div>
                </div>
                {showInfo.prizePoolType && (
                  <p className="text-sm text-gray-600 mb-4 ml-[212px]">
                    Choose whether to fund the prize pool with native ETH or with an ERC20 token.
                  </p>
                )}

                {/* Token Fields - Parallel Layout */}
                {prizePoolType === 'token' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Token Address */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <Coins className="w-4 h-4 text-purple-500" />
                          <Label htmlFor="tokenAddress" className="text-gray-700 font-medium">Token Contract Address *</Label>
                        </div>
                      </div>
                      <Input
                        id="tokenAddress"
                        value={formData.tokenAddress}
                        onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
                        placeholder="0x..."
                        className="font-mono text-sm border-yellow-200 focus:border-yellow-500 bg-white text-gray-900 placeholder:text-gray-500"
                      />
                    </div>

                    {/* Prize Pool Amount */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <Trophy className="w-4 h-4 text-yellow-600" />
                          <Label htmlFor="prizePool" className="text-gray-700 font-medium">
                            Prize Pool Amount ({tokenSymbol || 'Tokens'}) *
                          </Label>
                          <button
                            type="button"
                            onClick={() => toggleInfo('prizePool')}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <Input
                        id="prizePool"
                        type="number"
                        step="any"
                        min="0"
                        value={formData.prizePool}
                        onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                        placeholder={`Enter amount in ${tokenSymbol || 'tokens'}`}
                        className="border-yellow-200 focus:border-yellow-500 bg-white text-gray-900 placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                )}

                {/* ETH Prize Pool Amount (when ETH is selected) */}
                {prizePoolType === 'eth' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 min-w-[200px]">
                        <Trophy className="w-4 h-4 text-yellow-600" />
                        <Label htmlFor="prizePool" className="text-gray-700 font-medium">
                          Prize Pool Amount (ETH) *
                        </Label>
                        <button
                          type="button"
                          onClick={() => toggleInfo('prizePool')}
                          className="text-amber-600 hover:text-amber-700"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                      <Input
                        id="prizePool"
                        type="number"
                        step="any"
                        min="0"
                        value={formData.prizePool}
                        onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                        placeholder="Enter prize pool amount in ETH"
                        className="border-yellow-200 focus:border-yellow-500 bg-white text-gray-900 placeholder:text-gray-500 flex-1"
                      />
                    </div>
                  </div>
                )}

                {showInfo.prizePool && (
                  <p className="text-sm text-gray-600 ml-[212px]">
                    The total prize pool that will be distributed to winners based on voting results
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Judges */}
          <Card className="border-0 shadow-lg bg-white backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Users className="w-5 h-5 text-green-600" />
                  Judges ({judges.length})
                </CardTitle>
                <Button
                  type="button"
                  onClick={addJudge}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none border-amber-600"
                >
                  <Plus className="w-4 h-4" />
                  Add Judge
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {judges.map((judge, index) => (
                <Card key={index} className="border border-gray-300 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-green-100 text-green-700">
                            J{index + 1}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-gray-800">Judge {index + 1}</span>
                      </div>
                      {judges.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeJudge(index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <Label className="text-gray-700 font-medium">Wallet Address *</Label>
                        </div>
                        <Input
                          value={judge.address}
                          onChange={(e) => updateJudge(index, 'address', e.target.value)}
                          placeholder="0x..."
                          className="font-mono text-sm bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-500" />
                          <Label className="text-gray-700 font-medium">Judge Name *</Label>
                        </div>
                        <Input
                          value={judge.name}
                          onChange={(e) => updateJudge(index, 'name', e.target.value)}
                          placeholder="Enter judge name"
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-orange-500" />
                          <Label className="text-gray-700 font-medium">Voting Tokens *</Label>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={judge.tokens}
                          onChange={(e) => updateJudge(index, 'tokens', e.target.value)}
                          placeholder="100"
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Token Approval Section */}
          {prizePoolType === 'token' && formData.tokenAddress && formData.prizePool && (
            <Card className="border-0 shadow-lg bg-white backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  Token Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${needsApproval ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {needsApproval ? 'Approval Required' : 'Token Approved'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {needsApproval 
                          ? `You need to approve the contract to spend ${formData.prizePool} tokens`
                          : 'The contract is approved to spend your tokens'
                        }
                      </p>
                    </div>
                  </div>
                  {needsApproval && (
                    <Button
                      type="button"
                      onClick={handleApproveToken}
                      disabled={isApprovingToken || isApprovalLoading}
                      size="sm"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isApprovingToken || isApprovalLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                          Approving...
                        </>
                      ) : (
                        'Approve Token'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{validationError}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={isLoading || (prizePoolType === 'token' && needsApproval)}
              className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white px-12 py-3 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Hackathon...
                </>
              ) : (prizePoolType === 'token' && needsApproval) ? (
                <>
                  <Coins className="w-5 h-5 mr-2" />
                  Approve Token First
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Hackathon
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
