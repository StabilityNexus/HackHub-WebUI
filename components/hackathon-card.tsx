'use client'

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Trophy, Users, Clock, Vote, Gavel } from "lucide-react"
import { HackathonData, getDaysRemaining, getHackathonStatus } from "@/hooks/useHackathons"
import { useChainId } from "wagmi"

interface HackathonCardProps {
  hackathon: HackathonData
  showJoinButton?: boolean
}

export default function HackathonCard({ hackathon, showJoinButton = true }: HackathonCardProps) {
  const status = getHackathonStatus(hackathon.startTime, hackathon.endTime, hackathon.concluded)
  const daysRemaining = getDaysRemaining(hackathon.endTime)
  const chainId = useChainId()
  
  const getStatusBadge = () => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm">Upcoming</Badge>
      case 'accepting-submissions':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white shadow-sm">Accepting Submissions</Badge>
      case 'judging-submissions':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm">Judging Submissions</Badge>
      case 'concluded':
        return <Badge className="bg-slate-500 hover:bg-slate-600 text-white shadow-sm">Concluded</Badge>
      default:
        return <Badge className="bg-slate-500 hover:bg-slate-600 text-white shadow-sm">Unknown</Badge>
    }
  }

  // Create the URL with hackAddr and chainId parameters
  const hackathonUrl = `/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`

  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-white/80 backdrop-blur-sm">
      <div className="relative">
        <img 
          src={hackathon.image || "/placeholder.svg?height=200&width=400"} 
          alt={hackathon.hackathonName}
          className="w-full h-36 sm:h-48 object-cover rounded-t-lg"
        />
        <div className="absolute top-4 right-4">
          {getStatusBadge()}
        </div>
      </div>
      
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-3 sm:space-y-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-amber-900">{hackathon.hackathonName}</h3>
            <p className="text-muted-foreground text-xs sm:text-sm">{hackathon.description || "Web3 Hackathon"}</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-amber-100">
                <Trophy className="w-4 h-4 text-amber-600" />
              </div>
              <span className="font-semibold text-amber-700">{hackathon.prizePool} ETH</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-blue-100">
                <Gavel className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm text-muted-foreground">{hackathon.judgeCount} judges</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-green-100">
                <Users className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-muted-foreground">{hackathon.projectCount} projects</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-100">
                <Vote className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-sm text-muted-foreground">{hackathon.totalTokens} voting tokens</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(hackathon.tags || []).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100">
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                  {hackathon.organizer.slice(2, 4).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {hackathon.organizer.slice(0, 6)}...{hackathon.organizer.slice(-4)}
              </span>
            </div>
            
            {showJoinButton && (
              <Link href={hackathonUrl}>
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white shadow-sm hover:shadow-md transition-all"
                >
                  View Details
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 