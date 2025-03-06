"use client"

import type React from "react"

import { useState, useRef, useEffect, SetStateAction, Dispatch } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface AnimatedSearchBarProps {
  onSearch?: (query: string) => void
  isExpanded: boolean
  setIsExpanded: Dispatch<SetStateAction<boolean>>
}

export default function AnimatedSearchBar({ onSearch, isExpanded, setIsExpanded }: AnimatedSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Set mounted state for animations to work properly
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  useEffect(() => {
    if (onSearch) {
      onSearch(searchQuery)
    }
  }, [searchQuery, onSearch])

  const handleFocus = () => {
    setIsExpanded(true)
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Don't collapse if clicking on the clear button
    if (e.relatedTarget && containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }

    if (!searchQuery) {
      setIsExpanded(false)
    }
  }

  const handleClear = () => {
    setSearchQuery("")
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const expandSearch = () => {
    setIsExpanded(true)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 150)
  }

  return (
    <div className="w-full sm:ml-4">
      <div
        ref={containerRef}
        className={`relative ${isMounted ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
      >
        <div
          className={`
              relative flex items-center overflow-hidden rounded-full 
              border border-input bg-background shadow-sm
              transition-all duration-500 ease-out
              ${isExpanded ? "w-full ring-2 ring-accent/50" : " sm:w-2/6 w-10"}
              
              hover:border-accent hover:shadow-md
            `}
        >
          <Button
            variant="ghost"
            size="icon"
            className={`
                absolute left-0 h-9 w-9 shrink-0 rounded-full 
                text-muted-foreground transition-all duration-300
                ${isExpanded ? "rotate-0" : "rotate-0"}
                hover:bg-transparent hover:text-accent
              `}
            onClick={expandSearch}
          >
            <Search
              className={`
                h-4 w-4 transition-all duration-300
                ${isExpanded ? "scale-100" : "scale-110"}
                ${searchQuery && isExpanded ? "text-accent" : ""}
              `}
            />
            <span className="sr-only">Search</span>
          </Button>
          <Input
            ref={inputRef}
            id="search-input"
            type="text"
            placeholder="Search..."
            className={`
                h-10 border-none bg-transparent
                focus-visible:ring-0 focus-visible:ring-offset-0
                transition-all duration-300 ease-out
                ${isExpanded ? "w-full pl-10" : "w-[calc(100%-40px)] pl-10 text-ellipsis"}
              `}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className={`
                  absolute right-1 h-8 w-8 shrink-0 rounded-full 
                  text-muted-foreground transition-all duration-300
                  ${searchQuery ? "opacity-100 scale-100" : "opacity-0 scale-75"}
                  hover:text-accent hover:bg-transparent
                `}
              onClick={handleClear}
              tabIndex={searchQuery ? 0 : -1}
              disabled={!searchQuery}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Pulse animation when expanded but empty */}
        {isExpanded && !searchQuery && (
          <div className="absolute inset-0 -z-10 animate-pulse-slow rounded-full opacity-0">
            <div className="h-full w-full rounded-full bg-accent/20"></div>
          </div>
        )}
      </div>
    </div>
  )
}

