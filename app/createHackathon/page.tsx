'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Plus, Trash2, Calendar, Clock, Users, Sparkles, Info, Globe, CheckCircle, Eye, Coins } from 'lucide-react'
import { HACKHUB_FACTORY_ABI } from '@/utils/contractABI/HackHubFactory'
import { HackHubFactoryAddress } from '@/utils/contractAddress'
import { isAddress } from 'viem'
import { 
  convertLocalToUTC, 
  convertUTCToTimestamp, 
  timestampToContractDate, 
  isInFuture, 
  type TimezoneMode 
} from '@/utils/timeUtils'

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  // Let Next.js handle the basePath automatically through the configuration
  return path;
};

interface Judge {
  address: string
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
    imageURL: ''
  })
  
  const [timezoneMode, setTimezoneMode] = useState<TimezoneMode>('local')
  // Prize pool is now handled post-creation via sponsorship deposits
  
  const [judges, setJudges] = useState<Judge[]>([
    { address: '', tokens: '' }
  ])
  
  const [validationError, setValidationError] = useState<string>('')
  const [showInfo, setShowInfo] = useState<{ [key: string]: boolean }>({})
  // No token approvals needed at creation time

  const { writeContract, data: hash, error: writeError } = useWriteContract()
  const { isLoading, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })

  // No token approval hooks required

  // No allowance checks at creation time

  // No token metadata needed at creation time

  // No token symbol management

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

  // No approval flows

  // 

  // 

  const addJudge = () => {
    setJudges([...judges, { address: '', tokens: '' }])
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

  // Check if a judge address is duplicate
  const isDuplicateAddress = (address: string, currentIndex: number): boolean => {
    if (!address) return false
    const normalizedAddress = address.toLowerCase()
    return judges.some((judge, index) => 
      index !== currentIndex && judge.address.toLowerCase() === normalizedAddress
    )
  }

  const toggleInfo = (fieldId: string) => {
    setShowInfo(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }))
  }

  // 

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

    // Check requiamber fields
    if (!formData.name || !formData.startDate || !formData.startTime || 
        !formData.endDate || !formData.endTime) {
      setValidationError('Please fill in all requiamber fields')
      return false
    }
    // No prize pool checks at creation time

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
      if (!judge.address || !judge.tokens) {
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
        imageURL: formData.imageURL,
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
          formData.imageURL || ''
        ]
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
            className="flex items-center gap-2 border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
          >
            <ArrowLeft className="w-4 h-4 text-[#8B6914]" />
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
                  <div className="flex items-center gap-2 sm:min-w-[200px]">
                    <Sparkles className="w-4 h-4 text-[#8B6914]" />
                    <Label htmlFor="name" className="text-gray-700 font-medium">Hackathon Name *</Label>
                    <button
                      type="button"
                      onClick={() => toggleInfo('name')}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Info className="w-4 h-4 text-[#8B6914]" />
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
                  <div className="flex items-center gap-2 sm:min-w-[200px]">
                    <Globe className="w-4 h-4 text-[#8B6914]" />
                    <Label className="text-gray-700 font-medium">Timezone</Label>
                    <button
                      type="button"
                      onClick={() => toggleInfo('timezone')}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Info className="w-4 h-4 text-[#8B6914]" />
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
                    All times are ultimately stoamber and displayed in UTC format.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#8B6914]" />
                      <Label className="text-gray-700 font-medium">Start Date & Time *</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="border-amber-200 focus:border-amber-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="border-amber-200 focus:border-amber-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#8B6914]" />
                      <Label className="text-gray-700 font-medium">End Date & Time *</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="border-amber-200 focus:border-amber-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="border-amber-200 focus:border-amber-500 bg-white text-gray-900 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                          colorScheme: 'light'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 sm:min-w-[200px]">
                    <Globe className="w-4 h-4 text-[#8B6914]" />
                    <Label htmlFor="imageURL" className="text-gray-700 font-medium">Image URL (Optional)</Label>
                    <button
                      type="button"
                      onClick={() => toggleInfo('imageURL')}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Info className="w-4 h-4 text-[#8B6914]" />
                    </button>
                  </div>
                  <Input
                    id="imageURL"
                    value={formData.imageURL}
                    onChange={(e) => setFormData({ ...formData, imageURL: e.target.value })}
                    placeholder="https://example.com/image.png"
                    className="border-amber-200 focus:border-amber-500 bg-white text-gray-900 placeholder:text-gray-500 flex-1"
                  />
                </div>
                {showInfo.imageURL && (
                  <p className="text-sm text-gray-600 ml-[212px]">
                    Optional URL for hackathon banner image. Leave empty to use default blockchain block image.
                  </p>
                )}
              </div>

              {/* Prize pool is removed at creation; funds can be deposited later by anyone */}
            </CardContent>
          </Card>

          {/* Judges */}
          <Card className="border-0 shadow-lg bg-white backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Users className="w-5 h-5 text-amber-500" />
                  Judges ({judges.length})
                </CardTitle>
                <Button
                  type="button"
                  onClick={addJudge}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none border-amber-300"
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
                          <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
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
                          className="text-amber-500 hover:text-amber-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-500" />
                          <Label className="text-gray-700 font-medium">Wallet Address *</Label>
                        </div>
                        <Input
                          value={judge.address}
                          onChange={(e) => updateJudge(index, 'address', e.target.value)}
                          placeholder="0x..."
                          className={`font-mono text-sm bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 ${
                            isDuplicateAddress(judge.address, index) ? 'border-red-500' : ''
                          }`}
                        />
                        {isDuplicateAddress(judge.address, index) && (
                          <p className="text-red-500 text-xs mt-1">
                            This address is already used by another judge
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-yellow-500" />
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

          {/* Token approval section removed in new flow */}

          {/* Preview Section */}
          {(formData.name) && (
            <Card className="border-0 shadow-lg bg-white backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Eye className="w-5 h-5 text-amber-600" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-sm text-gray-600 mb-4">
                  Here's how your hackathon will appear to users:
                </div>
                
                {/* Explorer Card Preview */}
                <div>
                  <h4 className="text-md font-semibold text-gray-700 mb-3">Explorer Page Card</h4>
                  <div className="bg-white border border-amber-100 rounded-lg overflow-hidden shadow-sm max-w-sm mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-50/60 via-orange-50/30 to-amber-50/60"></div>
                    <div className="relative z-10 p-6 flex flex-col h-full">
                      {/* Header with Title and Image */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 pr-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
                            {formData.name || 'Your Hackathon Name'}
                          </h3>
                          
                          {/* Status Badge */}
                          <div className="mb-4">
                            <Badge className="text-xs font-medium px-3 py-1 bg-amber-100 text-amber-800 border-amber-200 shadow-sm">
                              🔥 ACCEPTING SUBMISSIONS
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Image */}
                        <div className="flex-shrink-0">
                          <div className="h-16 w-16 relative">
                            <img
                              src={formData.imageURL || getImagePath("/block.png")}
                              alt="Preview Image"
                              className="h-full w-full object-contain rounded-lg"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getImagePath("/block.png");
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Dates */}
                      <div className="flex items-center justify-center gap-2 text-gray-600 mb-3">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-medium text-center">
                          {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'Start Date'}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                        <span className="text-xs font-medium text-center">
                          to {formData.endDate ? new Date(formData.endDate).toLocaleDateString() : 'End Date'}
                        </span>
                      </div>
                      
                      {/* Prize */}
                      <div className="mt-auto">
                        <div className="flex items-center justify-center gap-2 text-amber-700 font-bold bg-amber-50 px-3 py-2 rounded-full border border-amber-200">
                            <span className="text-sm">Prize pool funded post-creation</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Hackathon Page Header Preview */}
                <div>
                  <h4 className="text-md font-semibold text-gray-700 mb-3">Hackathon Page Header</h4>
                  <div className="relative overflow-hidden rounded-lg shadow-md max-w-2xl mx-auto">
                    {/* Background Image */}
                    <div className="absolute inset-0">
                      <img 
                        src={formData.imageURL || getImagePath("/block.png")}
                        alt="Preview Background"
                        className="w-full h-48 object-cover object-right"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getImagePath("/block.png");
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
                    </div>
                    
                    {/* Content Overlay */}
                    <div className="relative z-10 flex items-center h-48 p-6">
                      <div className="flex-1 space-y-3">
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                          Accepting Submissions
                        </Badge>
                        <h1 className="text-2xl font-black text-white leading-tight">
                          {formData.name || 'Your Hackathon Name'}
                        </h1>
                        <div className="flex items-center space-x-4 text-white/90">
                          <div className="flex items-center space-x-2">Prize pool will be funded by sponsors</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-600 text-sm">{validationError}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
              <Button
              type="submit"
              size="lg"
                disabled={isLoading}
              className="bg-[#FAE5C3] text-[#8B6914] hover:bg-[#8B6914] hover:text-white px-12 py-3 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Hackathon...
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
