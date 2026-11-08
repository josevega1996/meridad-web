# meridad-web
Sitio estático de Meridad (GitHub Pages, dominio meridad.app).
- `/` — portada (`index.html` + `assets/landing.css`). Al aprobarse la app: poner el enlace de la App Store en el botón y activar `apple-itunes-app` (comentarios en el HTML).
- `/confirmado/` — destino del enlace «confirmar correo» de Supabase Auth.
- `/restablecer/` — formulario del enlace «restablecer contraseña» (usa la clave pública *anon* del proyecto, pensada para ir en el cliente).
- `/terminos/` y `/privacidad/` — borradores legales (revisar antes del lanzamiento).
