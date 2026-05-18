import Link from "next/link"
import { Logo } from "@/components/ui/logo"
import { PawIcon } from "@/components/icons/paw-icon"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="sm" className="[&_span]:text-primary-foreground [&_.text-muted-foreground]:text-secondary" />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-primary-foreground font-medium hover:bg-white/10 rounded-lg transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="px-4 py-2 bg-accent text-accent-foreground font-semibold rounded-lg hover:bg-accent/90 transition-colors"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-16 md:py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 bg-secondary/30 text-primary px-4 py-2 rounded-full">
                  <PawIcon size={20} />
                  <span className="text-sm font-medium">El mejor cuidado para tu mascota</span>
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight text-balance">
                  Tu mascota merece el{" "}
                  <span className="text-primary">mejor spa</span>
                </h1>
                
                <p className="text-lg text-muted-foreground max-w-lg text-pretty">
                  En Pet Spa ofrecemos servicios de grooming, baño, corte de pelo y mucho más. 
                  Agenda tu cita en línea y dale a tu mejor amigo el cuidado que merece.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/registro"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:bg-[#2F5C8A] transition-all duration-300 hover:scale-[1.02]"
                  >
                    <PawIcon size={20} />
                    Comenzar ahora
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
                  >
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>

              {/* Right content - Decorative card */}
              <div className="relative">
                <div className="bg-card rounded-3xl shadow-2xl p-8 md:p-12 border border-border/50">
                  <div className="aspect-square max-w-sm mx-auto bg-secondary/30 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-24 h-24 bg-primary rounded-2xl shadow-lg">
                        <PawIcon size={48} className="text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Pet Spa</h3>
                        <p className="text-muted-foreground">Cuidamos a tu mejor amigo</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg rotate-12">
                  <PawIcon size={32} className="text-accent-foreground" />
                </div>
                <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shadow-lg -rotate-12">
                  <PawIcon size={24} className="text-primary" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 bg-muted px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">
              Nuestros servicios
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "Baño y Secado", description: "Limpieza profunda con productos premium para el pelaje de tu mascota" },
                { title: "Corte de Pelo", description: "Estilismo profesional adaptado a la raza y estilo de tu compañero" },
                { title: "Spa Completo", description: "Tratamiento integral con masajes relajantes y aromaterapia" },
              ].map((service, index) => (
                <div
                  key={index}
                  className="bg-card rounded-2xl p-6 shadow-lg border border-border/50 hover:shadow-xl transition-shadow"
                >
                  <div className="w-12 h-12 bg-secondary/50 rounded-xl flex items-center justify-center mb-4">
                    <PawIcon size={24} className="text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{service.title}</h3>
                  <p className="text-muted-foreground">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" className="[&_span]:text-primary-foreground [&_.text-muted-foreground]:text-secondary" />
          <p className="text-sm text-secondary">
            © {new Date().getFullYear()} Pet Spa. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
