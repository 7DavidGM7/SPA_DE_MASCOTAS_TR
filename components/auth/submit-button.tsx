"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SubmitButtonProps {
  children: React.ReactNode
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

export function SubmitButton({
  children,
  isLoading = false,
  disabled = false,
  className,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      className={cn(
        "w-full py-3.5 px-6 rounded-xl font-semibold text-base",
        "bg-primary text-primary-foreground",
        "shadow-lg shadow-primary/25",
        "transition-all duration-300 ease-out",
        "hover:bg-[#2F5C8A] hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30",
        "active:scale-[0.98]",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg",
        className
      )}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Procesando...</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
