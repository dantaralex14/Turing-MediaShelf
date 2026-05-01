import os
from flask import Blueprint, jsonify, request
from database import db
from models import Media, Category
import jwt
import requests
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

media_bp = Blueprint('media', __name__)

SECRET_KEY = os.environ.get('SECRET_KEY', 'mediashelf_secret_key')
TMDB_KEY = os.environ.get('TMDB_KEY')
RAWG_KEY = os.environ.get('RAWG_KEY')
COMIC_VINE_KEY = os.environ.get('COMIC_VINE_KEY')

def get_current_user(request):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except:
        return None

# --- RUTAS EXISTENTES ---

@media_bp.route('/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([{'id': c.id, 'name': c.name} for c in categories])

@media_bp.route('/all', methods=['GET'])
def get_all_media():
    category_id = request.args.get('category_id')
    query = Media.query
    if category_id:
        query = query.filter_by(category_id=category_id)
    media_list = query.all()
    return jsonify([{
        'id': m.id,
        'title': m.title,
        'cover_url': m.cover_url,
        'category_id': m.category_id,
        'year': m.year,
        'description': m.description
    } for m in media_list])

@media_bp.route('/add', methods=['POST'])
def add_media():
    user = get_current_user(request)
    if not user or user.get('role') != 'admin':
        return jsonify({'error': 'No autorizado'}), 403
    data = request.get_json()
    if not data.get('title') or not data.get('category_id'):
        return jsonify({'error': 'Título y categoría son requeridos'}), 400
    
    existing = Media.query.filter_by(title=data['title'], category_id=data['category_id']).first()
    if existing:
        return jsonify({'message': 'Título ya existe', 'id': existing.id}), 200

    new_media = Media(
        title=data['title'],
        cover_url=data.get('cover_url'),
        category_id=data['category_id'],
        year=data.get('year'),
        description=data.get('description')
    )
    db.session.add(new_media)
    db.session.commit()
    return jsonify({'message': 'Título agregado', 'id': new_media.id}), 201

@media_bp.route('/search/tmdb', methods=['GET'])
def search_tmdb():
    query = request.args.get('q')
    search_type = request.args.get('type', 'multi')
    page = request.args.get('page', 1)
    if not query:
        return jsonify({'error': 'Query requerido'}), 400
    
    # Usar solo variable de entorno, sin fallback hardcodeado
    if not TMDB_KEY:
        return jsonify({'error': 'TMDB Key no configurada'}), 500

    url = f'https://api.themoviedb.org/3/search/{search_type}?api_key={TMDB_KEY}&query={query}&language=es-MX&include_adult=false&page={page}'
    response = requests.get(url)
    data = response.json()
    results = []
    for item in data.get('results', []):
        results.append({
            'tmdb_id': item.get('id'),
            'title': item.get('title') or item.get('name'),
            'cover_url': f"https://image.tmdb.org/t/p/w500{item.get('poster_path')}" if item.get('poster_path') else None,
            'year': (item.get('release_date') or item.get('first_air_date') or '')[:4],
            'description': item.get('overview'),
            'type': item.get('media_type') or search_type,
            'source': 'tmdb'
        })
    return jsonify({'results': results, 'total_pages': data.get('total_pages', 1), 'current_page': int(page)})

@media_bp.route('/search/rawg', methods=['GET'])
def search_rawg():
    query = request.args.get('q')
    page = request.args.get('page', 1)
    if not query:
        return jsonify({'error': 'Query requerido'}), 400
    
    # Usar solo variable de entorno, sin fallback hardcodeado
    if not RAWG_KEY:
        return jsonify({'error': 'RAWG Key no configurada'}), 500

    url = f'https://api.rawg.io/api/games?key={RAWG_KEY}&search={query}&page_size=20&page={page}'
    response = requests.get(url)
    data = response.json()
    results = []
    for item in data.get('results', []):
        results.append({
            'title': item.get('name'),
            'cover_url': item.get('background_image'),
            'year': str(item.get('released', ''))[:4] if item.get('released') else '',
            'description': f"Plataformas: {', '.join([p['platform']['name'] for p in item.get('platforms', [])[:3]])}",
            'type': 'game',
            'source': 'rawg'
        })
    return jsonify({'results': results, 'has_next': bool(data.get('next')), 'current_page': int(page)})

# ==============================================================================
# 🔥 BÚSQUEDA DE LIBROS/CÓMICS/MANGA MEJORADA
# ==============================================================================
@media_bp.route('/search/books', methods=['GET'])
def search_books():
    query = request.args.get('q')
    page = int(request.args.get('page', 1))
    if not query:
        return jsonify({'error': 'Query requerido'}), 400

    results = []
    seen_ids = set() # Para evitar duplicados de Comic Vine

    print(f"🔍 [BACKEND] Buscando: '{query}' | Página: {page}")

    # --- 1. COMIC VINE (Cómics Occidentales) ---
    if COMIC_VINE_KEY:
        try:
            headers = {'User-Agent': 'MediaShelfApp/1.0'}
            offset = (page - 1) * 20
            
            # Buscar VOLÚMENES (Series)
            cv_url = f'https://comicvine.gamespot.com/api/search/?api_key={COMIC_VINE_KEY}&format=json&query={query}&resources=volume&limit=20&offset={offset}'
            cv_res = requests.get(cv_url, headers=headers, timeout=15)
            
            if cv_res.status_code == 200:
                data = cv_res.json().get('results', [])
                for item in data:
                    cv_id = item.get('id')
                    title = item.get('name')
                    if not cv_id or not title: continue
                    if cv_id in seen_ids: continue
                    seen_ids.add(cv_id)

                    cover_url = item['image'].get('super_url') if item.get('image') else None
                    year = str(item.get('start_year', '')) if item.get('start_year') else ''
                    publisher = item.get('publisher', {}).get('name', '') if item.get('publisher') else ''
                    
                    results.append({
                        'title': title,
                        'cover_url': cover_url,
                        'year': year,
                        'description': f"Serie. Editorial: {publisher}",
                        'type': 'comic_series',
                        'source': 'comic_vine'
                    })

            # Rellenar con ISSUES si hay pocos resultados
            if len(results) < 10:
                cv_url_issues = f'https://comicvine.gamespot.com/api/search/?api_key={COMIC_VINE_KEY}&format=json&query={query}&resources=issue&limit=20&offset={offset}'
                cv_res_issues = requests.get(cv_url_issues, headers=headers, timeout=15)
                
                if cv_res_issues.status_code == 200:
                    data_issues = cv_res_issues.json().get('results', [])
                    for item in data_issues:
                        cv_id = item.get('id')
                        title = item.get('name')
                        if not cv_id or not title: continue
                        if cv_id in seen_ids: continue
                        seen_ids.add(cv_id)
                        
                        cover_url = item['image'].get('super_url') if item.get('image') else None
                        year = item.get('cover_date', '')[:4] if item.get('cover_date') else ''
                        volume_name = item.get('volume', {}).get('name', '') if item.get('volume') else ''
                        publisher = item.get('publisher', {}).get('name', '') if item.get('publisher') else ''
                        
                        display_title = f"{title} ({volume_name})" if volume_name and volume_name.lower() not in title.lower() else title

                        results.append({
                            'title': display_title,
                            'cover_url': cover_url,
                            'year': year,
                            'description': f"Issue. Editorial: {publisher}",
                            'type': 'comic_issue',
                            'source': 'comic_vine'
                        })

        except Exception as e:
            print(f"💥 Error Comic Vine: {str(e)}")

    # --- 2. JIKAN (Manga) ---
    if len(results) < 15:
        try:
            jikan_url = f'https://api.jikan.moe/v4/manga?q={query}&limit=10&page=1'
            jikan_res = requests.get(jikan_url, timeout=5)
            
            if jikan_res.status_code == 200:
                jikan_data = jikan_res.json().get('data', [])
                for item in jikan_data:
                    title = item.get('title')
                    if not title: continue
                    if any(r['title'] == title and r['source'] == 'jikan' for r in results):
                        continue

                    images = item.get('images', {})
                    cover_url = images.get('jpg', {}).get('image_url') if images else None

                    results.append({
                        'title': title,
                        'cover_url': cover_url,
                        'year': str(item.get('published', {}).get('prop', {}).get('from', {}).get('year', '')),
                        'description': item.get('synopsis', '')[:100] if item.get('synopsis') else 'Manga',
                        'type': 'manga',
                        'source': 'jikan'
                    })
        except Exception as e:
            print(f"⚠️ Error Jikan: {e}")

    # --- 3. GOOGLE BOOKS (Libros Tradicionales y Novelas) ---
    try:
        start_index = (page - 1) * 20
        gb_url = f'https://www.googleapis.com/books/v1/volumes?q={query}&startIndex={start_index}&maxResults=20&printType=books&orderBy=relevance'
        gb_res = requests.get(gb_url, timeout=10)
        
        if gb_res.status_code == 200:
            for item in gb_res.json().get('items', []):
                info = item.get('volumeInfo', {})
                title = info.get('title')
                if not title: continue
                
                # Evitar duplicados simples por título con otras fuentes
                if any(r['title'].lower() == title.lower() for r in results):
                    continue

                cover = None
                if info.get('imageLinks'):
                    cover = info['imageLinks'].get('thumbnail') or info['imageLinks'].get('smallThumbnail')
                    if cover:
                        cover = cover.replace('http://', 'https://')
                
                authors = info.get('authors', ['Desconocido'])
                year = info.get('publishedDate', '')[:4] if info.get('publishedDate') else ''
                
                results.append({
                    'title': title,
                    'cover_url': cover,
                    'year': year,
                    'description': f"Autor: {', '.join(authors[:2])}",
                    'type': 'book',
                    'source': 'google_books'
                })
    except Exception as e:
        print(f'Error Google Books: {e}')

    # --- RESULTADO FINAL ---
    final_results = results[:30] # Limitamos a 30 para no saturar
    print(f"🏁 [BACKEND] Devolviendo {len(final_results)} resultados.")
    
    return jsonify({
        'results': final_results,
        'current_page': page,
        'has_next': len(results) >= 30
    })

# --- RUTAS RESTANTES ---

@media_bp.route('/<int:media_id>', methods=['GET'])
def get_media(media_id):
    m = Media.query.get_or_404(media_id)
    return jsonify({
        'id': m.id,
        'title': m.title,
        'cover_url': m.cover_url,
        'category_id': m.category_id,
        'year': m.year,
        'description': m.description
    })

@media_bp.route('/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    user = get_current_user(request)
    if not user or user.get('role') != 'admin':
        return jsonify({'error': 'No autorizado'}), 403
    m = Media.query.get_or_404(media_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'message': 'Título eliminado'}), 200