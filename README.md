# Live Studio Center · Node.js

Centro local de stream para Windows. Abre **Iniciar.cmd** y conserva la consola abierta. Panel: **http://127.0.0.1:17900**.

## Arranque

Requiere **Node.js 22.12 o posterior**. El lanzador detecta Node en Program Files o PATH. El frontend utiliza React, Vite, Tailwind CSS y componentes shadcn/ui sobre Radix. La primera ejecución de Iniciar.cmd instala las dependencias con npm ci y compila el panel; requiere Internet para esa instalación. El backend utiliza los módulos incluidos en Node.

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
    layout.js               Editor nativo de Layout Studio y persistencia
    ads.js                  Adaptador de AdQueue
    local-tool.js           Ciclo de vida común de herramientas externas
modules/tts/                Motores de voz Windows y Pocket TTS
modules/tiktok/             Conector propio de navegador y lector Webcast local
web/src/                    Frontend React y componentes reutilizables
dist/                       Frontend compilado servido por Node
data/tts.json               Configuración del usuario
tests/                      Pruebas Node
```

El dashboard recibe estados mediante Server-Sent Events (SSE), con reconexión automática. Varias pestañas comparten estado. Los cambios de estado no sobrescriben un formulario que estés editando.

El servidor HTTP, configuración, filtros, cola, instalación y administración de procesos del centro funcionan en Node. **Layout Studio está integrado en React y Node**, con edición y salida propias. AdQueue conserva su servidor e interfaz incrustada. TikTok usa Edge/Chrome local, sin Python, TikTokLive ni servicios de firma; PowerShell se conserva para las voces Windows y Pocket TTS.

## Migración y datos

- Se conserva `data/tts.json` sin reescribirlo al iniciar. Si falta, se importa `../tts/settings.json`; si tampoco existe, se generan ajustes de voz Windows.
- Los ajustes guardados con Piper se cargan con Pocket TTS y conservan la salida, el volumen y los filtros.
- El nuevo Layout guarda en `data/layout.json`. Los datos del editor anterior permanecen intactos; no se importan automáticamente.
- AdQueue conserva configuración y archivos en sus ubicaciones actuales.
- La salida del Layout principal es `http://127.0.0.1:17900/output/layout#tiktok.studio` (o el puerto configurado). Cada composición guardada tiene su propia ruta `/output/layout/<id>`. En **Mis composiciones**, pulsa **Copiar salida** en la tarjeta correspondiente y pega la URL en una fuente de enlace nueva para esa escena. Los enlaces anteriores de Layout siguen funcionando. La salida de anuncios es `http://127.0.0.1:17843/output#tiktok.studio`.
- AdQueue todavía requiere `../AdQueueWeb/dist` y sus requisitos originales de .NET. Layout ya no requiere carpetas hermanas.

Los archivos originales de las tres herramientas no se modifican. El servidor anterior `server.py` se ha sustituido por `server.js`.

## Texto a voz y TikTok

