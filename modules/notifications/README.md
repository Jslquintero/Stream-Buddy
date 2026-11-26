# Notificaciones

Módulo integrado de alertas para seguidores, regalos y compartidos.

- `index.js`: persistencia, validación y cola de reproducción compartida entre las salidas.
- `config.js`: valores iniciales, plantillas y opciones visuales.
- La configuración del usuario se guarda en `data/notifications.json`.
- El editor guarda automáticamente tras una pausa de escritura, serializa las solicitudes y reintenta los fallos. Cada cambio pendiente tiene una copia inmediata en el navegador para recuperarse al recargar antes de completar el guardado. El servidor devuelve una revisión para que una actualización antigua no reemplace los cambios nuevos. `notifications.json.bak` conserva una copia válida y los formatos anteriores se migran al cargar.
- El borde tiene opacidad independiente (0 % es transparente). Las animaciones incluyen entradas desde cuatro direcciones, desvanecimiento, zoom, rebote, giro, rodar e impulso, con duración configurable; se respeta la preferencia de movimiento reducido.
- Se pueden usar fuentes del sistema e instalar familias por nombre desde [Google Fonts](https://developers.google.com/fonts/docs/css2). Los archivos y su CSS se almacenan en `data/notification-fonts/`, con un registro en `data/notification-fonts.json`. La instalación requiere Internet; la reproducción posterior usa únicamente archivos locales. No se instalan fuentes en Windows. Los grosores que no incluya la descarga pueden ser sintetizados por el navegador.
- Las imágenes PNG, JPG, WebP y GIF (hasta 20 MB cada una) se guardan en `data/notification-assets/`. Se detecta el formato por la firma del archivo, incluso si el navegador no indica un MIME. Los GIF conservan sus bytes y su animación. Elegir una imagen desactiva el video anterior para que no la oculte. Los eventos y la configuración solo transportan la URL local del archivo.
- Cada evento admite audio MP3, WAV u OGG (5 MB), y volumen por alerta. El editor muestra la forma de onda y permite elegir un fragmento con dos tiradores, hasta la duración de la alerta. El corte es de reproducción: se guarda el archivo original junto con los tiempos, sin recodificar ni exportar otro archivo. El audio se reproduce una vez en la salida y se detiene al finalizar el fragmento, saltar o limpiar la alerta. Si el navegador bloquea el sonido automático, la salida ofrece un botón para habilitarlo.
- Los videos MP4 y WebM admiten archivos de hasta 30 MB. El editor permite seleccionar y previsualizar un tramo de hasta la duración de la alerta (máximo 30 segundos). El corte es de reproducción: se guarda el archivo original junto con los tiempos de inicio y fin, sin recodificar ni exportar otro archivo. La salida permite búsquedas por rangos HTTP y solo reproduce el fragmento seleccionado.
- Al elegir un video, este sustituye a la imagen. Su sonido se puede habilitar; un audio personalizado sustituye al sonido del video para evitar dos pistas simultáneas.
- Las alertas usan archivos importados al estudio. Al cargar una configuración anterior se descartan las referencias externas y se conservan los archivos locales.
- Cada evento tiene su propia imagen y puede heredar el diseño general o guardar un diseño independiente. Se puede ajustar distribución, tipografía, ancho, espaciado, transparencia, bordes, sombra, duración y animación.
- Editor: `/notifications`. Salida transparente: `/?notifications-output=1#tiktok.studio`.

Los eventos automáticos utilizan la conexión de TikTok del navbar. Los regalos en racha se notifican al terminar la racha. Las pruebas no necesitan conexión. La cola es temporal, admite 30 pendientes y no se recupera al reiniciar. El editor permite previsualizar cambios sin guardarlos y enviar una prueba explícita a la salida.

El conector propio en `modules/tiktok` observa los eventos Webcast del navegador local. Los regalos en racha se emiten al recibir su cierre (`repeatEnd`), evitando alertas intermedias. No utiliza TikTokLive ni servicios de firma externos.

Validación: `npm test` cubre servidor, persistencia, cola, editor y salida. `py -3 tests/notifications_bridge_test.py` prueba los eventos del conector con un cliente simulado, sin iniciar sesión ni conectarse a un LIVE.
