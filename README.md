# MediaShelf 📚

Plataforma web personal para registrar, calificar y 
reseñar contenido multimedia. Series, películas, 
videojuegos y lecturas en un solo lugar.

## Tecnologías

- **Frontend:** HTML5, CSS3, JavaScript ES6+
- **Backend:** Python + Flask
- **Base de datos:** SQLite
- **APIs:** TMDB, RAWG, OpenLibrary, Jikan

## Instalación

### Requisitos
- Python 3.10+
- pip

### Pasos

1. Clona el repositorio
git clone https://github.com/dantaralex14/Turing-MediaShelf.git
cd Turing-MediaShelf

2. Crea y activa el entorno virtual
python -m venv .venv
.venv\Scripts\activate  # Windows

3. Instala dependencias
cd backend
pip install -r requirements.txt

4. Corre el servidor
python app.py

5. Abre el frontend
Abre frontend/index.html con Live Server en VS Code

## Credenciales por defecto
- Usuario: admin
- Contraseña: admin123

## Funcionalidades
- Búsqueda de películas y series con TMDB
- Búsqueda de videojuegos con RAWG  
- Búsqueda de libros y manga con OpenLibrary y Jikan
- Sistema de calificación, estado y reseña
- Mi Lista personal por usuario
- Login con roles admin y user
- Diseño responsive

## Mejoras futuras
- Paginación coordinada entre OpenLibrary y Jikan
- Registro de usuarios desde el frontend
- Despliegue en producción
- Integrar ComicVine API para mejor cobertura 
  de cómics occidentales (Marvel, DC)

## Estado del proyecto
Proyecto Completado el 18 de marzo 2026  