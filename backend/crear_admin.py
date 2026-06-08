import os
os.environ['DATABASE_URL'] = 'postgresql://postgres:ARpzxRzJrvQBxRMhNyghUmhujdBVKRko@zephyr.proxy.rlwy.net:27215/railway'

from app import create_app

app = create_app()
print('Admin y categorias creados exitosamente')