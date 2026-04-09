import os
from flask import Blueprint, jsonify, request
from database import db
from models import Media, Category
import jwt
import requests
from dotenv import load_dotenv
load_dotenv()

media_bp = Blueprint('media', __name__)

SECRET_KEY = os.environ.get('SECRET_KEY', 'mediashelf_secret_key')
TMDB_KEY = os.environ.get('TMDB_KEY')
RAWG_KEY = os.environ.get('RAWG_KEY')

def get_current_user(request):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except:
        return None

# Obtener todas las categorías
@media_bp.route('/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([{'id': c.id, 'name': c.name} for c in categories])

# Obtener todo el catálogo
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
    existing = Media.query.filter_by(
        title=data['title'], 
        category_id=data['category_id']
    ).first()

    if existing:
        return jsonify({'message': 'Título ya existe en esta categoría', 'id': existing.id}), 200

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

# Buscar en TMDB
@media_bp.route('/search/tmdb', methods=['GET'])
def search_tmdb():
    query = request.args.get('q')
    search_type = request.args.get('type', 'multi')
    page = request.args.get('page', 1)
    if not query:
        return jsonify({'error': 'Query requerido'}), 400

    TMDB_KEY = 'c2ad5ded135cdde9ff8eb7763bcb5452'
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
            'type': item.get('media_type') or search_type
        })
    return jsonify({
        'results': results,
        'total_pages': data.get('total_pages', 1),
        'current_page': int(page)
    })

# Buscar videojuegos en RAWG
@media_bp.route('/search/rawg', methods=['GET'])
def search_rawg():
    query = request.args.get('q')
    page = request.args.get('page', 1)
    if not query:
        return jsonify({'error': 'Query requerido'}), 400

    RAWG_KEY = '9a8e7eb37f1148f98721144404a1ac92'
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
            'type': 'game'
        })
    return jsonify({
        'results': results,
        'has_next': bool(data.get('next')),
        'current_page': int(page)
    })

# Buscar lecturas
@media_bp.route('/search/books', methods=['GET'])
def search_books():
    query = request.args.get('q')
    page = int(request.args.get('page', 1))
    offset = (page - 1) * 20
    if not query:
        return jsonify({'error': 'Query requerido'}), 400

    results = []

    try:
        ol_url = f'https://openlibrary.org/search.json?q={query}&limit=10&offset={offset}'
        ol_res = requests.get(ol_url)
        ol_data = ol_res.json()

        for item in ol_data.get('docs', []):
            cover_id = item.get('cover_i')
            cover_url = f'https://covers.openlibrary.org/b/id/{cover_id}-L.jpg' if cover_id else None
            results.append({
                'title': item.get('title'),
                'cover_url': cover_url,
                'year': str(item.get('first_publish_year', '')),
                'description': f"Autor: {', '.join(item.get('author_name', ['Desconocido'])[:2])}",
                'type': 'book'
            })
    except:
        pass

    try:
        jikan_url = f'https://api.jikan.moe/v4/manga?q={query}&limit=10&page={page}'
        jikan_res = requests.get(jikan_url)
        jikan_data = jikan_res.json()

        for item in jikan_data.get('data', []):
            results.append({
                'title': item.get('title'),
                'cover_url': item.get('images', {}).get('jpg', {}).get('image_url'),
                'year': str(item.get('published', {}).get('prop', {}).get('from', {}).get('year', '')),
                'description': item.get('synopsis', '')[:150] if item.get('synopsis') else '',
                'type': 'manga'
            })
    except:
        pass

    return jsonify({
        'results': results,
        'current_page': page
    })

# Detalle de un título
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

# Eliminar título
@media_bp.route('/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    user = get_current_user(request)
    if not user or user.get('role') != 'admin':
        return jsonify({'error': 'No autorizado'}), 403

    m = Media.query.get_or_404(media_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'message': 'Título eliminado'}), 200