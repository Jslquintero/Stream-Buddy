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
modules/tts/                Motores de voz y puente TikTok existentes
web/src/                    Frontend React y componentes reutilizables
dist/                       Frontend compilado servido por Node
data/tts.json               Configuración del usuario
tests/                      Pruebas Node
```

El dashboard recibe estados mediante Server-Sent Events (SSE), con reconexión automática. Varias pestañas comparten estado. Los cambios de estado no sobrescriben un formulario que estés editando.

El servidor HTTP, configuración, filtros, cola, instalación y administración de procesos del centro ya funcionan en Node. **Layout Studio está integrado en React y Node**, con edición y salida propias. AdQueue conserva su servidor e interfaz incrustada. Python queda como dependencia opcional del conector TikTok; PowerShell se conserva para las voces Windows/Piper.

## Migración y datos

- Se conserva `data/tts.json` sin reescribirlo al iniciar. Si falta, se importa `../tts/settings.json`; si tampoco existe, se generan ajustes de voz Windows.
- Las voces y ejecutable Piper conservan sus rutas actuales. No se copian ni descargan modelos.
- El nuevo Layout guarda en `data/layout.json`. Los datos del editor anterior permanecen intactos; no se importan automáticamente.
- AdQueue conserva configuración y archivos en sus ubicaciones actuales.
- La nueva salida de Layout es `http://127.0.0.1:17900/?layout-output=1#tiktok.studio` (o el puerto configurado). Sustituye la URL anterior en tu fuente de navegador. La salida de anuncios sigue en `http://127.0.0.1:17843/output#tiktok.studio`.
- AdQueue todavía requiere `../AdQueueWeb/dist` y sus requisitos originales de .NET. Layout ya no requiere carpetas hermanas.

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
