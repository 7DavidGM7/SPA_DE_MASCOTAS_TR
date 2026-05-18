"use client"

import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertType = "success" | "error" | "warning" | "info"

interface AlertMessageProps {
  type: AlertType
  message: string
  className?: string
}

const alertConfig = {
  success: {
    icon: CheckCircle2,
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    textColor: "text-success",
    iconColor: "text-success",
  },
  error: {
    icon: XCircle,
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    textColor: "text-destructive",
    iconColor: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    textColor: "text-warning-foreground",
    iconColor: "text-warning",
  },
  info: {
    icon: Info,
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    textColor: "text-foreground",
    iconColor: "text-primary",
  },
}

export function AlertMessage({ type, message, className }: AlertMessageProps) {
  const config = alertConfig[type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border",
        config.bgColor,
        config.borderColor,
        className
      )}
      role="alert"
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", config.iconColor)} />
      <p className={cn("text-sm font-medium", config.textColor)}>{message}</p>
    </div>
  )
}
