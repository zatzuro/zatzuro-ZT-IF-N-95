# FINANZAS SANTI

Dashboard personal en React, TypeScript, Vite y Supabase, con despliegue previsto en GitHub Pages. Objetivo de costo adicional: USD 0. No añadir proveedores ni servicios sin permiso.

## Capas de información

1. **Fuente histórica (solo propietario):** 13 pestañas del libro original conservadas en `finance_private`; la pestaña originalmente vacía también está inventariada. Las filas permanecen privadas y no están en este repositorio.
2. **Observaciones de origen:** saldos con fecha de corte, ingresos y gastos documentales, posiciones y depósitos, presupuestos y proyecciones, con estado `documented`, `estimated` o `unverified`. Se consultan bajo RLS, pero no son automáticamente movimientos del libro mayor.
3. **Contabilidad operativa:** cuentas, categorías, movimientos, presupuestos, deudas, inversiones y metas. Solo los movimientos conciliados forman el flujo; traspasos tienen dos asientos atómicos y nunca se contabilizan como consumo. Sin saldos de activos verificados, el patrimonio neto figura **No conciliado**.
4. **Cerebro financiero:** reglas locales verificables; no hay integración directa con ChatGPT ni transmisión de datos privados a otro servicio.

## Autenticación y seguridad

Supabase Auth por correo/contraseña con allowlist administrativa. El acceso privado solo se concede a `auth.uid()` autorizado en `authorized_owners`; un usuario registrado no obtiene acceso por defecto. Los datos operativos y el archivo tipificado usan RLS por propietario. La versión pública del repositorio no contiene valores bancarios ni claves privadas.

La demostración pública usa exclusivamente datos ficticios y está identificada como tal. El modo privado falla cerrado si no hay configuración pública de Supabase.

## Desarrollo y QA

Requiere Node.js 22. Ejecutar `npm ci`, `npm test` y `npm run build`. CI de GitHub Actions incluye migraciones locales Supabase y pgTAP. Migraciones versionadas en `supabase/migrations/`; no repetir una migración remota sin reconciliar la tabla de historial.

El contrato de release y sus evidencias están en [docs/SENIOR-P0-REVIEW.md](docs/SENIOR-P0-REVIEW.md). **No confundir fuente archivada, QA local, esquema remoto, publicación y smoke real.**

## Release controlado en GitHub Pages

El workflow `.github/workflows/pages.yml` solo despliega `main` cuando se cumplen sus gates. Antes de integrar, comprobar en **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL` = URL pública del proyecto Supabase existente.
- `VITE_SUPABASE_PUBLISHABLE_KEY` = clave expresamente clasificada `sb_publishable_...`, nunca `service_role` ni claves secretas.

En **Settings → Pages** seleccionar **GitHub Actions** como fuente. Verificar el destino real y, cuando aplique, sus URL en configuración de Supabase Auth. Confirmar CI del HEAD, revisión de P0/P1, autenticación en el navegador, aislamiento RLS, persistencia, transacciones y cierre de sesión. **No declarar PRODUCTIVO** antes de comprobar el despliegue y el smoke con el usuario verificado.

El historial financiero nunca debe pegarse en issues, logs de compilación ni commits. Los saldos fuente, proyecciones y valores no reconciliados se muestran con su procedencia y fecha, sin inventar cotizaciones ni confirmaciones de pagos.
