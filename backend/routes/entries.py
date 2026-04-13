import os
from flask import Blueprint, jsonify, request
from database import db
from models import Entry, Media
import jwt
from dotenv import load_dotenv
load_dotenv()

entries_bp = Blueprint('entries', __name__)
SECRET_KEY = os.environ.get('SECRET_KEY', 'mediashelf_secret_key')

def get_current_user(request):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except:
        return None

# Agregar entrada a lista
@entries_bp.route('/add', methods=['POST'])
def add_entry():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'No autorizado'}), 401

    data = request.get_json()
    if not data.get('media_id'):
        return jsonify({'error': 'media_id es requerido'}), 400

    # Verificar que el media existe
    media = Media.query.get(data['media_id'])
    if not media:
        return jsonify({'error': 'El título no existe'}), 404

    existing = Entry.query.filter_by(
        user_id=user['user_id'],
        media_id=data['media_id']
    ).first()
    
    if existing:
        return jsonify({'error': 'Ya tienes este título en tu lista'}), 409

    entry = Entry(
        user_id=user['user_id'],
        media_id=data['media_id'],
        status=data.get('status', 'pending'),
        rating=data.get('rating'),
        review=data.get('review')
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({'message': 'Agregado a tu lista', 'id': entry.id}), 201

# Ver lista completa
@entries_bp.route('/my', methods=['GET'])
def get_my_entries():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'No autorizado'}), 401

    entries = Entry.query.filter_by(user_id=user['user_id']).all()
    result = []
    for e in entries:
        media = Media.query.get(e.media_id)
        if not media:
            continue
        result.append({
            'entry_id': e.id,
            'media_id': e.media_id,
            'title': media.title,
            'cover_url': media.cover_url,
            'year': media.year,
            'category_id': media.category_id,  
            'status': e.status,
            'rating': e.rating,
            'review': e.review,
            'created_at': e.created_at.isoformat()
        })
    return jsonify(result)

# Actualizar entrada
@entries_bp.route('/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'No autorizado'}), 401

    entry = Entry.query.filter_by(id=entry_id, user_id=user['user_id']).first()
    if not entry:
        return jsonify({'error': 'Entrada no encontrada'}), 404

    data = request.get_json()
    if 'status' in data:
        entry.status = data['status']
    if 'rating' in data:
        entry.rating = data['rating']
    if 'review' in data:
        entry.review = data['review']

    db.session.commit()
    return jsonify({'message': 'Entrada actualizada'}), 200

# Eliminar entrada
@entries_bp.route('/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'No autorizado'}), 401

    entry = Entry.query.filter_by(id=entry_id, user_id=user['user_id']).first()
    if not entry:
        return jsonify({'error': 'Entrada no encontrada'}), 404

    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Entrada eliminada'}), 200

# Verificar si un media ya está en lista
@entries_bp.route('/check/<int:media_id>', methods=['GET'])
def check_entry(media_id):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'No autorizado'}), 401

    existing = Entry.query.filter_by(
        user_id=user['user_id'],
        media_id=media_id
    ).first()
    
    return jsonify({'exists': existing is not None})
@entries_bp.route('/stats', methods=['GET'])
def get_stats():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'No autorizado'}), 401

    entries = Entry.query.filter_by(user_id=user['user_id']).all()

    total = len(entries)
    por_estado = {'pending': 0, 'in_progress': 0, 'completed': 0}
    por_categoria = {'1': 0, '2': 0, '3': 0, '4': 0}
    ratings = []

    for e in entries:
        por_estado[e.status] = por_estado.get(e.status, 0) + 1
        media = Media.query.get(e.media_id)
        if media:
            cat = str(media.category_id)
            por_categoria[cat] = por_categoria.get(cat, 0) + 1
        if e.rating:
            ratings.append({
                'title': media.title if media else '?',
                'cover_url': media.cover_url if media else None,
                'rating': e.rating,
                'status': e.status,
                'category_id': media.category_id if media else None
            })

    ratings_sorted = sorted(ratings, key=lambda x: x['rating'], reverse=True)
    promedio = round(sum(r['rating'] for r in ratings) / len(ratings), 1) if ratings else 0

    return jsonify({
        'total': total,
        'por_estado': por_estado,
        'por_categoria': por_categoria,
        'promedio_general': promedio,
        'top_calificados': ratings_sorted
    })