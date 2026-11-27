# Compilar y publicar Stream Buddy para Windows

En Windows x64, instala Node.js 22.12 o posterior, Python 3.13 y los requisitos de Tauri con Rust y MSVC. La compilación descarga las dependencias, WebView2 y el modelo de voz. Usa `STUDIO_BUILD_PYTHON` si necesitas indicar la ruta de Python. [Requisitos de Tauri](https://v2.tauri.app/start/prerequisites/)

## Compilación local

Abre una terminal en la carpeta de Stream Buddy y ejecuta:

```powershell
npm ci
npm test
npm run desktop:build
```

El instalador de prueba queda en `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`. Para abrir el panel desde el código fuente, usa `Iniciar.cmd` o ejecuta `npm start`.

## Firma y publicación

Genera las claves desde la carpeta del proyecto. En CMD, por ejemplo:

```cmd
npm exec -- tauri signer generate -w "%USERPROFILE%\stream-buddy-updater.key"
```

| Dónde configurarlo en GitHub Actions | Qué guardar |
| --- | --- |
| Variable `TAURI_UPDATER_PUBKEY` | Contenido de `stream-buddy-updater.key.pub` |
| Secreto `TAURI_SIGNING_PRIVATE_KEY` | Contenido de `stream-buddy-updater.key` |
| Secreto `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña elegida al generar la clave |

Guarda una copia segura de la clave privada y la contraseña. Usa el mismo par de claves para las próximas versiones. [Firma del actualizador de Tauri](https://v2.tauri.app/es/plugin/updater/)

Si el código está en un repositorio privado, configura `RELEASE_REPOSITORY` con el nombre `owner/repositorio` del repositorio público de distribución. Guarda un token con permiso de escritura sobre sus publicaciones en el secreto `RELEASE_REPOSITORY_TOKEN`. Si el repositorio de código es público, el flujo puede publicar allí con el token de Actions.

Actualiza la versión con `npm version <versión> --no-git-tag-version` y sube un tag `v<versión>` que apunte al commit correspondiente. GitHub Actions ejecuta las pruebas y publica `StreamBuddy-Setup.exe`, `StreamBuddy-Setup.exe.sig` y `latest.json`.

## Comprobaciones antes de distribuir

1. En un Windows limpio y sin conexión, instala la aplicación, abre el panel y prueba la voz Lola.
2. Con conexión, comprueba que se reciben eventos de un LIVE y abre un overlay existente en OBS o TikTok LIVE Studio.
3. Actualiza entre dos versiones de prueba. Comprueba que se conservan los perfiles y las composiciones, y que los overlays vuelven a responder.
4. Prueba que **Más tarde** mantiene el servicio activo y que una firma inválida impide instalar el paquete.
