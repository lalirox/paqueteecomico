# Stratega · Curso 2027 para Vercel

Paquete listo para desplegar como sitio estático. Conserva las 16 láminas, los ejercicios y las descargas; las notas del expositor de la web ya están eliminadas.

## Despliegue

1. Descomprime el ZIP en una carpeta.
2. Sube su contenido a un repositorio de GitHub: `vercel.json` y `public` deben quedar en la raíz del repositorio.
3. Importa ese repositorio como un proyecto en Vercel.
4. Usa la raíz del repositorio como Root Directory. No selecciones `public` como raíz.
5. Verifica estos ajustes y despliega:

| Ajuste | Valor |
| --- | --- |
| Framework Preset | Other |
| Build Command | Vacío |
| Install Command | Vacío |
| Output Directory | public |

`vercel.json` ya incluye esta configuración. No requiere variables de entorno, instalación de paquetes ni compilación.

## Edición

- Página: `public/index.html`.
- Logotipo y materiales: `public/assets/`.
- Mantén los nombres de los archivos para conservar los enlaces.
- Las respuestas de los ejercicios se procesan en el navegador. Los botones de contacto enlazan a Stratega.
- El acceso se configura en tu proyecto de Vercel; este paquete no incorpora inicio de sesión.

Documentación oficial consultada: https://vercel.com/docs/builds/configure-a-build y https://vercel.com/docs/project-configuration/vercel-json.

## Video integrado en el HTML

El video completo ya está incrustado dentro de `public/index.html`. No necesitas subir un MP4 a la carpeta assets ni contratar otro servicio.

Se optimizó en H.264/AAC, conservando resolución de 1280 × 720 y una duración aproximada de 6:21. La compresión reduce el peso con pérdida de calidad. El reproductor tiene controles y no inicia automáticamente.

La página descarga los datos del video junto con el HTML; la primera carga será más pesada que en la versión con un video externo. El HTML se mantiene por debajo del límite de 25 MiB para subir archivos desde el navegador a GitHub.

Para actualizar tu repositorio, sustituye `public/index.html` con el de este paquete. Conserva `public/assets/` para el logotipo y los materiales descargables, y `vercel.json` en la raíz. Si es la primera carga, sube el contenido del ZIP descomprimido.

Fuente del límite: https://docs.github.com/es/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
