# Plan para terminar Halcyon

Revisión de la "spec" (README + promesas de la landing) contra el código actual, y plan por fases para cerrar la app.

## 1. Estado actual

| Área | Estado |
|---|---|
| Landing (`app/page.tsx`) | ✅ Completa y responsive |
| Crear/unirse a sala (`components/start-room.tsx`) | ✅ Funciona (`/room/<id>?host=1` vs `/room/<id>`) |
| Handshake WebRTC por copiar/pegar | ✅ Funciona, verificado con dos navegadores reales (ver `scripts/screenshots.mjs`) |
| Vídeo/audio, mute, cámara | ⚠️ Funciona con bugs (ver §2) |
| Chat por `RTCDataChannel` | ✅ Funciona en desktop y móvil |
| Build / typecheck | ✅ `npm run build` pasa |
| Lint, tests, CI | ❌ No existen (`next lint` no tiene ESLint instalado) |

## 2. Brechas entre la spec y el código

### Bugs (prioridad alta)
1. **Cámara negra al reactivarla** — `components/video-tile.tsx`: al apagar la cámara se desmonta el `<video>`; al volver a encenderla se monta uno nuevo pero el `useEffect` sólo depende de `stream`, así que nunca se le asigna `srcObject`. *Verificado*: `srcObject` pasa de `true` a `false` tras apagar/encender.
2. **Errores sin manejar** — `getUserMedia` denegado se traga en silencio (`initMedia().catch(() => {})`); un código inválido en `decode()` lanza una excepción no capturada y la UI se queda en "Connecting…".
3. **Etiqueta remota fija "Guest"** — en `room-client.tsx` el vídeo remoto siempre se llama "Guest", también cuando quien mira es el invitado (debería decir "Host").
4. **`disconnected` = `closed`** — una caída momentánea de red se trata como fin de llamada; no hay estado de reconexión ni aviso cuando el otro cuelga.
5. **Estado "Connecting…" engañoso** — el host muestra "Connecting…" en cuanto genera el código, aunque el invitado aún no haya hecho nada.

### Promesas de la landing no implementadas
6. **"Share the link… They join straight from the browser"** — hoy hay que intercambiar dos códigos base64 de ~2–4 KB. Es la brecha principal.
7. **"Mute, swap cameras"** — no existe cambio de cámara (frontal/trasera en móvil) ni selector de dispositivos.
8. El otro participante no ve si tú te has silenciado o apagado la cámara (no se señaliza por el data channel).

### Calidad / producción
9. Sin TURN: en redes corporativas/4G con NAT simétrico la llamada falla sin explicación.
10. Accesibilidad: `maximumScale: 1` bloquea el zoom; el `TooltipProvider` se crea por botón; faltan `aria-live` para el estado de conexión.
11. Sin favicon, Open Graph image, página 404 propia ni `manifest` (PWA).
12. Sin ESLint, sin tests, sin CI.

## 3. Plan por fases

### Fase 1 — Estabilizar ✅ hecho
- [x] Arreglar `VideoTile`: mantener el `<video>` siempre montado y ocultarlo con CSS, o usar un callback ref que asigne `srcObject`.
- [x] Manejo de errores en `use-webrtc.ts`: exponer `error` (`permission-denied`, `no-device`, `invalid-code`, `ice-failed`) y mostrarlo en `SignalPanel` con un mensaje y botón de reintento.
- [x] Validar el código pegado (try/catch en `decode`, comprobar `type === "offer"/"answer"`).
- [x] Etiqueta remota según rol (`isHost ? "Guest" : "Host"`).
- [x] Separar `disconnected` (reconectando, con timeout) de `closed`; pantalla "La llamada terminó" con botón para volver.
- [x] Mensaje `{"type":"bye"}` por el data channel al colgar para que el otro lado se entere al instante.
- [x] Estados de UI correctos: `waiting` → `invite-ready` → `connecting` → `connected`.
- [x] Indicadores de micro/cámara del otro participante (adelantado de la Fase 3).
- [x] Test e2e de la llamada completa: `npm run test:e2e` (adelantado de la Fase 5).

