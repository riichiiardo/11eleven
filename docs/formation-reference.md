# Referencia de dibujos de FC27

El catálogo seleccionable se contrastó el 20 de noviembre de 2026 con las 29
opciones visibles en https://www.futbin.com/27/squad-builder y con la referencia
del usuario https://www.futbin.com/27/squad-builder/182076.

Se observaron cada opción, sus once roles y sus coordenadas del campo en un
constructor vacío. No se modificó ni guardó la plantilla del usuario.
Los hechos están en `src/domain/futbin-formations.ts`: posición original,
equivalente español y coordenadas relativas. No se incluyen cartas, imágenes
ni código de presentación de FUTBIN.

La pizarra normaliza la altura de los anclajes del constructor al intervalo
12–89% de nuestro campo, manteniendo su distribución relativa horizontal y
vertical. Miniaturas y pizarra consumen la misma definición de slots; no existe
un segundo dibujo independiente que pueda divergir al aplicar la formación.

FUTBIN presenta 20 esquemas de cuatro defensas, cinco de tres y cuatro de cinco.
Los anteriores esquemas siguen siendo legibles para preservar alineaciones
guardadas. La lista actual ya no ofrece variantes que no aparecían en el selector
observado, como falso nueve y rombos de 3-4-3/5-4-1.

El selector se abre bajo demanda, con búsqueda, filtros y seis miniaturas por
página. Cancelar no modifica el borrador; Aplicar recoloca sus jugadores sin
persistirlo; Guardar continúa usando el flujo de confirmación de la alineación.
