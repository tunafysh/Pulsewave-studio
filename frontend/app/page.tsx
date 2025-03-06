"use client"

import AnimatedSearchBar from "@/components/elements/animated-search-bar"
import { ExpandableCardDemo } from "@/components/elements/card"
import { useState } from "react"

export default function Home() {
  const [isExpanded, setIsExpanded] = useState(false)
  return(
    <main className="p-4" >

      <div className="flex flex-row ">
        <AnimatedSearchBar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
        <br />
        <br />
        <br />
        <br />
      </div>
        <ExpandableCardDemo/>
    </main>
  )
}
