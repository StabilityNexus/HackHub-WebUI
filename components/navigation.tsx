"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ConnectButton } from "@rainbow-me/rainbowkit"

// Helper function to get the correct image path for GitHub Pages
const getImagePath = (path: string) => {
  return path.startsWith("/") ? path : `/${path}`
}

export default function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b border-amber-100/60 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
              <img
                src={getImagePath("/block.png")}
                alt="HackHub Logo"
                className="object-contain w-10 h-10 sm:w-12 sm:h-12"
              />
            </div>
            <span className="font-bold text-xl sm:text-2xl lg:text-3xl bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
              HackHub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavButton href="/explorer" active={pathname === "/explorer"}>
              Explore Hackathons
            </NavButton>
            <NavButton href="/createHackathon" active={pathname === "/createHackathon"}>
              Organize a Hackathon
            </NavButton>
            <NavButton href="/myHackathons" active={pathname === "/myHackathons"}>
              My Hackathons
            </NavButton>
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ConnectButton />
            </div>

            {/* Hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden flex flex-col justify-center gap-1.5 p-2"
              aria-label="Open menu"
            >
              <span className="w-6 h-0.5 bg-gray-800" />
              <span className="w-6 h-0.5 bg-gray-800" />
              <span className="w-6 h-0.5 bg-gray-800" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden border-t border-amber-100 bg-white">
          <nav className="flex flex-col px-4 py-3 gap-2">
            <MobileLink href="/explorer" onClick={() => setOpen(false)}>
              Explore Hackathons
            </MobileLink>
            <MobileLink href="/createHackathon" onClick={() => setOpen(false)}>
              Organize a Hackathon
            </MobileLink>
            <MobileLink href="/myHackathons" onClick={() => setOpen(false)}>
              My Hackathons
            </MobileLink>

            <div className="pt-2 sm:hidden">
              <ConnectButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

/* ---------- helpers ---------- */

function NavButton({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={`${
          active
            ? "text-amber-800 bg-amber-50 font-semibold shadow-sm"
            : "text-gray-700 hover:text-amber-800 hover:bg-amber-50/80"
        } transition-all duration-200 font-medium`}
      >
        {children}
      </Button>
    </Link>
  )
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-2 rounded-md text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition font-medium"
    >
      {children}
    </Link>
  )
}
