"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, X } from "lucide-react"
// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  // For static export, we need to ensure the path works with GitHub Pages
  return path.startsWith('/') ? path : `/${path}`;
};

export default function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: "/explorer", label: "Explore Hackathons" },
    { href: "/createHackathon", label: "Organize a Hackathon" },
    { href: "/myHackathons", label: "My Hackathons" }
  ]

  const isActive = (href: string) => {
    if (href === "/explorer") return pathname === "/explorer"
    if (href === "/createHackathon") return pathname === "/createHackathon"
    if (href === "/myHackathons") return pathname === "/myHackathons"
    return false
  }

  return (
    <header className="border-b border-amber-100/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center">
              <img 
                src={getImagePath("/block.png")} 
                alt="HackHub Logo" 
                width={48} 
                height={48}
                className="object-contain w-full h-full"
              />
            </div>
            <span className="font-bold text-xl sm:text-2xl md:text-3xl bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
              HackHub
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost"
                  className={`${
                    isActive(link.href)
                      ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                      : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                  } transition-all duration-200 font-medium`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ConnectButton />
            </div>
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col gap-4 mt-8">
                  <div className="sm:hidden mb-4">
                    <ConnectButton />
                  </div>
                  {navLinks.map((link) => (
                    <Link 
                      key={link.href} 
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button 
                        variant="ghost"
                        className={`w-full justify-start ${
                          isActive(link.href)
                            ? "text-amber-800 bg-amber-50 font-semibold shadow-sm" 
                            : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
                        } transition-all duration-200 font-medium`}
                      >
                        {link.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
} 