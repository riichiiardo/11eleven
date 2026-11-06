import { Link, useSearchParams } from "react-router";
import { Broadcast } from "@/components/eleven/Broadcast";
import { Button } from "@/components/ui/button";
import { parseBroadcastPlayback } from "@/domain/broadcast";

export default function BroadcastPage() {
  const [searchParams] = useSearchParams();
  const { selection, second } = parseBroadcastPlayback(searchParams.toString());
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-xl font-bold">Transmisiones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mira los partidos en directo y consulta las grabaciones del torneo.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/competicion">Volver a resultados</Link>
        </Button>
      </header>
      <Broadcast
        key={`${selection}:${second}`}
        initialSelection={selection}
        initialSecond={second}
      />
    </div>
  );
}
