import { Component, type ReactNode, type ErrorInfo } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

/** Keep the navigation available when one dashboard section cannot render. */
export class SectionErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[11Eleven] Section render failed",
      error,
      info.componentStack,
    );
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section
        role="alert"
        className="card-soft mx-auto max-w-xl p-6 space-y-4"
      >
        <h1 className="display text-xl">No se pudo mostrar esta sección</h1>
        <p>
          Ocurrió un error al cargar el contenido. Puedes reintentar o navegar a
          otra sección sin cerrar la aplicación.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => this.setState({ failed: false })}>
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Volver al inicio</Link>
          </Button>
        </div>
      </section>
    );
  }
}
