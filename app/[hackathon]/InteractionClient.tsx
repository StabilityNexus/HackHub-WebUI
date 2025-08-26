"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  // Let Next.js handle the basePath automatically through the configuration
  return path;
};

import { HackathonData, getHackathonStatus, getDaysRemaining, Judge, Project } from "@/hooks/useHackathons"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/utils/config"
import { HACKHUB_ABI } from "@/utils/contractABI/HackHub"
import { formatEther, parseEther, parseAbiItem, parseUnits } from "viem"
import { 
  Trophy, 
  Users, 
  Target, 
  Calendar,
  Vote,
  Gavel,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  History,
  Settings,
  Code,
  FileText
} from "lucide-react"
import { useChainId, useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi"
import { toast } from "sonner"
import Link from "next/link"
import { formatUTCTimestamp } from '@/utils/timeUtils'
import { hackathonDB } from '@/lib/indexedDB'
import { IERC20MinimalABI } from '@/utils/contractABI/Interfaces'

// ERC20 ABI for token symbol/decimals
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

export default function InteractionClient() {
  type SponsorContribution = { token: string; amount: bigint }
  type Sponsor = { address: string; name: string; image: string; contributions: SponsorContribution[] }
  const [hackathonData, setHackathonData] = useState<HackathonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [approvedTokens, setApprovedTokens] = useState<string[]>([])
  const [tokenMinAmounts, setTokenMinAmounts] = useState<Record<string, bigint>>({})
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({})
  const [tokenTotals, setTokenTotals] = useState<Record<string, bigint>>({})
  const [tokenDecimals, setTokenDecimals] = useState<Record<string, number>>({})
  const [sponsors, setSponsors] = useState<Sponsor[]>([])

  const [depositToken, setDepositToken] = useState<string>("")
  const [depositAmount, setDepositAmount] = useState<string>("")
  const [sponsorName, setSponsorName] = useState<string>("")
  const [sponsorImage, setSponsorImage] = useState<string>("")
  const [isDepositing, setIsDepositing] = useState(false)
  const [isSubmittingToken, setIsSubmittingToken] = useState(false)
  const [submitTokenAddress, setSubmitTokenAddress] = useState<string>("")
  const [submitTokenName, setSubmitTokenName] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [isApprovingToken, setIsApprovingToken] = useState(false)
  
  // Form state
  const [projectName, setProjectName] = useState("")
  const [sourceCode, setSourceCode] = useState("")
  const [documentation, setDocumentation] = useState("")
  const [prizeRecipient, setPrizeRecipient] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  
  // Modal state for external links
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLink, setModalLink] = useState({ url: '', type: '' })
  
  const searchParams = useSearchParams()
  const hackAddr = searchParams.get('hackAddr')
  const urlChainId = searchParams.get('chainId')
  
  const chainId = useChainId()
  const { address: userAddress, isConnected } = useAccount()
  const { writeContract, data: depositHash } = useWriteContract()
  const { writeContract: writeApproval, data: approvalHash } = useWriteContract()
  const { isLoading: isApprovalLoading, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash })
  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess, error: depositError } = useWaitForTransactionReceipt({ hash: depositHash })
  
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

  // Check if user is a judge
  const isUserJudge = hackathonData?.judges.some(j => 
    j.address.toLowerCase() === (userAddress || '').toLowerCase()
  )

  const userJudge = hackathonData?.judges.find(j => 
    j.address.toLowerCase() === (userAddress || '').toLowerCase()
  )

  // Check if user is the organizer
  const isUserOrganizer = hackathonData?.organizer.toLowerCase() === (userAddress || '').toLowerCase()

  const short = (addr: string) => `${addr.slice(0,6)}...${addr.slice(-4)}`

  // Format token amounts for display - convert from base units to human-readable
  const formatTokenAmount = (amount: bigint, token: string): string => {
    if (token === '0x0000000000000000000000000000000000000000') {
      // ETH - convert from wei to ether for display with up to 4 decimal places
      const etherValue = Number(formatEther(amount))
      const result = etherValue.toFixed(4)
      // Remove trailing zeros and decimal point if not needed
      return parseFloat(result).toString()
    } else {
      // ERC20 - convert using token decimals for display
      const decimals = tokenDecimals[token] ?? 18
      const divisor = BigInt(10) ** BigInt(decimals)
      const wholeTokens = amount / divisor
      const result = wholeTokens.toString()
      return result
    }
  }



  // Manual sync function for the sync button
  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    await fetchHackathonData()
    setSyncing(false)
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
        name,
        startDate,
        startTime,
        endDate,
        endTime,
        totalTokens,
        concluded,
        organizer,
        factory,
        judgeCount,
        projectCount,
        imageURL,
      ] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'name' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startDate' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'startTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endDate' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'endTime' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'totalTokens' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'concluded' }) as Promise<boolean>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'owner' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'factory' }) as Promise<string>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'judgeCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'projectCount' }) as Promise<bigint>,
        publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'imageURL' }) as Promise<string>,
      ])

      // Load approved tokens and their minimums (optional on legacy contracts)
      // Use local copies within this function to avoid relying on async state updates
      let localApprovedTokens: string[] = []
      let localTokenTotals: Record<string, bigint> = {}
      let localTokenSymbols: Record<string, string> = {}
      let localSponsors: Sponsor[] = []
      try {
        const tokens = await publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'getApprovedTokensList' }) as string[]
        console.log('Approved tokens from contract:', tokens)
        setApprovedTokens(tokens)
        const mins: Record<string, bigint> = {}
        const symbols: Record<string, string> = {}
        const totals: Record<string, bigint> = {}
        const decimalsMap: Record<string, number> = {}
        for (const t of tokens) {
          try {
            const min = await publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'getTokenMinAmount', args: [t as `0x${string}`] }) as bigint
            mins[t] = min
            console.log(`✅ Token ${t} min amount:`, min.toString(), 'BigInt value:', min)
          } catch (e) {
            console.warn(`❌ Failed to get min amount for token ${t}:`, e)
            mins[t] = BigInt(0)
          }
          try {
            const total = await publicClient.readContract({ address: contractAddress, abi: HACKHUB_ABI, functionName: 'getTokenTotal', args: [t as `0x${string}`] }) as bigint
            totals[t] = total
            console.log(`Token ${t} total:`, total.toString())
          } catch (e) {
            console.warn(`Failed to get total for token ${t}:`, e)
            totals[t] = BigInt(0)
          }
          try {
            if (t === '0x0000000000000000000000000000000000000000') {
              symbols[t] = 'ETH'
              decimalsMap[t] = 18 // ETH has 18 decimals
            } else {
              const sym = await publicClient.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }) as string
              symbols[t] = sym
              try {
                const dec = await publicClient.readContract({ address: t as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }) as number
                decimalsMap[t] = dec
              } catch {}
            }
          } catch {
            symbols[t] = t === '0x0000000000000000000000000000000000000000' ? 'ETH' : short(t)
            if (t === '0x0000000000000000000000000000000000000000') {
              decimalsMap[t] = 18 // ETH has 18 decimals
            }
          }
        }
        console.log('📊 Setting tokenMinAmounts state:', mins)
        setTokenMinAmounts(mins)
        setTokenSymbols(symbols)
        setTokenTotals(totals)
        setTokenDecimals(decimalsMap)
        // capture for local computation later in this call
        localApprovedTokens = tokens
        localTokenTotals = totals
        localTokenSymbols = symbols
        // Fetch sponsors via direct getter if available; fallback to logs
        try {
          let sponsorAddresses: string[] = []
          try {
            sponsorAddresses = await publicClient.readContract({
              address: contractAddress,
              abi: HACKHUB_ABI,
              functionName: 'getAllSponsors'
            }) as string[]
            console.log('getAllSponsors returned:', sponsorAddresses.length, sponsorAddresses)
          } catch (getterErr) {
            console.log('getAllSponsors failed, trying alternative discovery:', getterErr)
            // Try to find sponsors by checking if organizer or connected user are sponsors
            const potentialSponsors = [
              organizer, // organizer might be a sponsor
              userAddress, // current user might be a sponsor
            ].filter(Boolean) as string[]
            
            console.log('Checking potential sponsors:', potentialSponsors)
            for (const addr of potentialSponsors) {
              for (const t of tokens) {
                try {
                  const amt = await publicClient.readContract({
                    address: contractAddress,
                    abi: HACKHUB_ABI,
                    functionName: 'getSponsorTokenAmount',
                    args: [addr as `0x${string}`, t as `0x${string}`]
                  }) as bigint
                  if (amt && amt > BigInt(0)) {
                    sponsorAddresses.push(addr)
                    console.log('Found sponsor via alternative method:', addr)
                    break // found this sponsor, move to next
                  }
                } catch {}
              }
            }
          }



          // Remove duplicates from sponsor addresses
          const uniqueSponsorAddresses = Array.from(new Set(sponsorAddresses))
          console.log('Unique sponsor addresses:', uniqueSponsorAddresses.length, uniqueSponsorAddresses)
          
          const sponsorsData: Sponsor[] = []
          for (const s of uniqueSponsorAddresses) {
            try {
              const [name, image] = await publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'getSponsorProfile',
                args: [s as `0x${string}`]
              }) as [string, string]
              console.log(`Sponsor ${s} profile:`, { name, image })
              
              const contributions: SponsorContribution[] = []
              for (const t of tokens) {
                try {
                  const amt = await publicClient.readContract({
                    address: contractAddress,
                    abi: HACKHUB_ABI,
                    functionName: 'getSponsorTokenAmount',
                    args: [s as `0x${string}`, t as `0x${string}`]
                  }) as bigint

                  if (amt && amt > BigInt(0)) {
                    contributions.push({ token: t, amount: amt })
                    console.log(`Sponsor ${s} contributed ${amt.toString()} of token ${t}`)
                  }
                } catch (e) {
                  console.warn(`Failed to get sponsor amount for ${s} and token ${t}:`, e)
                }
              }
              if (contributions.length > 0 || name || image) {
                sponsorsData.push({ address: s, name, image, contributions })
                console.log(`Added sponsor:`, { address: s, name, image, contributions: contributions.length })
              }
            } catch (e) {
              console.warn(`Failed to get sponsor profile for ${s}:`, e)
            }
          }

          console.log('📊 Setting sponsors:', sponsorsData.length, sponsorsData)
          setSponsors(sponsorsData)
          localSponsors = sponsorsData
        } catch (e) {
          console.warn('Failed to fetch sponsors', e)
          setSponsors([])
        }
      } catch (e) {
        console.warn('Sponsorship functions unavailable on this contract, continuing without approved tokens.', e)
        setApprovedTokens([])
        setTokenMinAmounts({})
        setTokenSymbols({})
        setTokenTotals({})
        setSponsors([])
        localApprovedTokens = []
        localTokenTotals = {}
        localTokenSymbols = {}
        localSponsors = []
      }

      // Fetch judges
      const judges: Judge[] = []
      if (Number(judgeCount) > 0) {
        try {
          const judgeAddresses = await publicClient.readContract({ 
            address: contractAddress, 
            abi: HACKHUB_ABI, 
            functionName: 'getAllJudges'
          }) as string[]

          for (let i = 0; i < judgeAddresses.length; i++) {
            try {
              // Get judge tokens allocated and remaining
              const [judgeTokens, remainingTokens] = await Promise.all([
                publicClient.readContract({
                  address: contractAddress,
                  abi: HACKHUB_ABI,
                  functionName: 'judgeTokens',
                  args: [judgeAddresses[i] as `0x${string}`]
                }) as Promise<bigint>,
                publicClient.readContract({
                  address: contractAddress,
                  abi: HACKHUB_ABI,
                  functionName: 'remainingJudgeTokens',
                  args: [judgeAddresses[i] as `0x${string}`]
                }) as Promise<bigint>
              ])

              judges.push({
                address: judgeAddresses[i],
                name: `Judge ${i + 1}`, // Use generic name since names are no longer stored
                tokensAllocated: Number(judgeTokens),
                tokensRemaining: Number(remainingTokens)
              })
            } catch (judgeError) {
              console.error(`Error fetching judge ${i} data:`, judgeError)
            }
          }
        } catch (judgeError) {
          console.error('Error fetching judges:', judgeError)
        }
      }

      // Fetch projects
      const projects: Project[] = []
      if (Number(projectCount) > 0) {
        for (let i = 0; i < Number(projectCount); i++) {
          try {
            const [projectInfo, projectTokens, prizeClaimed] = await Promise.all([
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'projects',
                args: [BigInt(i)]
              }) as Promise<[string, string, string, string, string]>, // [submitter, recipient, sourceCode, docs]
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'projectTokens',
                args: [BigInt(i)]
              }) as Promise<bigint>,
              publicClient.readContract({
                address: contractAddress,
                abi: HACKHUB_ABI,
                functionName: 'prizeClaimed',
                args: [BigInt(i)]
              }) as Promise<boolean>
            ])

            const total = Number(totalTokens)
            const sharePercent = total > 0 ? (Number(projectTokens) / total) * 100 : 0
            // Compute per-token payout amounts (formatted as whole numbers)
            const payouts = localApprovedTokens.map((t) => {
              const poolTotal = localTokenTotals[t] ?? BigInt(0)
              const denom = totalTokens === BigInt(0) ? BigInt(1) : totalTokens
              const amount = (poolTotal * (projectTokens as bigint)) / denom
              return { token: t, amount: Math.floor(Number(amount)).toString(), symbol: localTokenSymbols[t] }
            })
            projects.push({
              id: i,
              submitter: projectInfo[0],
              recipient: projectInfo[1],
              name: projectInfo[2],
              sourceCode: projectInfo[3],
              docs: projectInfo[4],
              tokensReceived: Number(projectTokens),
              estimatedPrize: 0,
              formattedPrize: `${sharePercent.toFixed(2)}% of each token pool`,
              payouts,
              prizeClaimed
            })
          } catch (projectError) {
            console.error(`Error fetching project ${i}:`, projectError)
          }
        }
      }

      // Remaining tokens are already fetched directly from the contract above

      const hackathon: HackathonData = {
        id: 0, // Not used for individual pages
        contractAddress,
        hackathonName: name,
        startDate: Number(startDate),
        startTime: Number(startTime),
        endDate: Number(endDate),
        endTime: Number(endTime),
        prizePool: '0',
        totalTokens: Number(totalTokens),
        concluded,
        organizer,
        factory,
        judgeCount: Number(judgeCount),
        projectCount: Number(projectCount),
        judges,
        projects,
        image: imageURL || getImagePath("/block.png"),
      }

      setHackathonData(hackathon)
      setLastSynced(new Date())
      console.log('📊 Saving hackathon data with judges:', judges.length, judges)
      console.log('📊 Saving sponsors data:', localSponsors.length, localSponsors)
      try {
        // Save extended hackathon details including all interaction data
        await hackathonDB.setExtendedHackathonDetails(contractAddress, chainId, {
          hackathonData: hackathon,
          approvedTokens: localApprovedTokens,
          tokenMinAmounts: tokenMinAmounts,
          tokenSymbols: localTokenSymbols,
          tokenTotals: localTokenTotals,
          tokenDecimals: tokenDecimals,
          sponsors: localSponsors
        })
      } catch (error) {
        console.warn('Failed to save extended hackathon details to cache:', error)
      }
    } catch (err) {
      console.error('Error fetching hackathon data:', err)
      setError('Failed to load hackathon data from blockchain')
    } finally {
      setLoading(false)
    }
  }

  // Submit or edit project
  const handleSubmitProject = async () => {
    if (!projectName.trim() || !sourceCode.trim() || !documentation.trim()) {
      toast.error("Please provide project name, source code, and documentation links")
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
      
      // Use prize recipient if provided, otherwise use user's address
      const recipient = prizeRecipient.trim() || userAddress

      if (isEditing) {
        await writeContract({
          address: contractAddress,
          abi: HACKHUB_ABI,
          functionName: 'submitProject',
          args: [projectName.trim(), sourceCode.trim(), documentation.trim(), recipient as `0x${string}`],
        })
        toast.success("Project updated successfully!")
      } else {
        await writeContract({
          address: contractAddress,
          abi: HACKHUB_ABI,
          functionName: 'submitProject',
          args: [projectName.trim(), sourceCode.trim(), documentation.trim(), recipient as `0x${string}`],
        })
        toast.success("Project submitted successfully!")
      }

      setSubmissionOpen(false)
      setProjectName("")
      setSourceCode("")
      setDocumentation("")
      setPrizeRecipient("")
      setIsEditing(false)
      
      // Refresh data after submission
      setTimeout(() => {
        fetchHackathonData()
      }, 1000)
      
    } catch (err: any) {
      console.error('Error submitting project:', err)
      toast.error(err?.message || "Failed to submit project")
    } finally {
      setSubmitting(false)
    }
  }

  // Handle opening external links with modal
  const handleOpenLink = (url: string, type: string) => {
    setModalLink({ url, type })
    setModalOpen(true)
  }

  // Handle edit project
  const handleEditProject = () => {
    const userProject = hackathonData?.projects.find(p => 
      p.submitter.toLowerCase() === (userAddress || '').toLowerCase()
    )
    
    if (!userProject) return
    
    setProjectName(userProject.name || '')
    setSourceCode(userProject.sourceCode)
    setDocumentation(userProject.docs)
    setPrizeRecipient(userProject.recipient === userAddress ? "" : userProject.recipient)
    setIsEditing(true)
    setSubmissionOpen(true)
  }



  // Load data on mount: cache-first, only fetch from blockchain if no cache or error
  useEffect(() => {
    const load = async () => {
      if (!contractAddress) return
      
      let shouldFetchFromBlockchain = false
      
      try {
        const cached = await hackathonDB.getExtendedHackathonDetails(contractAddress, chainId)
        if (cached) {
          console.log('📊 Loading hackathon data from cache with judges:', cached.hackathonData.judges?.length, cached.hackathonData.judges)
          // Restore all state from cache (types are already converted by IndexedDB)
          setHackathonData(cached.hackathonData)
          setApprovedTokens(cached.approvedTokens)
          setTokenMinAmounts(cached.tokenMinAmounts)
          setTokenSymbols(cached.tokenSymbols)
          setTokenTotals(cached.tokenTotals)
          setTokenDecimals(cached.tokenDecimals)
          console.log('📊 Loading sponsors from cache:', cached.sponsors?.length, cached.sponsors)
          setSponsors(cached.sponsors)
          
          // Set last synced from cache timestamp
          setLastSynced(new Date(cached.timestamp))
          setLoading(false)
          // Successfully loaded from cache, no need to fetch from blockchain
          return
        } else {
          // No cached data found, need to fetch from blockchain
          shouldFetchFromBlockchain = true
        }
      } catch (error) {
        console.warn('Error loading from IndexedDB cache:', error)
        // Cache error, need to fetch from blockchain
        shouldFetchFromBlockchain = true
      }
      
      // Only fetch from blockchain if no cache data or cache error
      if (shouldFetchFromBlockchain) {
        await fetchHackathonData()
      }
    }
    load()
  }, [contractAddress, chainId])

  // ERC20 allowance for sponsor deposit
  const isERC20Selected = Boolean(depositToken && depositToken !== '0x0000000000000000000000000000000000000000')
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: (isERC20Selected ? depositToken : undefined) as `0x${string}` | undefined,
    abi: IERC20MinimalABI,
    functionName: 'allowance',
    args: isERC20Selected && userAddress && contractAddress ? [userAddress as `0x${string}`, contractAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(isERC20Selected && userAddress && contractAddress) }
  })

  // Check user's token balance
  const { data: userTokenBalance, refetch: refetchBalance } = useReadContract({
    address: (isERC20Selected ? depositToken : undefined) as `0x${string}` | undefined,
    abi: IERC20MinimalABI,
    functionName: 'balanceOf',
    args: isERC20Selected && userAddress ? [userAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(isERC20Selected && userAddress) }
  })

  useEffect(() => {
    if (!isERC20Selected || !depositAmount) {
      setNeedsApproval(false)
      return
    }
    let required: bigint = 0n
    try {
      const dec = tokenDecimals[depositToken] ?? 18
      required = parseUnits(depositAmount, dec)
    } catch {
      try { required = BigInt(depositAmount) } catch { required = 0n }
    }
    const allowance = (currentAllowance as bigint | undefined) ?? 0n
    setNeedsApproval(allowance < required)
  }, [isERC20Selected, depositAmount, currentAllowance, depositToken, tokenDecimals])

  useEffect(() => {
    if (isApprovalSuccess) {
      refetchAllowance()
      setIsApprovingToken(false)
    }
  }, [isApprovalSuccess, refetchAllowance])

  // Monitor deposit transaction status
  useEffect(() => {
    if (isDepositSuccess) {
      console.log('✅ Deposit transaction successful:', depositHash)
      toast.success('Deposit confirmed on blockchain!')
      // Refresh data after successful deposit
      setTimeout(() => {
        fetchHackathonData()
        refetchAllowance() // Check if allowance was consumed
        refetchBalance() // Check if balance was deducted
      }, 2000)
    }
  }, [isDepositSuccess, depositHash, refetchAllowance, refetchBalance])

  useEffect(() => {
    if (depositError) {
      console.error('❌ Deposit transaction failed:', depositError)
      toast.error(`Deposit failed: ${depositError.message}`)
    }
  }, [depositError])

  useEffect(() => {
    if (isDepositLoading) {
      console.log('⏳ Deposit transaction pending:', depositHash)
      toast.info('Deposit transaction submitted, waiting for confirmation...')
    }
  }, [isDepositLoading, depositHash])

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
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{color: '#8B6914'}} />
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
      case 'accepting-submissions':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Accepting Submissions - {daysRemaining} days left</Badge>
      case 'judging-submissions':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Judging Submissions</Badge>
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

  const handleDeposit = async () => {
    if (!contractAddress) return
    if (urlChainId && Number(urlChainId) !== chainId) {
      toast.error(`Wrong network. Please switch to chain ${urlChainId} to sponsor.`)
      return
    }
    if (!depositToken) return toast.error('Select a token')
    if (!depositAmount || Number(depositAmount) <= 0) return toast.error('Enter amount')
    
    // Additional validation for ERC20 tokens
    if (isERC20Selected && needsApproval) {
      return toast.error('Please approve token spending first')
    }
    
    try {
      setIsDepositing(true)
      // For ETH we take human input in ether; for ERC20 we try human input using decimals, fallback to raw base units if parse fails
      let amountArg: bigint
      if (depositToken === '0x0000000000000000000000000000000000000000') {
        amountArg = parseEther(depositAmount)
      } else {
        try {
          // fetch decimals dynamically for the selected token
          const dec = await getPublicClient(config).readContract({ address: depositToken as `0x${string}` , abi: ERC20_ABI, functionName: 'decimals' }) as number
          amountArg = parseUnits(depositAmount, dec)
        } catch {
          // fallback: expect base units already
          amountArg = BigInt(depositAmount)
        }
      }
      
      console.log('Deposit details:', {
        token: depositToken,
        amount: amountArg.toString(),
        isERC20: isERC20Selected,
        needsApproval,
        currentAllowance: currentAllowance?.toString(),
        userBalance: userTokenBalance?.toString()
      })

      // Check if user has enough balance
      if (isERC20Selected && userTokenBalance && userTokenBalance < amountArg) {
        toast.error(`Insufficient balance. You have ${Math.floor(Number(userTokenBalance))} but need ${Math.floor(Number(amountArg))}`)
        return
      }
      
      const args = [depositToken as `0x${string}`, amountArg, sponsorName || 'Anonymous', sponsorImage || getImagePath('/placeholder-logo.png')] as const
      
      const txConfig = {
        address: contractAddress,
        abi: HACKHUB_ABI,
        functionName: 'depositToToken',
        args,
        value: depositToken === '0x0000000000000000000000000000000000000000' ? amountArg : undefined
      } as const
      
      console.log('Transaction config:', txConfig)
      
      await writeContract(txConfig)
      toast.success('Deposit submitted')
      setDepositAmount('')
      setSponsorName('')
      setSponsorImage('')
    } catch (e: any) {
      console.error('Deposit error:', e)
      toast.error(e?.message || 'Deposit failed')
    } finally {
      setIsDepositing(false)
      // refresh sponsor and token totals shortly after
      setTimeout(() => {
        fetchHackathonData()
      }, 1500)
    }
  }

  const handleApproveTokenSpending = async () => {
    if (!contractAddress || !isERC20Selected || !userAddress) return
    let amount: bigint
    try {
      const dec = tokenDecimals[depositToken] ?? 18
      amount = parseUnits(depositAmount, dec)
    } catch {
      try { amount = BigInt(depositAmount) } catch {
        toast.error('Enter a valid amount')
        return
      }
    }
    try {
      setIsApprovingToken(true)
      await writeApproval({
        address: depositToken as `0x${string}`,
        abi: IERC20MinimalABI,
        functionName: 'approve',
        args: [contractAddress as `0x${string}`, amount]
      })
    } catch (e: any) {
      console.error(e)
      setIsApprovingToken(false)
      toast.error(e?.message || 'Approval failed')
    }
  }

  const handleSubmitToken = async () => {
    if (!contractAddress) return
    if (!submitTokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(submitTokenAddress)) {
      return toast.error('Enter a valid ERC20 token address')
    }
    if (!submitTokenName.trim()) {
      return toast.error('Provide a token name')
    }
    try {
      // Preflight: avoid duplicate submission
      try {
        const publicClient = getPublicClient(config)
        const [, , exists] = await publicClient.readContract({
          address: contractAddress,
          abi: HACKHUB_ABI,
          functionName: 'getTokenSubmission',
          args: [submitTokenAddress as `0x${string}`]
        }) as [string, string, boolean]
        if (exists) {
          toast.error('This token has already been submitted')
          return
        }
      } catch {
        // If getter not available, continue; contract will enforce
      }

      setIsSubmittingToken(true)
      await writeContract({
        address: contractAddress,
        abi: HACKHUB_ABI,
        functionName: 'submitToken',
        args: [submitTokenAddress as `0x${string}`, submitTokenName.trim()]
      })
      toast.success('Token submitted for approval')
      setSubmitTokenAddress('')
      setSubmitTokenName('')
    } catch (e: any) {
      console.error(e)
      const msg = String(e?.message || '')
      if (msg.includes('TokenAlreadySubmitted')) {
        toast.error('Token already submitted')
      } else {
        toast.error(e?.message || 'Submit failed')
      }
    } finally {
      setIsSubmittingToken(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header - Enhanced with custom image background */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={hackathonData.image}
            alt="Hackathon Background"
            className="w-full h-80 object-cover object-right"
            onError={(e) => {
              // Fallback to hacka-thon.jpg if custom image fails to load
              const target = e.target as HTMLImageElement;
              target.src = getImagePath("/hacka-thon.jpg");
            }}
          />
          {/* Gradient Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>
        
        {/* Content Overlay */}
        <div className="relative z-10 flex items-center justify-between h-80 p-8">
          {/* Left side - Hackathon Info */}
          <div className="flex-1 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center space-x-4">
              {getStatusBadge()}
              <span className="text-white/90 text-sm font-medium">
                Network: {getNetworkName(chainId)}
              </span>
            </div>
            
            {/* Hackathon Name - Main focal point */}
            <div className="space-y-3">
              <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
                {hackathonData.hackathonName}
              </h1>
              <div className="flex items-center space-x-6 text-white/90">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">Multiple-token Prize Pool</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-lg">{hackathonData.projectCount} Projects</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Sync Button */}
          <div className="flex flex-col items-end space-y-4">
            <Button
              onClick={handleSync}
              disabled={syncing || loading}
              className="bg-white/20 backdrop-blur-sm text-black border border-gray-300 hover:bg-white/30 hover:border-white/50 transition-all duration-200 flex items-center gap-2"
              size="lg"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </Button>
            
            {lastSynced && (
              <div className="text-gray-800 text-sm text-right">
                <div>Last synced:</div>
                <div className="text-xs opacity-90">{lastSynced.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Decorative Element */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About This Hackathon */}
          <Card className="border bg-white border-gray-300 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-black">About This Hackathon</CardTitle>
                <div className="flex items-center gap-2">
                  <Link href={`/organizer?address=${hackathonData.organizer}`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Organizer's Events
                    </Button>
                  </Link>
                  {isUserOrganizer && (
                    <Link href={`/manage?hackAddr=${hackAddr}&chainId=${urlChainId}`}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Manage
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-black leading-relaxed mb-6">
                Join this Web3 hackathon and compete for a share of a multi-token prize pool funded by sponsors and the organizer. 
                Submit your project during the submission period and get votes from judges to win prizes.
              </p>
              
              {/* Hackathon Technical Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Contract Address */}
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">Smart Contract</span>
                    </div>
                    <p className="text-xs font-mono text-gray-700 break-all bg-white/60 p-2 rounded border">
                      {hackathonData.contractAddress}
                    </p>
                  </div>
                  
                  {/* Organizer Address */}
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">Organizer</span>
                    </div>
                    <p className="text-xs font-mono text-gray-700 break-all bg-white/60 p-2 rounded border">
                      {hackathonData.organizer}
                    </p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border shadow-sm border-gray-300 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center text-black gap-2">
                <Calendar className="w-5 h-5" style={{color: '#8B6914'}} />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'upcoming' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                  <div>
                    <p className="font-semibold text-gray-800">Hackathon Starts</p>
                    <p className="text-sm text-muted-foreground">
                      {formatUTCTimestamp(hackathonData.startTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'judging-submissions' || status === 'concluded' ? 'bg-green-500' : status === 'accepting-submissions' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-semibold text-gray-800">Submission Deadline</p>
                    <p className="text-sm text-muted-foreground">
                      {formatUTCTimestamp(hackathonData.endTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${hackathonData.concluded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-semibold text-gray-800">Hackathon Concluded</p>
                    <p className="text-sm text-muted-foreground">
                      {hackathonData.concluded ? 'Completed - Winners can claim prizes' : 'Pending organizer conclusion'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approved Tokens */}
          {approvedTokens.length > 0 && (
            <Card className="border bg-white border-gray-300 shadow-sm">
              <CardHeader>
                <CardTitle className="text-black">Prize Pool</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {approvedTokens.map((t) => (
                    <div key={t} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                      <div className="text-sm text-gray-800">
                        <div className="font-semibold">{t === '0x0000000000000000000000000000000000000000' ? 'Native ETH' : (tokenSymbols[t] || short(t))}</div>
                        <div className="text-xs text-muted-foreground">{t === '0x0000000000000000000000000000000000000000' ? 'ETH' : short(t)}</div>
                      </div>
                      <div className="text-right text-xs text-gray-700">
                        <div>Total: {formatTokenAmount(tokenTotals[t] ?? BigInt(0), t)}</div>
                        <div>Min deposit: {(() => {
                          // Hardcode ETH minimum to 1 Wei
                          if (t === '0x0000000000000000000000000000000000000000') {
                            return '1 Wei' // 1 Wei = 0.000000000000000001 ETH, but showing practical minimum
                          }
                          const minAmount = tokenMinAmounts[t]
                          if (minAmount !== undefined && minAmount > BigInt(0)) {
                            return formatTokenAmount(minAmount, t)
                          }
                          return 'No minimum'
                        })()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}





          {/* Judges Section */}
          <Card className="border bg-white border-gray-300 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-black gap-2">
                <Gavel className="w-5 h-5" style={{color: '#8B6914'}} />
                Judges & Voting Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Stats at the top */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg border">
                  <Vote className="w-8 h-8 mx-auto mb-2" style={{color: '#8B6914'}} />
                  <p className="text-2xl font-bold" style={{color: '#8B6914'}}>{hackathonData.totalTokens}</p>
                  <p className="text-md font-bold text-gray-800 text-muted-foreground">Total Voting Tokens</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border" >
                  <Users className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold" style={{color: '#8B6914'}}>{hackathonData.judgeCount}</p>
                  <p className="text-md font-bold text-gray-800 text-muted-foreground">Judges</p>
                </div>
              </div>
              <div className="space-y-4">
                {hackathonData.judges.map((judge, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-amber-100 text-amber-700">
                          {judge.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-gray-800">{judge.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {judge.address.slice(0, 6)}...{judge.address.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Vote className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-semibold text-gray-800">
                            {judge.tokensRemaining} remaining out of {judge.tokensAllocated}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Sponsors */}
          {sponsors.length > 0 && (
            <Card className="border bg-white border-gray-300 shadow-sm">
              <CardHeader>
                <CardTitle className="text-black">Sponsors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {sponsors.map((s) => (
                    <div key={s.address} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center">
                          {s.image ? (
                            <img 
                              src={s.image} 
                              alt={s.name || short(s.address)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Hide the image and show fallback text if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-xs font-semibold text-amber-700">${(s.name || short(s.address)).slice(0, 2).toUpperCase()}</span>`;
                                }
                              }}
                            />
                          ) : (
                            <span className="text-xs font-semibold text-amber-700">
                              {(s.name || short(s.address)).slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{s.name || short(s.address)}</p>
                          <p className="text-xs text-muted-foreground">{short(s.address)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {s.contributions.map((c, idx) => (
                          <div key={`${s.address}-${c.token}-${idx}`} className="text-xs text-gray-700">
                            {tokenSymbols[c.token] || short(c.token)}: {formatTokenAmount(c.amount, c.token)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Token for Approval */}
          <Card className="border bg-white border-gray-300 shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Submit Token for Approval</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-sm">ERC20 Token Address</Label>
              <Input value={submitTokenAddress} onChange={e => setSubmitTokenAddress(e.target.value)} placeholder="0x..." className="bg-white border-gray-300 text-black" />
              <Label className="text-sm">Token Name</Label>
              <Input value={submitTokenName} onChange={e => setSubmitTokenName(e.target.value)} placeholder="e.g., USDC" className="bg-white border-gray-300 text-black" />
              <Button onClick={handleSubmitToken} disabled={isSubmittingToken || !submitTokenAddress} className="w-full bg-[#8B6914] text-white hover:bg-[#A0471D]">
                {isSubmittingToken ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>) : 'Submit ERC20 Token'}
              </Button>
              <p className="text-xs text-gray-600">Submit ERC20 tokens for organizer approval. ETH is always available as a sponsorship option.</p>
            </CardContent>
          </Card>

          {/* Deposit / Sponsor */}
          <Card className="border bg-white border-gray-300 shadow-sm">
            <CardHeader>
              <CardTitle className="text-black">Become a Sponsor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-sm">Select Token</Label>
              <select className="w-full border rounded p-2 bg-white text-black" value={depositToken} onChange={e => setDepositToken(e.target.value)}>
                <option value="">Choose token</option>
                <option value={'0x0000000000000000000000000000000000000000'}>Native ETH</option>
                {approvedTokens.filter(t => t !== '0x0000000000000000000000000000000000000000').map(t => (
                  <option key={t} value={t}>{tokenSymbols[t] || short(t)}</option>
                ))}
              </select>
              <Label className="text-sm">Amount</Label>
              <Input value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder={isERC20Selected ? 'Amount (e.g., 100)' : 'Amount in ETH (e.g., 0.5)'} className="bg-white border-gray-300 text-black" />
              {isERC20Selected && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-600">
                    {needsApproval ? 'Approval required' : 'Approved'}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleApproveTokenSpending} disabled={!needsApproval || isApprovingToken || isApprovalLoading} className="border-amber-300 text-[#8B6914] hover:bg-[#FAE5C3]">
                    {isApprovingToken || isApprovalLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approving...</>) : 'Approve'}
                  </Button>
                </div>
              )}
              <Label className="text-sm">Sponsor Name</Label>
              <Input value={sponsorName} onChange={e => setSponsorName(e.target.value)} placeholder="Your brand name" className="bg-white border-gray-300 text-black" />
              <Label className="text-sm">Sponsor Image URL</Label>
              <Input value={sponsorImage} onChange={e => setSponsorImage(e.target.value)} placeholder="https://..." className="bg-white border-gray-300 text-black" />
              <Button onClick={handleDeposit} disabled={Boolean(isDepositing || !depositToken || !depositAmount || (isERC20Selected && needsApproval))} className="w-full bg-[#8B6914] text-white hover:bg-[#A0471D]">
                {isDepositing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Depositing...</>) : 'Deposit'}
              </Button>
              {depositToken && (
                <p className="text-xs text-gray-600">
                  Min amount to be listed: {
                    depositToken === '0x0000000000000000000000000000000000000000'
                      ? '0.0001 ETH' // Practical minimum for ETH
                      : tokenMinAmounts[depositToken] !== undefined && tokenMinAmounts[depositToken] > BigInt(0) 
                        ? formatTokenAmount(tokenMinAmounts[depositToken], depositToken)
                        : 'No minimum required'
                  }
                </p>
              )}
            </CardContent>
          </Card>


          {/* Judge Voting Interface */}
          {isUserJudge && (
            <Card className="border shadow-sm border-gray-300 bg-white">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Gavel className="w-12 h-12 mx-auto" style={{color: '#8B6914'}} />
                  <h3 className="font-bold text-lg text-gray-800">Judge Dashboard</h3>
                  <p className="text-sm text-muted-foreground text-gray-800">
                    You have {userJudge?.tokensRemaining} voting tokens remaining
                  </p>
                  
                  <Link href={`/h/judge?hackAddr=${hackAddr}&chainId=${urlChainId}`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none mt-4 border-gray-300"
                      disabled={!hackathonData.projects.length}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Judge Submitted Projects
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* View Projects */}
          {hackathonData.projects.length > 0 && (
            <Card className="border shadow-sm border-gray-300 bg-white">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Target className="w-12 h-12 mx-auto" style={{color: '#8B6914'}} />
                  <h3 className="font-bold text-lg text-gray-800">View Submitted Projects</h3>
                  <p className="text-sm text-muted-foreground text-gray-800">
                    {hackathonData.projects.length} projects submitted to this hackathon
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Total Votes Cast:</span>
                      <span className="font-semibold">{hackathonData.totalTokens}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Prizes Claimed:</span>
                      <span className="font-semibold">
                        {hackathonData.projects.filter(p => p.prizeClaimed).length}
                      </span>
                    </div>
                  </div>
                  
                  <Link href={`/projects?hackAddr=${hackAddr}&chainId=${urlChainId}`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none mt-4 border-gray-300"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View All Projects
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Submission */}
          {status === 'accepting-submissions' && (
            <Card className="border shadow-sm border-gray-300 bg-white">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Target className="w-12 h-12 mx-auto" style={{color: '#8B6914'}} />
                  <h3 className="font-bold text-lg text-gray-800">Ready to Participate?</h3>
                  {userProject ? (
                    <div className="space-y-3">
                      <p className="text-sm text-green-600 text-gray-800">✓ You have already submitted a project!</p>
                      <p className="text-sm text-green-600 text-gray-800">To submit another project, please connect with another wallet address</p>
                      <p className="text-xs text-muted-foreground text-gray-800">
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
                        className="w-full border-amber-300 bg-white text-[#8B6914] hover:bg-[#FAE5C3] hover:text-gray-800 hover:border-none"
                        disabled={!isConnected}
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (userProject) {
                            handleEditProject()
                          } else {
                            setIsEditing(false)
                            setSourceCode("")
                            setDocumentation("")
                            setPrizeRecipient("")
                          }
                        }}
                      >
                        {!isConnected ? 'Connect Wallet' : userProject ? 'Edit Submission' : 'Submit Project'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Your Project' : 'Submit Your Project'}</DialogTitle>
                        <DialogDescription>
                          {isEditing 
                            ? 'Update your project submission details.' 
                            : 'Submit your project with source code and documentation links. Both must be publicly accessible.'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="projectName">Project Name</Label>
                          <Input
                            id="projectName"
                            placeholder="Enter your project name"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                          />
                        </div>
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
                          <Label htmlFor="documentation">Documentation Link</Label>
                          <Input
                            id="documentation"
                            placeholder="https://docs.google.com/document/... or README link"
                            value={documentation}
                            onChange={(e) => setDocumentation(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Link to your project documentation (README, Google Docs, etc.)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="prizeRecipient">Prize Recipient Address (Optional)</Label>
                          <Input
                            id="prizeRecipient"
                            placeholder="Leave empty to use your wallet address"
                            value={prizeRecipient}
                            onChange={(e) => setPrizeRecipient(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            The address that will receive the prize if your project wins. Leave empty to use your connected wallet address.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSubmissionOpen(false)
                            setIsEditing(false)
                            setSourceCode("")
                            setDocumentation("")
                            setPrizeRecipient("")
                          }}
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
                              {isEditing ? 'Updating...' : 'Submitting...'}
                            </>
                          ) : (
                            isEditing ? 'Update Project' : 'Submit Project'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* External Link Warning Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#8B6914]">
              <AlertCircle className="w-5 h-5" />
              External Link Warning
            </DialogTitle>
            <DialogDescription>
              You are about to visit an external website. Please verify the URL before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">{modalLink.type} URL:</Label>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-sm font-mono text-gray-800 break-all">{modalLink.url}</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.open(modalLink.url, '_blank', 'noopener,noreferrer')
                setModalOpen(false)
              }}
              className="hover:bg-[#8B6914] hover:text-white hover:border-amber-300 bg-[#FAE5C3] text-gray-800 border-none"
            >
              Open Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