El panel de voz detecta las voces de Windows y las salidas de audio. **Preparar Pocket TTS** descarga y verifica el ejecutable oficial para Windows, carga el modelo en español y comprueba la voz guardada antes de activar el motor. Puedes elegir otra voz y probarla en **Voz y audio**. La primera vez que usas otra voz puede necesitar conexión para descargarla. [Versión oficial de Kyutai](https://github.com/kyutai-labs/pocket-tts/releases/tag/v4.0.1)

**Probar estos ajustes** usa el formulario sin guardarlo y omite filtros y esperas del chat. La prueba comparte la cola, por lo que debes reanudarla si está pausada. **Simular comentario** usa las reglas guardadas. Puedes ver y quitar mensajes pendientes, vaciar la cola sin interrumpir el mensaje actual, bloquear usuarios, permitir o bloquear enlaces, desactivar la lectura y configurar el límite de cola entre 1 y 200 mensajes.

La biblioteca permite exportar e importar ajustes JSON desde el navegador. Los archivos antiguos reciben valores compatibles al cargarse y se actualizan al guardar. El ejecutable se instala en `modules/tts/tools/pocket-tts` y el modelo y las voces se guardan en la caché local de Hugging Face.

El selector de audio utiliza los dispositivos expuestos por Windows mediante [SAPI AudioOutput](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms723596(v=vs.85)). Pocket TTS genera un WAV que se reproduce en el dispositivo elegido mediante [SpeakStream](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms723611(v=vs.85)).

Configura la voz, guarda y envía un comentario de prueba. Los filtros, comando, espera por usuario y cola de hasta 50 mensajes funcionan en Node. Los ajustes se aplican a los mensajes que se añadan después de guardar. Pausar retiene los mensajes siguientes; Saltar interrumpe el actual; Detener todo vacía la cola e interrumpe la voz.

Para conectar, guarda el usuario y pulsa **Conectar**. Se abre una ventana de Edge/Chrome con un perfil exclusivo en `data/tiktok-browser`. Puedes iniciar sesión allí o usar **Cargar sesión desde mi navegador** en el panel de TikTok: copia `sessionid` y `tt-target-idc` de las cookies de tiktok.com en tu navegador habitual y pulsa **Cargar sesión y conectar**. Los valores viajan al servidor local y por la tubería privada al perfil del navegador; no se guardan en ajustes, logs ni snapshots del dashboard. Los campos se vacían al terminar. Las cookies importadas se conservan en el perfil hasta 30 días, aunque TikTok puede invalidarlas antes. **Comprobar navegador** verifica la instalación sin descargar dependencias. Mantén la ventana abierta; **Desconectar** la cierra y conserva el perfil.

El conector propio observa las tramas Webcast recibidas por la página de TikTok y las decodifica localmente para comentarios, likes, seguidores, compartidos, regalos y Super Fans. El navegador realiza la conexión normal de TikTok; no se solicitan firmas a Euler ni se instala el antiguo cliente. La automatización usa tuberías privadas de Chrome DevTools, sin abrir un puerto de depuración. No hay una cuota de peticiones de un intermediario; siguen aplicando las restricciones, permisos, verificaciones y límites de TikTok. La lectura depende de los eventos que TikTok entregue al navegador y puede requerir mantenimiento si cambia su protocolo.

El panel muestra sesión iniciada, disponibilidad de envío y contador de eventos recibidos. Para responder, se escribe en el cuadro de chat de esa misma página y se confirma la respuesta HTTP de TikTok. Si hay un borrador se conserva y no se envía. Los envíos se serializan; un fallo interrumpe la lista y no se reintenta automáticamente para evitar duplicados. No se registran cookies, firmas ni cuerpos de respuestas. Si TikTok solicita una verificación, complétala manualmente en su ventana.

El dashboard, editor y voces locales no necesitan Internet; TikTok y las instalaciones sí. El audio se reproduce en la salida elegida en el dashboard (por defecto, la predeterminada de Windows) y debe capturarse en LIVE Studio.

## Spotify · Ahora escuchando

El módulo **Spotify** muestra carátula, título, artista y progreso de lo que escuchas en Spotify o AIMP. Incluye vista previa, estilos claro/oscuro y una salida transparente de **600 × 160 px** para una fuente de navegador en LIVE Studio u OBS: `http://127.0.0.1:17900/?spotify-output=1#tiktok.studio`. También admite episodios de podcast. El audio sigue en el reproductor.

**Modo local de Windows (predeterminado, sin Premium):** abre Spotify de escritorio o AIMP en este PC y reproduce una canción. Live Studio detecta automáticamente el reproductor que está sonando y da prioridad a Spotify si ambos están reproduciendo. AIMP funciona sin complementos. Usa **Activar lectura local** para reanudar y **Detener lectura local** para detenerla. Esta preferencia se conserva al reiniciar. La carátula y el progreso aparecen si el reproductor los proporciona. Requiere Windows 10 1809 o posterior. Para Spotify Web o reproducción en otro dispositivo, usa el modo de cuenta.

**API oficial (opcional):** selecciona Cuenta de Spotify para consultar la reproducción en otros dispositivos:

1. Abre [Spotify for Developers](https://developer.spotify.com/dashboard), crea una app con Web API y añade `http://127.0.0.1:17900/api/spotify/callback` en Redirect URIs. Si cambias el puerto, copia el enlace que muestra el panel.
2. Pega el **Client ID** en el módulo y pulsa **Conectar Spotify**. Autoriza tu cuenta y volverás al panel. No se necesita Client Secret.
3. Reproduce música en Spotify y pulsa **Copiar salida de Spotify** para añadirla al directo. Guarda los ajustes para aplicar el estilo o cambiar si se oculta al pausar.

Solo para el modo API, Spotify [exige Premium al propietario de una app en modo desarrollo](https://developer.spotify.com/documentation/web-api/concepts/quota-modes); las cuentas adicionales deben estar autorizadas en Usuarios y acceso. Esta opción usa [Authorization Code con PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) y el permiso `user-read-currently-playing`.

La sesión se renueva automáticamente y se guarda en `data/spotify.json`, excluido de Git. Este archivo contiene credenciales de sesión: no lo compartas. Los tokens no se envían al panel ni a las salidas. **Desconectar Spotify** borra la sesión local; puedes revocar el acceso también desde tu cuenta de Spotify.

El servidor consulta la canción cada cinco segundos, compartiendo una sola consulta entre las pestañas y salidas. Respeta los tiempos de espera de Spotify y oculta la canción ante errores, sesiones privadas o ausencia de reproducción. La salida también se oculta al perder conexión con Live Studio. Las pruebas usan respuestas simuladas; la autorización y reproducción reales requieren tu cuenta.

## Cierre

Cerrar la pestaña no detiene el centro. **Ctrl+C en la consola** cierra el backend y los procesos que inició. Las herramientas que ya estaban abiertas se reutilizan sin tomar posesión de ellas y permanecen abiertas. Mantén la consola abierta durante el directo.

## Desarrollo y verificación

```powershell
npm test
npm run check
```

Las pruebas usan datos aislados y procesos simulados para comprobar cola, interrupción, filtros, conector, reutilización de herramientas, persistencia, protección HTTP y eventos SSE. No envían atajos ni reproducen audio. La conexión a TikTok real, audibilidad y cambios físicos de escena requieren prueba en tu sesión.

APIs utilizadas: [HTTP de Node](https://nodejs.org/api/http.html) y [gestión de procesos](https://nodejs.org/api/child_process.html).

## Desarrollo del frontend

Instala las dependencias con `npm ci`. `npm start` compila el frontend y abre el centro. `Iniciar.cmd` también compila antes de arrancar, para evitar servir una versión anterior.

Para trabajar con recarga automática, inicia `node server.js --no-browser` y, en otra terminal, `npm run dev`. Abre la URL de Vite; las peticiones `/api` y los eventos SSE se redirigen al backend en el puerto 17900. Si cambias el puerto del backend, actualiza el proxy en `vite.config.js`.

Los componentes de interfaz viven en `web/src/components/ui`, los campos compartidos en `components/fields.jsx` y el acceso a la API/SSE en `hooks/use-studio.js`. `components.json` configura los alias para añadir componentes con la CLI de shadcn/ui. La integración sigue la [instalación para Vite](https://ui.shadcn.com/docs/installation/vite).

`npm test` compila y verifica el backend, la API y las interacciones del frontend React en JSDOM. `npm run check` comprueba la compilación y la sintaxis del servidor. El frontend no depende de CDN ni de fuentes externas al ejecutarse.

## Layout editable

Layout Studio incluye estilos Windows XP, oscuro, neón y minimalista, además de temas creados con CSS. Los diseños nuevos comienzan en vertical (1080 × 1920). Las composiciones **Gaming vertical**, **Charlando** y **Juego en grande** distribuyen las ventanas; pueden deshacerse y conservan tu biblioteca de temas. También puedes usar formato horizontal (1920 × 1080).

Añade textos, marcos, barras de tareas o filas de iconos. Arrastra para mover, usa la esquina para redimensionar o introduce X, Y, ancho y alto en píxeles en Propiedades. Los valores corresponden a la resolución del layout (1080 × 1920 o 1920 × 1080); al cambiar de formato se conserva la distribución proporcional y se actualizan los píxeles mostrados. Puedes ocultar, traer al frente y borrar elementos con su papelera, el botón Eliminar, la cruz de XP o Supr/Backspace cuando no estás escribiendo. Se admiten hasta 30 elementos.

### Autoguardado y salida

Los cambios se guardan en `data/layout.json` unos 700 ms después de dejar de editar y actualizan las salidas abiertas mediante SSE. Se espera a que terminen las imágenes y se envía una sola escritura a la vez. Las ediciones hechas durante una escritura se guardan después, sin ser reemplazadas por respuestas atrasadas. Si falla el guardado, se conservan los cambios en el editor y se reintenta a los 5 segundos; también puedes pulsar **Reintentar guardado**. **Guardar layout** sigue disponible para enviar cambios inmediatamente. Espera al estado **Autoguardado · salida sincronizada** antes de cerrar.

**Copiar salida** proporciona el enlace completo para TikTok LIVE Studio, con el sufijo `#tiktok.studio`. Configura la fuente de navegador en **1080 × 1920** para vertical o **1920 × 1080** para horizontal. Todos los estilos se escalan uniformemente; una fuente de otra proporción conserva el diseño completo centrado, con espacio sobrante. Los marcos y textos son overlays: coloca las fuentes reales de cámara y juego debajo. Las guías de interfaz y etiquetas de cámara/juego solo aparecen en el editor y son orientativas.

El tema XP reutiliza las reglas originales de XP Studio y el recurso gráfico de la barra Luna: títulos de 29 px, controles de 21 px y bordes de 3 px. El recorte del fondo conserva las esquinas del marco y deja transparentes los interiores. La barra de tareas refleja las ventanas visibles. Su título edita Inicio (`start` usa la imagen original) y su texto edita el reloj.

### Fondo del layout

Elige **Transparente**, **Color** o **Imagen**. Elegir un color lo activa automáticamente. Las imágenes PNG/JPG/WebP de hasta 10 MB se optimizan localmente hasta 2048 px y se guardan dentro del layout. Puedes rellenar, mostrar la imagen completa o estirar. El fondo respeta los huecos de las ventanas, para que sigan viéndose las fuentes situadas debajo.

### Filas de iconos

**+ Fila de iconos** crea seis accesos. Selecciona cada icono en el lienzo o en Propiedades para subir su imagen, editar el nombre, elegir el tamaño (16–256 px), colocar el texto encima o debajo y usar estilo Windows, oscuro, neón, minimalista o el del layout. Las imágenes se optimizan a 256 px y se guardan con el diseño.

Cada fila admite entre 1 y 12 iconos. Puedes añadir, eliminar, reordenar, alinear y cambiar la separación, además de mover y redimensionar la fila. El editor avisa si el contenido no cabe. Las filas no aparecen como ventanas en la barra de tareas ni recortan el fondo. El conjunto de imágenes optimizadas admite hasta 6 MB de datos incrustados.

### Temas CSS personalizados

Pulsa **+ Crear tema CSS** para obtener una plantilla editable y una vista previa de la salida al lado. Cambia su nombre y edita el CSS. El código válido se aplica tras una pausa de 300 ms y entra en el autoguardado. Si hay errores, se muestra la línea y la columna; se conserva la última versión válida en la salida. El texto con errores no se guarda ni se aplica.

La biblioteca permite seleccionar, duplicar y eliminar temas, y restablecer la plantilla base. **Importar CSS** crea un tema nuevo desde un archivo `.css`, con el nombre del archivo, sin reemplazar los temas existentes. Se valida antes de aplicarlo y entra en el autoguardado. **Exportar CSS** descarga el código actual válido y **Descargar plantilla** obtiene la base para editarla en otro programa. Los archivos con errores se rechazan sin cambiar el diseño. Admite hasta 20 temas de 20 000 caracteres CSS cada uno, guardados junto al layout. Cambiar de composición mantiene la biblioteca y el tema seleccionado.

El CSS se ejecuta dentro de un Shadow DOM, separado del panel. La plantilla documenta los selectores: `:host`, `.layout-element`, `.layout-title`, `.layout-content`, `.frame`, `.taskbar`, `.layout-icon-row`, `.row-icon-picture` y `.row-icon-name`. Puedes usar variables, gradientes, bordes, sombras, `@media`, `@supports`, `@container` y `@keyframes`. No se admiten imports ni otras reglas globales. El recorte del fondo se adapta a las dimensiones del contenido del tema. La geometría de los elementos se sigue editando desde el lienzo.

Reinicia el centro después de instalar esta actualización y recarga el editor y las fuentes de navegador para cargar el nuevo código.

### Verificación del layout

`npm test` comprueba guardado, reintentos, protección frente a respuestas atrasadas, biblioteca CSS, validación, imágenes y edición de iconos. `node tests/verify-layout-geometry.mjs` prepara `.tmp/layout-geometry.html`: ábrelo en Edge para comparar posiciones, dimensiones, tipografía y etiquetas en los cuatro estilos incluidos y un tema CSS, en ambos formatos. También comprueba los píxeles de las esquinas XP, la transparencia interior y el aislamiento del CSS. El informe debe mostrar diez comparaciones de geometría y dos pruebas de esquinas con resultado PASS.
En Lienzo puedes editar ancho y alto en píxeles (entre 240 y 7680 por lado). La resolución personalizada se guarda automáticamente y se aplica al editor y a la salida, conservando la distribución proporcional de los elementos. Configura la fuente de navegador con las mismas dimensiones.

El editor ajusta el movimiento y el tamaño a una cuadrícula de 8 px por defecto. Puedes desactivarla o cambiar el paso entre 1 y 128 px encima del lienzo. Mantén Alt para mover libremente y Shift para bloquear el movimiento a un eje. Con el lienzo enfocado, las flechas mueven el elemento seleccionado 1 px; Shift + flechas lo mueve 10 px. La cuadrícula no aparece en la salida.

Las guías de interfaz reservan el mismo margen lateral a izquierda y derecha. En Windows XP puedes arrastrar los tres controles de ventana juntos dentro de su ventana. Su posición se guarda y se adapta al redimensionar, manteniendo el grupo visible; «Restablecer controles XP» lo devuelve arriba a la derecha. Un clic en la X elimina la ventana; arrastrarla mueve el grupo sin eliminarla.


### Top usuarios por likes

El m?dulo `/likes` recibe `LikeEvent` del conector TikTok. Suma el `count` de cada evento por ID estable del usuario, no el total global del LIVE. Los mensajes con un mismo ID se cuentan una sola vez (ventana de los ?ltimos 2000 IDs). Solo incluye likes que el conector recibe mientras est? conectado; no reconstruye el historial anterior.

Puedes elegir de 1 a 20 puestos, t?tulo, tama?o, colores, opacidad de fondo y borde, posici?n y total visible. El dise?o se guarda autom?ticamente; los cambios pendientes se recuperan desde el navegador. La vista de ejemplo es local al editor y no a?ade likes a la clasificaci?n real.

La salida `/?likes-output=1#tiktok.studio` tiene fondo transparente y se a?ade como fuente de enlace. `data/likes.json` conserva dise?o y conteo, con escritura at?mica, copia `.bak` y guardado del conteo agrupado cada segundo. Reconectar el mismo canal conserva el ranking. ?Reiniciar conteo? pide confirmaci?n y conserva el dise?o; los primeros likes de un canal distinto inician un conteo nuevo. Ocultar la clasificaci?n no detiene el conteo. Reinicia Live Studio y reconecta TikTok tras instalar el m?dulo para cargar el nuevo evento del conector.

El scoreboard de likes conserva tambi?n la URL de la foto de perfil y muestra la foto junto al nombre en el editor y la salida. Si no hay foto o falla su carga, muestra la inicial. Las fotos se actualizan al recibir nuevos likes y requieren acceso a la URL de TikTok; el conteo y los nombres permanecen locales. El panel indica la hora del ?ltimo like y del ?ltimo guardado. ?Descargar scoreboard? exporta todos los participantes a JSON, aunque la salida est? limitada a menos puestos.
# Comandos de chat

`!comandos` muestra los comandos activos y sus descripciones cortas en una salida independiente: `/commands?commands-list-output=1#tiktok.studio`. La lista cambia de página cada ocho segundos cuando hay más de seis comandos. Es un comando reservado y respeta el interruptor general del módulo. **Probar !comandos** abre esta salida y muestra la lista sin necesitar conexión a TikTok. No publica mensajes en el chat ni interrumpe las imágenes o los audios.

El dashboard permite alternar las tarjetas entre **Lista** y **Cuadrícula**. La elección se conserva en ese navegador y no modifica la salida del directo.

En **Comandos de chat** puedes añadir, editar, activar y eliminar hasta 100 comandos. Asigna una imagen/GIF, un texto, un audio o una combinación, y pulsa **Guardar comandos**. Se admiten archivos locales (imágenes hasta 20 MB; MP3/WAV/OGG hasta 5 MB) y enlaces HTTP/HTTPS directos. Los ejemplos `!Aatrox` y `!Sion` vienen desactivados para que les asignes tus propios recursos.

Conecta TikTok desde el panel y añade dos fuentes de navegador: **Copiar lista** para `!comandos` y **Copiar notificaciones** para los GIF, textos y sonidos (`/commands?commands-output=1#tiktok.studio`). Habilita el audio solo en la fuente de notificaciones. **Probar en salida** permite comprobar los recursos sin conectar TikTok. Evita abrir varias fuentes de notificaciones con audio a la vez.

La salida visual está centrada y dura los segundos configurados. Cada comando visual reemplaza al anterior; cada audio interrumpe al anterior y se reproduce hasta terminar (máximo 120 segundos). Ambos canales son independientes: un comando solo de sonido conserva la imagen vigente. No hay cola. **Detener salida** limpia ambos canales; guardar también detiene la salida actual.

Los mensajes deben coincidir con el comando completo, sin distinguir mayúsculas y permitiendo espacios al principio/final. Los comandos reconocidos no se leen por TTS y funcionan aunque la voz esté desactivada. La configuración se guarda en `data/commands.json`; los recursos subidos usan el almacén local de medios compartido con notificaciones.
# Estado actual de la conexión TikTok

Se restauró el conector Python/TikTokLive con firma de Euler para leer el LIVE por nombre de usuario. La conexión activa ya no usa el navegador local ni la importación de cookies descritos más abajo (implementación experimental retirada del flujo activo). Los comandos visuales y de audio se conservan. El envío de `!comandos` al chat no está disponible con este conector de lectura.
