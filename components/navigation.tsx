"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu } from "lucide-react"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  return path.startsWith('/') ? path : `/${path}`;
};

export default function Navigation() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="border-b border-amber-100/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity -ml-8 md:-ml-4">
            <div className="w-12 h-12 flex items-center justify-center">
              <img 
                src={getImagePath("/block.png")} 
                alt="HackHub Logo" 
                width={48} 
                height={48}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-3xl bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
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
                  pathname === "/createHackathon" 
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
                  pathname === "/myHackathons" 
                    ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                    : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                } transition-all duration-200 font-medium`}
              >
                My Hackathons
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* Mobile Menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/explorer" className="cursor-pointer">
                      Explore Hackathons
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/createHackathon" className="cursor-pointer">
                      Organize a Hackathon
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/myHackathons" className="cursor-pointer">
                      My Hackathons
                    </Link>
                  </DropdownMenuItem>
                  <div className="border-t my-2"></div>
                  <div className="px-2 py-2" suppressHydrationWarning>
                    {mounted && <ConnectButton />}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Connect Button */}
            <div className="hidden md:block" suppressHydrationWarning>
              {mounted && <ConnectButton />}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}