import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Broadcast } from "../src/components/eleven/Broadcast";
import { CompetitionArchiveView } from "../src/components/eleven/CompetitionArchive";
import type { RecordedCompetition } from "../src/domain/competition-records";
import "../src/index.css";

function Preview() {
  const [data, setData] = useState<RecordedCompetition[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/broadcast-archive.json")
      .then(async (response) => {
        if (!response.ok)
          throw Error("No se pudo cargar el archivo de revisión local.");
        return response.json();
      })
      .then((next) => {
        if (active) setData(next);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <p className="text-sm text-muted-foreground">
        Prueba local de transmisión · Sin cambios en resultados ni conexión a
        Supabase.
      </p>
      <Broadcast />
      <CompetitionArchiveView data={data} error={error} />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
