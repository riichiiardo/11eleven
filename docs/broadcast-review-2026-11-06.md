# Revisión de transmisiones · 6 de noviembre de 2026

## Resultado verificado

Se localizaron 17 grabaciones del canal `@SUPERNOVALEAGUEKTV` y se contrastaron visualmente 14 marcadores de Primera: cinco de J9, cinco de J10 y cuatro de J11. El informe importable es `data/broadcast-results/2026-11-06.json`; cada partido conserva video e instante. No equivale a certificar que esas jornadas contengan todos sus partidos.

Primera, Ascenso, Liga MX, Champions, Libertadores y FA Cup están creadas en el Universo confirmado «Primera Liga 11Eleven», temporada 2026. Los otros Universos permanecen sin estas altas. Las reglas de formato, ascensos, descensos y liguilla quedan configurables por administración.

Las jornadas 1–8 de las ligas están pendientes del archivo que aportará el usuario. Las copas usan sus fases propias. Las clasificaciones calculadas solo incluyen marcadores verificados y permanecen provisionales.

## Pendientes que no se presentan como completados

- La revisión íntegra y carga de las otras cinco competiciones sigue pendiente. Registrar un video en el selector no significa haber transcrito todos sus partidos.
- Los goleadores, asistentes y receptores de tarjetas de los partidos importados siguen sin verificación completa. Se conservaron como null. En los dos 0–0, el desglose de goles y asistencias es una lista vacía; las tarjetas continúan pendientes.
- El canal no ofrece transcripción en siete grabaciones. Diez sí permiten localizar pasajes por subtítulos; estos se usan como guía y no para asignar identidades o estadísticas ambiguas.
- La descarga inicial de diez minutos a 720p funcionó, pero solo contenía preparación. El intento posterior de descargar los tramos finales recibió «Sign in to confirm you are not a bot». No se obtuvo una copia completa procesable del resto del archivo.
- En los finales revisados no se muestra un informe completo de asistencias y tarjetas de todos los jugadores. La narración y el nombre del futbolista que lleva la pelota no certifican esas estadísticas.
- No se ha instalado un servicio que detecte y procese automáticamente futuras transmisiones. La lectura del archivo de resultados sí se actualiza al recibir nuevos informes verificados.

Para cerrar las estadísticas faltantes se necesita una copia accesible de las grabaciones con sus pantallas de rendimiento/estadísticas, o actas oficiales del organizador. Un extractor de video puede proponer candidatos; no debe completar nombres o cifras ausentes.

## Validación

Las pruebas ejercitan permisos, aislamiento entre Universos, temporadas, archivo/restauración de competiciones, correcciones versionadas y repetición idempotente del informe real. La prueba de navegador confirmó reproducción integrada, selección de grabaciones, navegación a la evidencia exacta y tablas sin resultados inventados.
