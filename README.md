# Live Studio Center · Node.js

Centro local de stream para Windows. Abre **Iniciar.cmd** y conserva la consola abierta. Panel: **http://127.0.0.1:17900**.

## Arranque

Requiere **Node.js 22 o posterior**. El lanzador detecta Node en Program Files o PATH. No requiere npm install: el backend utiliza los módulos incluidos en Node.

```powershell
npm start
# Sin abrir navegador:
node server.js --no-browser
```

Si Node todavía no está en PATH, vuelve a abrir la terminal o usa `Iniciar.cmd`. Cierra el antiguo servidor Python si ocupa el puerto 17900. `STUDIO_PORT` permite elegir otro puerto para el panel sin cambiar los enlaces de los módulos.

## Arquitectura

```text
server.js                   Arranque y cierre del centro
backend/
  center.js                 Registro de módulos, comandos y actividad
  http.js                   API local, protección de peticiones y eventos SSE
  processes.js              Procesos secundarios y cierre de sus árboles
  settings.js               Importación, validación y guardado atómico
  modules/
    tts.js                  Cola, filtros, voz, conector e instalación
    layout.js               Adaptador de Layout Studio
    ads.js                  Adaptador de AdQueue
    local-tool.js           Ciclo de vida común de herramientas externas
modules/tts/                Motores de voz y puente TikTok existentes
web/                        Dashboard
data/tts.json               Configuración del usuario
tests/                      Pruebas Node
```

El dashboard recibe estados mediante Server-Sent Events (SSE), con reconexión automática. Varias pestañas comparten estado. Los cambios de estado no sobrescriben un formulario que estés editando.

El servidor HTTP, configuración, filtros, cola, instalación y administración de procesos del centro ya funcionan en Node. **Layout y AdQueue todavía utilizan sus servidores originales y sus interfaces incrustadas**, encapsulados en módulos independientes. No se han reescrito sus editores, reproducción de videos o atajos. Python queda únicamente como dependencia opcional del conector TikTok; PowerShell se conserva como adaptador de las voces Windows/Piper y para el servidor original de Layout.

## Migración y datos

- Se conserva `data/tts.json` sin reescribirlo al iniciar. Si falta, se importa `../tts/settings.json`; si tampoco existe, se generan ajustes de voz Windows.
- Las voces y ejecutable Piper conservan sus rutas actuales. No se copian ni descargan modelos.
- Layout conserva sus datos en `../layout/xp-studio/.data` y en su navegador. Usa el mismo navegador/perfil para acceder al contenido existente.
- AdQueue conserva configuración y archivos en sus ubicaciones actuales.
- Los enlaces de los overlays siguen en el puerto 8787; la salida de anuncios sigue en `http://127.0.0.1:17843/output#tiktok.studio`.
- Se esperan las carpetas hermanas `../layout/xp-studio` y `../AdQueueWeb/dist`. Esta versión todavía depende de ellas y de los requisitos originales de .NET de AdQueue.

Los archivos originales de las tres herramientas no se modifican. El servidor anterior `server.py` se ha sustituido por `server.js`.

## Texto a voz y TikTok

El módulo TTS tiene cuatro secciones en el dashboard: **Voz y audio**, **Lectura y filtros**, **TikTok LIVE** y **Biblioteca**. Detecta voces Windows y salidas de audio; permite elegir modelos y hablantes Piper, instalar el motor, importar modelos con un selector de archivos y descargar voces desde el catálogo oficial. Las descargas comprueban tamaño y hash y conservan la ficha de licencia. Todo se inicia desde el panel; instalar voces nuevas del sistema abre la configuración de Windows.

**Probar estos ajustes** usa el formulario sin guardarlo y omite filtros y esperas del chat. La prueba comparte la cola, por lo que debes reanudarla si está pausada. **Simular comentario** usa las reglas guardadas. Puedes ver y quitar mensajes pendientes, vaciar la cola sin interrumpir el mensaje actual, bloquear usuarios, permitir o bloquear enlaces, desactivar la lectura y configurar el límite de cola entre 1 y 200 mensajes.

La biblioteca permite exportar e importar ajustes JSON desde el navegador. Los archivos antiguos reciben valores predeterminados compatibles para las nuevas opciones, sin reescribirse hasta guardar. Los modelos nuevos se guardan en `modules/tts/voices` y Piper en `modules/tts/tools`; los recursos existentes continúan disponibles.

El selector de audio utiliza los dispositivos expuestos por Windows mediante [SAPI AudioOutput](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms723596(v=vs.85)); la reproducción de WAV Piper utiliza [SpeakStream](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms723611(v=vs.85)). El catálogo procede de [Piper Voices](https://huggingface.co/rhasspy/piper-voices) y el instalador usa el paquete CLI Windows `2023.11.14-2` compatible con el motor existente.

Algunas voces como davefx y sharvard incluyen grupos vocálicos de varios caracteres que el [CLI C++ de Piper](https://github.com/rhasspy/piper/blob/master/src/cpp/piper.cpp) rechaza al cargar. El centro genera una configuración de compatibilidad en `data/piper-config-*.json`, conservando las entradas individuales y sus IDs para la pronunciación por caracteres del motor Windows. No modifica el ONNX ni su JSON original. Los grupos no declarados o sin componentes individuales se rechazan con un error explícito. La prueba manual `tests/verify-piper.ps1` permite comparar generación WAV con ambas configuraciones sin reproducir audio.

Configura la voz, guarda y envía un comentario de prueba. Los filtros, comando, espera por usuario y cola de hasta 50 mensajes funcionan en Node. Los ajustes se aplican a los mensajes que se añadan después de guardar. Pausar retiene los mensajes siguientes; Saltar interrumpe el actual; Detener todo vacía la cola e interrumpe la voz.

Para conectar un LIVE público, guarda el usuario y pulsa Conectar. Se reutiliza el Python existente de `../tts/.venv` si está disponible. **Instalar conector** prepara `modules/tts/.venv` e instala TikTokLive. Requiere Internet y Python compatible, disponible a través del entorno existente o `py -3`. Los errores aparecen en Actividad. El conector no pide contraseñas y no reconecta automáticamente tras terminar la sesión.

El dashboard, editor y voces locales no necesitan Internet; TikTok y las instalaciones sí. El audio se reproduce en la salida elegida en el dashboard (por defecto, la predeterminada de Windows) y debe capturarse en LIVE Studio.

## Cierre

Cerrar la pestaña no detiene el centro. **Ctrl+C en la consola** cierra el backend y los procesos que inició. Las herramientas que ya estaban abiertas se reutilizan sin tomar posesión de ellas y permanecen abiertas. Mantén la consola abierta durante el directo.

## Desarrollo y verificación

```powershell
npm test
npm run check
```

Las pruebas usan datos aislados y procesos simulados para comprobar cola, interrupción, filtros, conector, reutilización de herramientas, persistencia, protección HTTP y eventos SSE. No envían atajos ni reproducen audio. La conexión a TikTok real, audibilidad y cambios físicos de escena requieren prueba en tu sesión.

APIs utilizadas: [HTTP de Node](https://nodejs.org/api/http.html) y [gestión de procesos](https://nodejs.org/api/child_process.html).
