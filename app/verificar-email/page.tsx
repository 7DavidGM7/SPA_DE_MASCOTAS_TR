import { Suspense } from "react"
import { AuthLayout } from "@/components/auth/auth-layout"
import { VerifyEmail } from "@/components/auth/verify-email"
import { Loader2 } from "lucide-react"

export const metadata = {
  title: "Verificar Email | Pet Spa",
  description: "Verifica tu correo electrónico para activar tu cuenta de Pet Spa",
}

function VerifyEmailLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Verificación de correo"
      subtitle="Confirmando tu dirección de email"
    >
      <Suspense fallback={<VerifyEmailLoading />}>
        <VerifyEmail />
      </Suspense>
    </AuthLayout>
  )
}
