"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Zap } from "lucide-react"

export default function Navigation() {
  const pathname = usePathname()

  return (
    <header className="border-b border-amber-100/60  backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-600 to-orange-500 flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
              HackHub
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/explorer">
              <Button 
                variant="ghost"
                className={pathname === "/explorer" ? "text-amber-700 bg-amber-50/50" : "hover:text-amber-700 hover:bg-amber-50/30"}
              >
                Explorer
              </Button>
            </Link>
            <Link href="/myHackathons">
              <Button 
                variant="ghost"
                className={pathname === "/explorer" ? "text-amber-700 bg-amber-50/50" : "hover:text-amber-700 hover:bg-amber-50/30"}
              >
                My Hackathons
              </Button>
            </Link>
            <Link href="/createHackathon">
              <Button 
                variant="ghost"
                className={pathname === "/explorer" ? "text-amber-700 bg-amber-50/50" : "hover:text-amber-700 hover:bg-amber-50/30"}
              >
                Create
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  )
} 