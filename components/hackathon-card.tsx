'use client'

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Trophy, Users, Vote, Gavel, Star } from "lucide-react"
import { HackathonData, getDaysRemaining, getHackathonStatus } from "@/hooks/useHackathons"
import { useChainId } from "wagmi"

interface HackathonCardProps {
  hackathon: HackathonData
  showJoinButton?: boolean
}

export default function HackathonCard({
  hackathon,
  showJoinButton = true,
}: HackathonCardProps) {
  const status = getHackathonStatus(
    hackathon.startTime,
    hackathon.endTime,
    hackathon.concluded
  )
  const chainId = useChainId()

  const hackathonUrl = `/h?hackAddr=${hackathon.contractAddress}&chainId=${chainId}`

  const getStatusBadge = () => {
    const base = "text-white shadow-sm text-xs sm:text-sm"
    switch (status) {
      case "upcoming":
        return <Badge className={`${base} bg-blue-500`}>Upcoming</Badge>
      case "accepting-submissions":
        return <Badge className={`${base} bg-green-500`}>Accepting Submissions</Badge>
      case "judging-submissions":
        return <Badge className={`${base} bg-orange-500`}>Judging Submissions</Badge>
      case "concluded":
        return <Badge className={`${base} bg-slate-500`}>Concluded</Badge>
      default:
        return <Badge className={`${base} bg-slate-500`}>Unknown</Badge>
    }
  }

  return (
    <Card
      className="
        relative
        flex
        h-full
        flex-col
        overflow-hidden
        border
        border-border
        bg-card
        shadow-sm
        transition
        md:hover:shadow-lg
        md:hover:-translate-y-1
      "
    >
      {/* Image */}
      <div className="relative">
        <img
          src={hackathon.image || "/placeholder.svg"}
          alt={hackathon.hackathonName}
          className="h-40 w-full object-cover sm:h-48"
        />

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {hackathon.featured && (
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          )}
          {getStatusBadge()}
        </div>
      </div>

      {/* Content */}
      <CardContent className="flex flex-grow flex-col gap-4 p-4 sm:p-6">
        {/* Title */}
        <div>
          <h3 className="text-lg font-bold sm:text-xl text-foreground">
            {hackathon.hackathonName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {hackathon.description || "Web3 Hackathon"}
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-600" />
            <span className="font-medium">
              {hackathon.prizePool} ETH
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-blue-600" />
            <span className="text-muted-foreground">
              {hackathon.judgeCount} judges
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">
              {hackathon.projectCount} projects
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Vote className="h-4 w-4 text-orange-600" />
            <span className="text-muted-foreground">
              {hackathon.totalTokens} voting tokens
            </span>
          </div>
        </div>

        {/* Tags */}
        {hackathon.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hackathon.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {hackathon.organizer.slice(2, 4).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">
              {hackathon.organizer.slice(0, 6)}…{hackathon.organizer.slice(-4)}
            </span>
          </div>

          {showJoinButton && (
            <Link href={hackathonUrl} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                View Details
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
