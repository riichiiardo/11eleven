import { Link } from "react-router";

export function DashboardUnavailable({ title }: { title: string }) {
  return (
    <section role="status" className="card-soft mx-auto flex max-w-[900px] flex-col gap-3 p-6">
      <h1 className="display text-2xl">{title}</h1>
      <p>No se pudieron cargar los datos de esta sección. Puedes reintentar o revisar tu liga y equipo.</p>
      <div className="flex gap-4">
        <button type="button" onClick={() => window.location.reload()} className="underline">Reintentar</button>
        <Link to="/dashboard/perfil" className="underline">Revisar mi perfil</Link>
      </div>
    </section>
  );
}
