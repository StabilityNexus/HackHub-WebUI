"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConnectButton } from '@rainbow-me/rainbowkit'
// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  // For static export, we need to ensure the path works with GitHub Pages
  return path.startsWith('/') ? path : `/${path}`;
};

export default function Navigation() {
  const pathname = usePathname()

  return (
    <header className="border-b border-amber-100/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center">
              <img 
                src={getImagePath("/block.png")} 
                alt="HackHub Logo" 
                width={48} 
                height={48}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-xl sm:text-3xl bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
              HackHub
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/explorer">
              <Button 
                variant="ghost"
                className={`${
                  pathname === "/explorer" 
                    ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                    : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                } transition-all duration-200 font-medium`}
              >
                Explore Hackathons
              </Button>
            </Link>
            <Link href="/createHackathon">
              <Button 
                variant="ghost"
                className={`${
                  pathname === "/myHackathons" 
                    ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                    : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                } transition-all duration-200 font-medium`}
              >
                Organize a Hackathon
              </Button>
            </Link>
            <Link href="/myHackathons">
              <Button 
                variant="ghost"
                className={`${
                  pathname === "/createHackathon" 
                    ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                    : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                } transition-all duration-200 font-medium`}
              >
                My Hackathons
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