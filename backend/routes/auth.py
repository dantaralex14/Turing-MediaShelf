from flask import Blueprint, jsonify, request
from models import User
from database import db
from flask_bcrypt import Bcrypt
import jwt
import datetime
import os

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()

SECRET_KEY = 'mediashelf_secret_key'

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username y password son requeridos'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'El usuario ya existe'}), 409

    password_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    role = data.get('role', 'user')

    new_user = User(
        username=data['username'],
        password_hash=password_hash,
        role=role
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'Usuario creado exitosamente'}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username y password son requeridos'}), 400

    user = User.query.filter_by(username=data['username']).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Credenciales incorrectas'}), 401

    token = jwt.encode({
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, SECRET_KEY, algorithm='HS256')

    return jsonify({
        'token': token,
        'role': user.role,
        'username': user.username
    }), 200