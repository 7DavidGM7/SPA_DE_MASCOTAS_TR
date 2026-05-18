import { AuthLayout } from "@/components/auth/auth-layout"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata = {
  title: "Registrarse | Pet Spa",
  description: "Crea tu cuenta en Pet Spa y comienza a agendar citas para tu mascota",
}

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Únete a nuestra familia de mascotas felices"
    >
      <RegisterForm />
    </AuthLayout>
  )
}