> Sin verificar automáticamente: el estado "Reconectando…" tras una caída de red real (difícil de simular en headless).

### Fase 2 — Cumplir la spec: unirse con un enlace ✅ hecho
Se eligió la opción **A** con un relay propio dentro de la app (sin servicios externos ni claves):
- [x] `app/api/signal/[room]` + `lib/signal-store.ts`: buzón en memoria con long-polling; sólo guarda offer/answer/ICE ~2 min; máximo 2 personas por sala (409 "room full").
- [x] `lib/signaling.ts`: interfaz `SignalingChannel` (intercambiable por WebSocket/Supabase) + cliente HTTP; envíos en orden, reintentos, `sendBeacon` al cerrar la pestaña.
- [x] `connectVia()` en el hook: *trickle ICE*; el peer con id menor hace la oferta, así funciona en cualquier orden de llegada o a la vez. Conexión en ~0,5 s en local.
- [x] Modo copiar/pegar conservado como "Connect manually with codes".
- [x] Textos de landing y README actualizados (ya no dicen "sin servidores").
- [x] e2e: host primero, invitado primero, simultáneo, sala llena, salir y volver a entrar, recarga.

**Pendiente de esta fase:**
- [ ] Hosting serverless (Vercel): el store en memoria no se comparte entre instancias → adaptador Redis/Upstash o un transporte WebSocket (requiere cuenta/claves).
- [ ] Usar el canal para `restartIce()` cuando la conexión cae (hoy sólo se espera 15 s).
- [ ] Límite de peticiones por IP en la ruta de señalización.

### Fase 3 — Funciones de llamada (≈2 días)
- [ ] Cambiar cámara (frontal/trasera) con `replaceTrack` en el `RTCRtpSender`; selector de micro/cámara en desktop.
- [x] Señalizar mute/cámara remotos por el data channel y mostrar los iconos en el tile remoto.
- [ ] Indicador de calidad de red (`getStats`: RTT, pérdida de paquetes).
- [ ] (Opcional) Compartir pantalla con `getDisplayMedia` + `replaceTrack`.
- [ ] Pantalla previa ("lobby") con nombre opcional y prueba de micro antes de entrar.

### Fase 4 — Producción (≈1–2 días)
- [ ] TURN configurable por variables de entorno (`NEXT_PUBLIC_TURN_URL`, credenciales temporales vía ruta API) — p. ej. Cloudflare Calls TURN, Metered o coturn propio.
- [ ] Favicon, `opengraph-image.tsx`, `not-found.tsx`, `manifest.webmanifest`.
- [ ] Accesibilidad: ~~quitar `maximumScale`~~ (hecho), `aria-live` en el estado, foco atrapado en el chat móvil, un único `TooltipProvider`.
- [ ] Cabeceras de seguridad (`Permissions-Policy`, CSP) en `next.config.js`.
- [ ] Despliegue en Vercel con HTTPS.

### Fase 5 — Calidad y mantenimiento (en paralelo)
- [ ] ESLint (`eslint-config-next`) y Prettier.
- [ ] Tests unitarios del hook (Vitest) y **e2e con Playwright** reutilizando la lógica de `scripts/screenshots.mjs` (dos navegadores con cámara falsa → conectar → chatear → colgar).
- [ ] GitHub Actions: `lint` + `tsc` + `build` + e2e en cada PR.
- [ ] Regenerar capturas automáticamente (`npm run screenshots`).

## 4. Criterios de "terminado"
1. Dos personas en redes distintas se conectan **sólo compartiendo el enlace** de la sala.
2. Cámara/micro se pueden apagar y encender sin pantallas negras; el otro lado lo ve.
3. Cualquier error (permiso denegado, código inválido, red bloqueada) muestra un mensaje claro y una acción.
4. Colgar termina la llamada en ambos lados en <1 s.
5. CI en verde con e2e de la llamada completa.

## 5. Orden recomendado
~~Fase 1~~ → ~~Fase 2~~ → Fase 5 (lint + CI; el e2e ya existe) → Fase 3 → Fase 4. Decisión pendiente: dónde desplegar (servidor Node → listo; Vercel → hace falta Redis o similar).
