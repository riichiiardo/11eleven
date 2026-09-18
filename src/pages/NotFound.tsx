import { motion } from "framer-motion";
import { Link } from "react-router";
import { BrandLockup } from "@/components/eleven/Brand";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutDashboard, Search } from "lucide-react";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="rail-surface flex min-h-screen flex-col items-center justify-center px-4 py-12 text-white"
    >
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center">
          <BrandLockup />
        </div>
        <p className="display mt-8 text-6xl text-white/90">404</p>
        <h1 className="display mt-2 text-2xl">Esta jugada no existe</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          La dirección que buscas no forma parte del centro de control. Puedes volver al inicio o
          entrar directamente a la gestión de tu club.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="min-h-11">
            <Link to="/dashboard">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Ir a mi club
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver al inicio
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="min-h-11 text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/dashboard/club/plantilla">
              <Search className="size-4" aria-hidden="true" />
              Ver plantilla
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
