"use client"

import { cn } from "@/lib/utils"

interface PawIconProps {
  className?: string
  size?: number
}

export function PawIcon({ className, size = 24 }: PawIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={cn("", className)}
    >
      <path d="M12 10.5c-1.5 0-3 1.5-3 3.5 0 1.5.5 2.5 1.5 3.5.7.7 1.5 1.5 1.5 2.5s-.8 2-2 2c-1.5 0-3-1-4-2-1.5-1.5-2-3.5-2-5.5 0-3 2.5-6 6-6s6 3 6 6c0 2-.5 4-2 5.5-1 1-2.5 2-4 2-1.2 0-2-1-2-2s.8-1.8 1.5-2.5c1-1 1.5-2 1.5-3.5 0-2-1.5-3.5-3-3.5z" />
      <ellipse cx="7" cy="6.5" rx="2" ry="2.5" />
      <ellipse cx="17" cy="6.5" rx="2" ry="2.5" />
      <ellipse cx="4.5" cy="11" rx="1.5" ry="2" />
      <ellipse cx="19.5" cy="11" rx="1.5" ry="2" />
    </svg>
  )
}
