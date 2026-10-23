# FINANZAS SANTI — traspaso al revisor Senior (P0)

Proyecto: zatzuro/zatzuro-ZT-IF-N-95; PR #1; Supabase existente: kkuihohwneefcctohcrs. Costo adicional objetivo: USD 0. No utilizar otros proveedores ni exponer datos financieros en GitHub.

## Cambios realizados en la rama

Se conserva la demostración anterior y se añade una entrada privada con Supabase Auth (correo + contraseña); sólo los usuarios verificados e incorporados a la tabla authorized_owners pueden usarla. Registro público no equivale a autorización. Si faltan las variables públicas de compilación, la aplicación bloquea el acceso real en vez de mostrar datos supuestos.

El frontend privado presenta dashboard, flujos, cuentas, categorías, gastos, ingresos, presupuestos, créditos, inversiones, patrimonio, metas y cerebro financiero determinista. La información proviene de Supabase, con paginación y tratamiento de errores sin reutilizar cifras viejas. No se transfieren movimientos a ChatGPT ni APIs externas. La función Cerebro produce hallazgos con reglas explicables y permite guardar evidencias en la tabla financiera, sujeta a RLS.

Se añadieron validaciones y pruebas de clasificación: transferencias, aportes a inversión y pagos de tarjeta no forman parte del gasto de consumo. Importes no valorados en COP no se agregan a una cifra inventada y se advierte que el total es parcial.

## Fuente y migración controlada

Fuente verificada en Google Drive: BASE DE DATOS - FINANZAS SANTI, 13 pestañas. NO se han copiado importes bancarios, correos, comprobantes, números de cuenta ni archivos de Google Drive a GitHub. La fuente no ha sido editada.

La herramienta de importación privada soporta vista previa de INGRESOS (neto después de ley) y GASTOS (consumo confirmado) desde CSV. Identifica ID externo, fecha, cuenta y categoría; separa filas aprobadas de las que deben conciliarse; usa llave externa idempotente. El usuario confirma expresamente antes de importar. Los pagos de deuda, traspasos, operaciones sin clasificación y posibles duplicados quedan fuera. No se deben confundir saldos de deuda con cuotas previstas.

Pestañas restantes en análisis de mapeo, sin importación automática aún: INVERSIÓNES, CREDITOS, DEPOSITOS ETORO, OPERACIONES ETORO, PRESUPUESTO, FONDEC - AMOR Y AMISTAD, FONDEC - ORDINARIO, FONDEC - PRIMA, CAJA SOCIAL - VIVIENDA, OCCIDENTE - LIBRANZA y DAVIVIENDA - TC GZERO. Los calendarios de amortización son en parte proyecciones, no pagos reales. Inversiones USD requieren fecha y conversión comprobada. Hasta implementar estos importadores y cuadrar controles de conteo, la migración integral es un P1 pendiente y no debe darse por terminada.

## P0: comprobaciones obligatorias antes de integración

1. Ejecutar CI del HEAD actual: frontend, build, Supabase local y pgTAP. El workflow inicial pasó 9 pruebas de frontend, migración y test local en run 39895200395. Nuevos cambios tienen test focalizado. Si ECR devuelve rate limit, reportarlo como bloqueo externo, no deshabilitar tests.
2. Aplicar migraciones en orden al proyecto Supabase conectado, verificando esquema, RLS, funciones privilegiadas, GRANT, restricciones, auditoría y advisor de seguridad. La migración de endurecimiento agrega updated_at a categories/budgets y revoca permisos inseguros de un event trigger si existe en el entorno.
3. Configurar Supabase Auth con validación de correo y URL de redirección exacta de Pages, y comprobar denegación a usuario no autorizado. Para aprobar propietario, obtener UUID de una identidad confirmada en auth.users y añadirlo mediante un canal administrativo, nunca desde el frontend.
4. En GitHub Actions Variables configurar VITE_SUPABASE_URL con URL pública del proyecto y VITE_SUPABASE_PUBLISHABLE_KEY con la clave identificada explícitamente como publishable. Nada de service_role, keys secretas ni credenciales privadas. El workflow Pages falla si falta la configuración.
5. Senior revisar diff, regresiones, RLS y los P0/P1 pendientes. Sólo después integrar a main y habilitar GitHub Pages en Settings > Pages > GitHub Actions.
6. Smoke real: abrir URL pública, confirmar acceso bloqueado anónimo, login sólo autorizado, lectura y creación, persistencia tras refrescar, RLS para otra cuenta, auditoría, barra de totales y salida de sesión.

## Límites todavía abiertos

Los traspasos COP entre cuentas propias se registran mediante RPC atómica con dos asientos e inmutabilidad. La importación CSV de transferencias externas se retiene en cuarentena hasta conciliar las contrapartidas. No hay sincronización automática con la hoja, cotizaciones de mercado ni conexión directa con modelo ChatGPT; una integración externa requeriría otra decisión de arquitectura y control de costos.

Estados IMPLEMENTADO / QA APROBADO / INTEGRADO / PUBLICADO / VALIDADO REAL se acreditan separadamente. No se permite que CI verde de la demo inicial haga pasar el nuevo HEAD como aprobado.

## Checkpoint de continuidad — 2026-10-23, auditoría Senior

- Supabase remoto: migraciones 001–010 ya aplicadas, un usuario Auth confirmado y autorizado, 13 manifiestos del archivo fuente cotejados por conteo contra Google Sheets, observaciones tipificadas de las hojas con datos y saldos documentados de créditos (sin divulgar conteos privados en este repositorio). No reimportar ni duplicar.
- Evidencia remota RLS (SQL en transacción revertida): propietario autorizado ve las 13 hojas del archivo privado, observaciones del propietario y sus créditos; identidad no autorizada ve cero y no supera la función de autorización; rol anónimo carece de SELECT y EXECUTE de importación.
- Aún no se han trasladado GASTOS/INGRESOS al libro mayor porque faltan conciliación de cuentas receptoras/origen y saldos iniciales acreditados. Existen documentos de GASTOS marcados sin verificar; no reclasificar transferencias como consumo.
- Las cuotas proyectadas de préstamos, los presupuestos y las posiciones eToro sin cotización comprobada permanecen separados de movimientos efectivos y patrimonio actual.
- El dashboard debe presentar patrimonio y flujo **no conciliados**, sin suponer activos cero ni capital desembolsado a partir de saldo pendiente.
- Release gate: variables públicas de Pages pendientes de lectura/configuración por operador autorizado; usuario debe probar sesión web real sin compartir contraseña. No integrar hasta CI actual, configuración pública y smoke acreditado.
