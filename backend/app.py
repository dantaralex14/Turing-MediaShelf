from flask import Flask
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from database import db
from dotenv import load_dotenv
import os

load_dotenv()

bcrypt = Bcrypt()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///database.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    CORS(app)
    db.init_app(app)
    bcrypt.init_app(app)

    from routes.auth import auth_bp
    from routes.media import media_bp
    from routes.entries import entries_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(media_bp, url_prefix='/api/media')
    app.register_blueprint(entries_bp, url_prefix='/api/entries')

    with app.app_context():
        db.create_all()

        from models import Category
        categorias = ['Series', 'Películas', 'Videojuegos', 'Lecturas']
        for nombre in categorias:
            if not Category.query.filter_by(name=nombre).first():
                db.session.add(Category(name=nombre))
        db.session.commit()

        from models import User
        if not User.query.filter_by(username='admin').first():
            password_hash = bcrypt.generate_password_hash('admin123').decode('utf-8')
            admin = User(username='admin', password_hash=password_hash, role='admin')
            db.session.add(admin)
            db.session.commit()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)