# FINANZAS SANTI — Migración trazable de las 13 pestañas (P0)

La fuente canónica es un Google Sheet privado. Su contenido **jamás se sube al repositorio**. Este cambio añade archivo privado para las 13 pestañas, incluidas pestañas vacías y filas de resumen, y observaciones tipadas para datos que no deben ingresarse automáticamente al libro mayor.

- `finance_private.source_batches`: edición/corte, estado de verificación y responsable.
- `finance_private.source_sheets`: manifiesto por pestaña con conteos de origen y destino.
- `finance_private.source_rows`: cada fila no vacía íntegra, JSON privado, posición original y SHA-256, sin accesos de escritura del navegador.
- `financial_source_observations`: referencia histórica por fuente, separada del libro mayor. Admite saldos documentados, facturas de TC, depósitos, posiciones de eToro, presupuesto y proyecciones de amortización.
- `source_migration_status`: vista de solo lectura con RLS para mostrar los 13 conteos sin exponer datos bancarios.

**Conservación de la semántica**: NO convertir cuotas previstas en pagos reales, saldo facturado de tarjeta en saldo de capital, inversiones USD en COP sin valoración/fx fechado, ni abonos a eToro en gastos de consumo. El libro de movimientos sólo recibe transacciones verificadas con categoría y cuenta conciliadas. El balance inicial de cuentas exige extracto y fecha de corte; un nombre de cuenta no acredita saldo.

**Criterio de finalización del archivo**: exactamente 13 pestañas en el manifiesto; conteos por pestaña iguales al origen; hashes por fila; 0 errores; batch marcado como verificado en la base real. **Finalización operativa** del libro mayor requiere además conciliar extractos y verificar login y transacciones en sitio publicado. Nunca equiparar un archivo completo con una contabilidad conciliada.
