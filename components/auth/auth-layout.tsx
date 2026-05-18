"use client"

import Link from "next/link"
import { Logo } from "@/components/ui/logo"
import { PawIcon } from "@/components/icons/paw-icon"
import { ArrowLeft } from "lucide-react"
import { type ReactNode } from "react"

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="sm" className="[&_span]:text-primary-foreground [&_.text-muted-foreground]:text-secondary" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-primary-foreground font-medium hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Volver al inicio</span>
            <span className="sm:hidden">Inicio</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-card rounded-3xl shadow-xl p-8 md:p-10 border border-border/50">
            {/* Logo centered */}
            <div className="flex justify-center mb-6">
              <Logo size="lg" />
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {title}
              </h1>
              {subtitle && (
                <p className="text-muted-foreground">{subtitle}</p>
              )}
            </div>

            {/* Form Content */}
            {children}
          </div>

          {/* Decorative paws */}
          <div className="flex justify-center gap-4 mt-6 opacity-30">
            <PawIcon size={20} className="text-primary rotate-[-15deg]" />
            <PawIcon size={16} className="text-secondary-foreground rotate-[10deg]" />
            <PawIcon size={20} className="text-primary rotate-[20deg]" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Pet Spa. Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}
