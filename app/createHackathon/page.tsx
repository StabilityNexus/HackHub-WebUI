'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Plus, Trash2, Calendar, Clock, Users, Trophy, Sparkles, Info } from 'lucide-react'
import { HACKHUB_FACTORY_ABI } from '@/utils/contractABI/HackHubFactory'
import { HackHubFactoryAddress } from '@/utils/contractAddress'
import { isAddress, parseEther } from 'viem'

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
    prizePool: ''
  })
  
  const [judges, setJudges] = useState<Judge[]>([
    { address: '', name: '', tokens: '' }
  ])
  
  const [validationError, setValidationError] = useState<string>('')
  const [showInfo, setShowInfo] = useState<{ [key: string]: boolean }>({})

  const { writeContract, data: hash, error: writeError } = useWriteContract()
  const { isLoading, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })

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

    // Check prize pool is valid
    const prizeAmount = parseFloat(formData.prizePool)
    if (isNaN(prizeAmount) || prizeAmount <= 0) {
      setValidationError('Prize pool must be a positive number')
      return false
    }

    // Check dates
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`)
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`)
    const now = new Date()

    if (startDateTime <= now) {
      setValidationError('Start date must be in the future')
      return false
    }

    if (endDateTime <= startDateTime) {
      setValidationError('End date must be after start date')
      return false
    }

    // Check judges
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

      // Convert dates to required formats
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`)
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`)
      
      const startDate = parseInt(formData.startDate.replace(/-/g, '')) // YYYYMMDD
      const startTime = Math.floor(startDateTime.getTime() / 1000) // Unix timestamp
      const endDate = parseInt(formData.endDate.replace(/-/g, '')) // YYYYMMDD
      const endTime = Math.floor(endDateTime.getTime() / 1000) // Unix timestamp

      // Prepare judge data
      const judgeAddresses = judges.map(j => j.address as `0x${string}`)
      const judgeNames = judges.map(j => j.name)
      const judgeTokens = judges.map(j => BigInt(parseInt(j.tokens)))

      // Log the parameters being sent
      console.log('Creating hackathon with params:', {
        name: formData.name,
        startDate: BigInt(startDate),
        startTime: BigInt(startTime),
        endDate: BigInt(endDate),
        endTime: BigInt(endTime),
        judges: judgeAddresses,
        judgeNames,
        judgeTokens,
        value: formData.prizePool + ' ETH',
        chainId,
        factoryAddress: HackHubFactoryAddress[chainId]
      })

      await writeContract({
        address: HackHubFactoryAddress[534351],
        abi: HACKHUB_FACTORY_ABI,
        functionName: 'createHackathon',
        args: [
          formData.name,
          BigInt(startDate),
          BigInt(startTime),
          BigInt(endDate),
          BigInt(endTime),
          judgeAddresses,
          judgeNames,
          judgeTokens
        ],
        value: parseEther(formData.prizePool)
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
            onClick={() => router.push('/explorer')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explorer
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
              Create Hackathon
            </h1>
            <p className="text-muted-foreground mt-2">Launch your Web3 hackathon on the blockchain</p>
            {chainId && (
              <p className="text-sm text-muted-foreground mt-1">
                Connected to Chain ID: {chainId} {chainId === 534351 ? '✅' : '❌ (Switch to Scroll Sepolia)'}
              </p>
            )}
          </div>
          
          <div className="w-32" /> {/* Spacer for centering */}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Sparkles className="w-5 h-5 text-amber-600" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hackathon Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="name">Hackathon Name *</Label>
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
                  className="border-amber-200 focus:border-amber-500"
                />
                {showInfo.name && (
                  <p className="text-sm text-muted-foreground">
                    Choose a unique and descriptive name for your hackathon
                  </p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <Label>Start Date & Time *</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="border-blue-200 focus:border-blue-500"
                    />
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    <Label>End Date & Time *</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="border-red-200 focus:border-red-500"
                    />
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="border-red-200 focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Prize Pool */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <Label htmlFor="prizePool">Prize Pool (ETH) *</Label>
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
                  step="0.01"
                  min="0"
                  value={formData.prizePool}
                  onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                  placeholder="Enter prize pool amount"
                  className="border-yellow-200 focus:border-yellow-500"
                />
                {showInfo.prizePool && (
                  <p className="text-sm text-muted-foreground">
                    The total prize pool that will be distributed to winners based on voting results
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Judges */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Users className="w-5 h-5 text-green-600" />
                  Judges ({judges.length})
                </CardTitle>
                <Button
                  type="button"
                  onClick={addJudge}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Judge
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {judges.map((judge, index) => (
                <Card key={index} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-green-100">
                            J{index + 1}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">Judge {index + 1}</span>
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
                        <Label>Wallet Address *</Label>
                        <Input
                          value={judge.address}
                          onChange={(e) => updateJudge(index, 'address', e.target.value)}
                          placeholder="0x..."
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Judge Name *</Label>
                        <Input
                          value={judge.name}
                          onChange={(e) => updateJudge(index, 'name', e.target.value)}
                          placeholder="Enter judge name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Voting Tokens *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={judge.tokens}
                          onChange={(e) => updateJudge(index, 'tokens', e.target.value)}
                          placeholder="100"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

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
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white px-12 py-3 shadow-md hover:shadow-lg transition-all"
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
