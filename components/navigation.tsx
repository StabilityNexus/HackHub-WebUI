"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Menu, X } from "lucide-react"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  // For static export, we need to ensure the path works with GitHub Pages
  return path.startsWith('/') ? path : `/${path}`;
};

export default function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="border-b border-amber-100/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
            
            {/* Desktop Connect Button */}
            <div className="hidden md:block">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Menu Sidebar */}
    {mobileMenuOpen && (
      <>
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
        
        {/* Sidebar */}
        <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-amber-100">
              <span className="font-bold text-2xl bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
                Menu
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Navigation Links */}
            <nav className="flex flex-col p-4 space-y-2 flex-1">
              <Link 
                href="/explorer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button 
                  variant="ghost"
                  className={`w-full justify-start ${
                    pathname === "/explorer" 
                      ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                      : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                  } transition-all duration-200 font-medium`}
                >
                  Explore Hackathons
                </Button>
              </Link>
              
              <Link 
                href="/createHackathon"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button 
                  variant="ghost"
                  className={`w-full justify-start ${
                    pathname === "/createHackathon" 
                      ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                      : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                  } transition-all duration-200 font-medium`}
                >
                  Organize a Hackathon
                </Button>
              </Link>
              
              <Link 
                href="/myHackathons"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button 
                  variant="ghost"
                  className={`w-full justify-start ${
                    pathname === "/myHackathons" 
                      ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                      : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                  } transition-all duration-200 font-medium`}
                >
                  My Hackathons
                </Button>
              </Link>
            </nav>
            
            {/* Connect Wallet Button at Bottom */}
            <div className="p-4 border-t border-amber-100 bg-amber-50/30">
              <ConnectButton />
            </div>
          </div>
        </div>
      </>
    )}
  </>
  )
} 