# Stratega · Curso 2027 y concurso por tarjeta de regalo

La web conserva la presentación, el video integrado y los materiales. Al final incluye un concurso para que cada asistente responda desde su celular. La clasificación es compartida y se guarda en una base de datos; no es una tabla simulada del navegador.

## 1. Subir esta versión a Vercel

Descomprime el ZIP y sube TODO su contenido a la raíz del repositorio. Esta actualización incorpora `api/`, `lib/`, `package.json` y nuevos archivos en `public/`; no basta con sustituir el HTML.

- Framework Preset: **Other**.
- Root Directory: raíz del repositorio, no `public`.
- Output Directory: `public`.
- Build Command e Install Command: vacíos.
- `vercel.json` ya contiene esos ajustes.

El HTML incluye el video optimizado y sigue por debajo de 25 MiB. No hace falta subir el MP4 por separado. Los documentos y el logotipo están en `public/assets/`.

## 2. Conectar la clasificación compartida

1. En el Marketplace de Vercel, agrega **Upstash Redis** al proyecto, o conecta una base existente de Upstash.
2. En Upstash, localiza las credenciales **REST** de la base, no solamente la URL TCP `redis://`.
3. En las variables de entorno del proyecto de Vercel, configura estas tres entradas para el entorno donde darás el curso:

| Variable | Valor |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | URL HTTPS REST de la base de Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST con permisos de lectura y escritura |
| `CONTEST_ADMIN_TOKEN` | Clave privada y aleatoria de al menos 24 caracteres, creada por ti |

Si la integración ya creó `KV_REST_API_URL` y `KV_REST_API_TOKEN`, también se admiten; no es necesario duplicarlas. `REDIS_URL` por sí sola no es suficiente para esta implementación.

4. Vuelve a desplegar el proyecto para aplicar las variables. Revisa las condiciones y los límites del servicio que elijas antes de activarlo.
5. Abre `https://TU-DOMINIO/concurso-admin.html` e introduce tu `CONTEST_ADMIN_TOKEN`.

Las claves se guardan como variables de entorno de Vercel. No las pegues en HTML, archivos públicos ni en el repositorio. Mantén el repositorio privado para no publicar el banco de respuestas que utiliza el servidor.

Sin esta conexión, el curso y el video funcionan, pero el concurso mostrará que el organizador está preparando la sesión. No hay resultados ni ganadores ficticios.

## 3. Preparar y conducir el concurso

1. En el panel, escribe el premio concreto que vas a entregar, por ejemplo la descripción de tu tarjeta de regalo. No se fija importe ni tienda automáticamente.
2. Pulsa **Crear concurso**.
3. Genera los códigos necesarios y descarga el CSV. Se pueden generar varios lotes. Solo verás los códigos completos al generarlos.
4. Asigna y entrega **un código distinto por persona**. Conserva la relación entre códigos y asistentes en tu CSV.
5. Comparte el enlace de la página con `/#concurso` al final.
6. Cuando todos estén listos, pulsa **Abrir concurso**.
7. Cada participante escribe su nombre, acepta las reglas y comienza desde su celular. Recibe diez preguntas con orden y opciones mezclados, y dispone de diez minutos.
8. Actualiza el panel para ver resultados. Espera a que todos envíen o agoten su tiempo antes de cerrar.
9. Pulsa **Cerrar y mostrar ganador**. El cierre detiene los intentos que sigan en curso.
10. Descarga resultados, verifica la participación de quien ganó y entrega la tarjeta. Esta página no compra ni envía tarjetas automáticamente.

La clasificación ordena primero por aciertos y después por el menor tiempo medido por el servidor. Si ambos valores coinciden exactamente, muestra el empate para resolverlo con una pregunta adicional en vivo. Los resultados públicos muestran los primeros diez lugares; el panel incluye todos.

## Funcionamiento y alcance

- El navegador no recibe la clave de respuestas. La función del servidor calcula la calificación.
- Los códigos se consumen de forma atómica: un código no produce dos intentos desde dispositivos distintos.
- Los reintentos de envío son idempotentes: no duplican ni mejoran un resultado ya registrado.
- Un intento iniciado se puede retomar desde el mismo celular y navegador. Las respuestas seleccionadas se conservan localmente; el reloj no se reinicia.
- Es necesario tener conexión al empezar y al enviar. Hay una tolerancia técnica de diez segundos para recibir el envío automático al agotarse el contador. Una desconexión prolongada puede dejar el intento fuera de clasificación.
- El tiempo incluye la comunicación con el servidor, por lo que puede verse afectado por la conexión del participante.
- El nombre, los aciertos y el tiempo se muestran en la clasificación con aceptación previa del participante. Los registros de cada edición expiran treinta días después de su última actualización en la base.
- Crear una nueva edición requiere cerrar la anterior; cambia el código de edición y deja sin efecto sus códigos. Descarga los resultados antes de cambiar de edición.
- Distribuir varios códigos a una persona permitiría varios intentos; el organizador debe asignar uno por asistente y verificar al ganador.

## Archivos y comprobaciones

- `public/index.html`: curso, video integrado y sección del concurso.
- `public/assets/concurso.js` y `concurso.css`: interfaz de participantes.
- `public/concurso-admin.html`: panel del organizador.
- `api/concurso.mjs`: endpoint del servidor.
- `lib/questions.mjs`: banco de diez preguntas y respuestas, fuera del directorio público.
- `lib/contest.mjs`: orden aleatorio, calificación y desempate.
- `.env.example`: nombres de variables, sin credenciales.
- `tests/contest.test.mjs`: pruebas básicas que se ejecutan con `npm test` usando Node.js.

Antes del evento, realiza una edición de prueba con dos celulares y verifica el cierre. Después crea una nueva edición para los participantes reales. La conexión con tu proyecto de Vercel y tu base debe activarse en tu cuenta.

Referencias oficiales consultadas:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/redis
- https://upstash.com/docs/redis/features/restapi
- https://upstash.com/docs/redis/howto/vercelintegration
- https://docs.github.com/es/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
