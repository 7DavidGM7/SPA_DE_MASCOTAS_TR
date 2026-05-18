"use client"

import { PawIcon } from "@/components/icons/paw-icon"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  showText?: boolean
  size?: "sm" | "md" | "lg"
}

const sizes = {
  sm: { icon: 28, text: "text-xl" },
  md: { icon: 40, text: "text-2xl" },
  lg: { icon: 56, text: "text-4xl" },
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const { icon, text } = sizes[size]
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div className="bg-primary rounded-2xl p-2 shadow-md">
          <PawIcon size={icon} className="text-primary-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent rounded-full" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-bold text-primary leading-none", text)}>
            Pet Spa
          </span>
          <span className="text-sm text-muted-foreground">
            Cuidamos a tu mejor amigo
          </span>
        </div>
      )}
    </div>
  )
}
