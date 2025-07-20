import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import HackathonCard from "@/components/hackathon-card"
import { featuredHackathons, stats } from "@/lib/data"
import {
  Rocket,
  Users,
  Code,
  Search,
  Plus,
  Star,
  Target,
  Zap,
  ArrowRight,
  Globe,
  Coins
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white mb-6 shadow-lg">
          <Zap className="w-10 h-10" />
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
          Welcome to HackHub
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The premier platform for Web3 hackathons. Build, compete, and win with the most innovative blockchain projects.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/explorer">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white px-8 py-3 shadow-md hover:shadow-lg transition-all"
            >
              <Search className="w-5 h-5 mr-2" />
              Explore Hackathons
            </Button>
          </Link>
          <Link href="/createHackathon">
            <Button 
              size="lg" 
              variant="outline" 
              className="border-amber-200 hover:bg-amber-50 hover:border-amber-300 px-8 py-3 transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Hackathon
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon === "Rocket" ? Rocket : 
                               stat.icon === "Users" ? Users :
                               stat.icon === "Coins" ? Coins : Code
          
          return (
            <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-amber-800">{stat.value}</p>
                  </div>
                  <div className="p-3 rounded-full bg-gradient-to-r from-amber-100 to-orange-100">
                    <IconComponent className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Featured Hackathons */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-amber-800">Featured Hackathons</h2>
          <Link href="/explorer">
            <Button 
              variant="ghost" 
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
            >
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredHackathons.slice(0, 3).map((hackathon) => (
            <HackathonCard key={hackathon.id} hackathon={hackathon} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-8 border border-amber-100/50 shadow-sm">
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-amber-800">Ready to Start Your Journey?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Whether you're looking to participate in exciting hackathons or organize your own, HackHub has everything you need.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/myHackathons">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Target className="w-5 h-5 mr-2" />
                My Hackathons
              </Button>
            </Link>
            <Link href="/explorer">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-all"
              >
                <Globe className="w-5 h-5 mr-2" />
                Browse All Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

