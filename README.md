# meridad-web
Sitio estático de Meridad (GitHub Pages, dominio meridad.app).
- `/` — portada «El códice vivo» (`index.html` + `codice/`: Three.js 0.169 y GSAP 3.12 por CDN, Leonardo en `codice/leonardo.glb`, foto del escritorio generada con IA). App Store: https://apps.apple.com/app/id6827345327
- `/clasica/` — portada anterior, sin 3D (respaldo si el navegador no tiene WebGL).
- `/confirmado/` — destino del enlace «confirmar correo» de Supabase Auth.
- `/restablecer/` — formulario del enlace «restablecer contraseña» (usa la clave pública *anon* del proyecto, pensada para ir en el cliente).
- `/terminos/` y `/privacidad/` — borradores legales (revisar antes del lanzamiento).
