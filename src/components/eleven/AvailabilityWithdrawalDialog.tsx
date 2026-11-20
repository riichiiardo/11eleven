import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AVAILABILITY_META } from "@/domain/rulesEngine";
import type { AvailabilityChange } from "@/hooks/use-squad-actions";
export function AvailabilityWithdrawalDialog({
  change,
  busy,
  onCancel,
  onConfirm,
}: {
  change: AvailabilityChange | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog
      open={Boolean(change)}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Retirar baja y cambiar situación</DialogTitle>
          <DialogDescription>
            {change?.playerName} está anunciado como baja del draft. Para
            marcarlo como «
            {change ? AVAILABILITY_META[change.availability].label : ""}», debes
            retirarlo de las bajas previstas. Dejará de estar previsto para la
            rescisión automática al abrir el draft.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Si cancelas, seguirá como baja y transferible. Las demás bajas y las
          ofertas existentes se conservan.
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {busy ? "Guardando…" : "Retirar baja y cambiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
