from database import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(10), default='user')  # 'admin' o 'user'
    entries = db.relationship('Entry', backref='user', lazy=True)

class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    media = db.relationship('Media', backref='category', lazy=True)

class Media(db.Model):
    __tablename__ = 'media'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    cover_url = db.Column(db.String(500))
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    year = db.Column(db.Integer)
    description = db.Column(db.Text)
    entries = db.relationship('Entry', backref='media', lazy=True)

class Entry(db.Model):
    __tablename__ = 'entries'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    media_id = db.Column(db.Integer, db.ForeignKey('media.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, completed
    rating = db.Column(db.Float)
    review = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)