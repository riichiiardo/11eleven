# Catálogo CSV de jugadores

La fuente actual es `jugadores_sofifa_completo.csv`, SHA-256 `d744d1be74f92520f6f4b76bc842636c08e22779e5eb5249b3da18220f6ba5c5`, con 19.901 registros. [DOC]

`public.players.catalog_active` identifica los registros actuales. `source_record` conserva las ocho columnas originales, las posiciones completas, el potencial y la procedencia. Las cifras de valoración como `80+1` se interpretan como media actual 80 y variación +1 conservada en el dato original. Los valores K/M se convierten a euros enteros. [CODE]

Se conservaron 224 identificadores conciliados. Los 280 registros anteriores sin coincidencia permanecen como fichas inactivas para mantener la integridad de las plantillas iniciales y sus referencias. De ellos, 40 pertenecen a plantillas asignadas. `active_catalog_players` sirve el catálogo actual y las excepciones que siguen asignadas a un presidente. La clave `game_team` mantiene la plantilla inicial del torneo independientemente del club real del CSV. [CODE]

Instalar `csv-catalog.sql` después de los módulos de RPC. La importación se prepara en `app.catalog_csv_stage` y se aplica en una transacción con respaldo en `app.catalog_csv_backups`. Ambas tablas son privadas. Antes de confirmar se verifica el total del catálogo y la igualdad de todas las asignaciones con el respaldo. [CODE]

Se retiró el workflow recurrente de Google Sheets para que no vuelva a insertar el catálogo reemplazado. El archivo local suministrado permanece en su ruta original. [CODE]
