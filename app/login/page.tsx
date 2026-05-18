import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"
import { AuthProvider } from "@/lib/auth-context"


export const metadata = {
  title: "Iniciar Sesión | Pet Spa",
  description: "Accede a tu cuenta de Pet Spa para gestionar las citas de tu mascota",
}

export default function LoginPage() {
  return (
      <AuthLayout
        title="Bienvenido de vuelta"
        subtitle="Ingresa tus credenciales para continuar"
      >
        <LoginForm />
      </AuthLayout>
  )
}
