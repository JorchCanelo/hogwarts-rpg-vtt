# Hogwarts RPG VTT

Mesa virtual (VTT) para jugar Hogwarts RPG: hojas de personaje, tiradas, escenas con fichas, materiales, música sincronizada y hasta 10 jugadores conectados a la vez (también desde el celular).

## Requisitos
- Node 22.5 o superior (recomendado 24) y npm. La base de datos usa `node:sqlite` (incluido en Node; no hay módulos nativos que compilar).
- Windows 10/11 o Linux. Para jugar por internet, opcionalmente [`cloudflared`](https://github.com/cloudflare/cloudflared) en el PATH.

## Primer arranque
```bash
npm install
npm run typecheck
npm test
npm run dev
```
Abre **http://127.0.0.1:3001** (panel del anfitrión: crea partidas, entra como Narrador sin contraseña, comparte enlaces). El cliente de desarrollo corre en http://localhost:5173.

La primera vez, Windows pedirá permiso de Firewall para Node: acéptalo en redes privadas si quieres que los jugadores entren por LAN.

## Jugar con otras personas
`npm run dev` es solo para desarrollar: el cliente en caliente vive en el puerto 5173, que únicamente ve tu PC. El puerto 3000 no sirve interfaz en ese modo. Para que entren jugadores (LAN o túnel) ejecuta `npm run play`, abre http://127.0.0.1:3001 como anfitrión y comparte el puerto 3000. Cada vez que cambie el código, vuelve a ejecutarlo para recompilar.

## Scripts
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor (tsx watch) + cliente (Vite) |
| `npm run play` | Compila y arranca el servidor completo: **úsalo cuando jueguen otras personas** (todos entran por el puerto 3000 o el túnel) |
| `npm test` | Pruebas de `shared` y `server` (node:test) |
| `npm run typecheck` | `tsc --noEmit` en shared, server y client |
| `npm run build` | Compila cliente (Vite) y servidor (esbuild) |
| `npm run desktop` | Compila, instala `desktop/` por separado y abre la app Electron (Electron 39+ para tener `node:sqlite`) |
| `npm run dist` | Instalador de Windows (NSIS) en `release/` |

## Arquitectura
- `shared/`: reglas del juego, permisos, esquemas zod y tipos compartidos. Contenido propio del sistema aislado en `shared/src/rules`.
- `server/`: Fastify + Socket.IO + SQLite (node:sqlite). Dos puertos: público `3000` (jugadores) y local `3001` (solo 127.0.0.1, anfitrión).
- `client/`: React + Vite + Tailwind v4 + zustand + Konva.
- `desktop/`: envoltorio Electron.
- El snapshot (`GET /api/state`) es la fuente de verdad; los eventos `state:changed` provocan un refetch.

## Seguridad
- Contraseñas con scrypt; sesión en cookie firmada (HMAC).
- El Narrador anfitrión entra sin contraseña solo mediante un token de un solo uso emitido por el puerto local.
- Las tiradas se resuelven en el servidor.
- Los datos (`data/`) están en `.gitignore`.

## Estado de verificación (honesto)
- **Verificado:** `shared` (22 pruebas) y la capa de servicios/autenticación/subidas del servidor (32 pruebas, sobre node:sqlite, el mismo motor que usa el servidor).
- **Sin compilar ni ejecutar:** capa HTTP/Socket.IO, todo el cliente, Electron y el túnel de cloudflared. Pueden tener errores de tipos o de ejecución: corre `npm run typecheck` y repórtalos.
- Suposición: los PJ nuevos empiezan con suerte 3.

## Versiones mínimas por seguridad
Fijadas tras `npm audit` (los `^` en los `package.json` ya impiden bajar de estas):
| Paquete | Versión | Motivo |
|---|---|---|
| `zod` | 4.6.7 | Agotamiento de memoria al validar colecciones grandes (GHSA-mrhx-c7xc-m3w5) |
| `esbuild` | 0.28.2 | El servidor de desarrollo aceptaba peticiones de cualquier sitio web (GHSA-67mh-4wv8-2f99) |
| `@fastify/static` | 10.1.8 | Cuatro fallos de recorrido de rutas y evasión de protecciones |

Zod 4 aplica los `.default()` también dentro de `.optional()`, por eso los esquemas de edición parcial (PATCH) se construyen con `patchOf()` en `shared/src/schemas.ts`.
Ejecuta `npm audit` de vez en cuando; evita `npm audit fix --force`, que puede añadir dependencias al paquete equivocado.

## Licencia
El código se publica bajo CC0 (ver `LICENSE`). El contenido de reglas de Hogwarts RPG pertenece a sus autores.
