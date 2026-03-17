from flask import Flask
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from database import db

bcrypt = Bcrypt()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'mediashelf_secret_key'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
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

        # Seed categorías
        from models import Category
        categorias = ['Series', 'Películas', 'Videojuegos', 'Lecturas']
        for nombre in categorias:
            if not Category.query.filter_by(name=nombre).first():
                db.session.add(Category(name=nombre))
        db.session.commit()

        # Crear admin por defecto
        from models import User
        from flask_bcrypt import Bcrypt as BC
        bc = BC()
        bc.init_app(app)
        if not User.query.filter_by(username='admin').first():
            password_hash = bc.generate_password_hash('admin123').decode('utf-8')
            admin = User(
                username='admin',
                password_hash=password_hash,
                role='admin'
            )
            db.session.add(admin)
            db.session.commit()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)