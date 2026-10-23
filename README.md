# Finanzas Santi

Dashboard financiero en React, TypeScript y Vite. La primera pantalla usa datos ficticios en modo demostración, indicado de forma visible; los movimientos añadidos en ese modo viven solo en memoria.

## Desarrollo

Requiere Node.js 22 o posterior y npm. Desde la raíz ejecuta `npm ci`, `npm test`, `npm run build` y `npm run dev`.

## Seguridad y estado

El esquema inicial de Supabase está en `supabase/migrations`. Incluye políticas RLS por propietario y trazabilidad de cambios. Aún debe aplicarse y probarse en el proyecto `Finanzas-santi`; la conexión remota no estuvo disponible durante el onboarding. La interfaz no conecta datos reales ni incluye credenciales.

La tabla `authorized_owners` queda vacía y cerrada por defecto: ningún cliente puede leerla ni escribirla. Después de configurar Auth y validar la cuenta del propietario, se debe añadir su UUID desde el SQL Editor de Supabase. La aplicación todavía no incluye el flujo Auth ni lectura/escritura persistente.

El alta del propietario requiere una acción administrativa en Supabase: buscar el usuario ya autenticado por su identidad verificada en `auth.users`, revisar el UUID resultante y añadir ese UUID a `public.authorized_owners`. No se debe insertar un identificador sin verificar ni habilitar auto-registro como propietario.

La hoja histórica no estuvo accesible y no había una exportación local adjunta. No se ha importado información real. Antes de habilitar el modo productivo se deben validar el propietario autorizado y el inicio de sesión, ejecutar pruebas RLS en Supabase, mapear las 13 pestañas reales y revisar los totales de control.

## GitHub Pages

El workflow `.github/workflows/pages.yml` compila y publica al recibir cambios en `main`. Requiere activar GitHub Actions como fuente de Pages en la configuración del repositorio. Publicar el demo no implica aprobación para datos financieros reales.

Las pruebas automáticas de frontend se ejecutan en CI. La tarea de CI también inicia Supabase local, aplica migraciones y ejecuta `supabase/tests`. En este entorno Docker no pudo descargar las imágenes oficiales desde `public.ecr.aws` (respuesta 403), así que ese gate aún no está validado localmente.
