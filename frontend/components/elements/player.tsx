"use client";

import Image from "next/image";
import Defimg from "@/public/err.jpg";
import type { StaticImageData } from "next/image";

interface PlayerProps {
  img?: StaticImageData;
  isBlurred: boolean; // Add a prop to handle blur state
}

export default function Player({ img = Defimg, isBlurred }: PlayerProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 w-full h-[9vh] overflow-hidden -z-5 ${
        isBlurred ? "backdrop-blur-sm" : ""
      }`}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center -z-10"
        style={{
          backgroundImage: `url(${typeof img === "string" ? img : img.src})`,
          filter: "blur(10px)",
          transform: "scale(1.1)", // Slightly scale up to avoid blur edges
        }}
      />

      {/* Overlay with transparency */}
      <div className="absolute inset-0 dark:bg-gray-800/60 bg-gray-200/60 backdrop-blur-md -z-5" />

      {/* Player content */}
      <div className="relative h-full flex justify-center items-center z-10">
        {/* Player controls */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-md overflow-hidden relative">
            <Image
              src={img || "/placeholder.svg"}
              alt="Now playing"
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
          <div className="text-sm">
            <div className="font-medium">Now Playing</div>
            <div className="text-muted-foreground">Track Title</div>
          </div>
        </div>
      </div>
    </div>
  );
}
