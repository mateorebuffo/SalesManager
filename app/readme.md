Sistema Ventas Mostrador

Sistema simple para gestionar:

Ventas

Entregas

Pagos

Deuda por cliente

Diseñado para:

📱 iPhone (mostrador)

💻 Web desktop

Stack Tecnológico
Backend

Python

FastAPI

SQLAlchemy

PostgreSQL

Uvicorn

Frontend

React (Vite)

Estilos inline (dark minimal POS)

Sin router externo

Estructura del Proyecto
sistema_ventas/
│
├── app/
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   └── routers/
│       ├── clients.py
│       ├── products.py
│       └── sales.py
│
├── venv/
└── README.md


Frontend:

ventas-front/
├── src/
│   └── App.jsx

Cómo correr el proyecto
Backend
1️⃣ Activar entorno virtual

En PowerShell:

.\venv\Scripts\activate

2️⃣ Levantar servidor
uvicorn app.main:app --reload


Disponible en:

http://127.0.0.1:8000


Swagger:

http://127.0.0.1:8000/docs

Frontend

Dentro de ventas-front:

npm install
npm run dev


Disponible en:

http://localhost:5173

Modelo de Negocio
Cliente

id

name (único exacto)

phone

notes

Producto

id

name

type

active

Unique: name + type

Venta

id

client_id

sale_date

items[]

payments[]

Pago

Puede estar asociado a venta (sale_id)

Puede ser pago general (sale_id = null)

Lógica de Deuda

Para cada venta:

balance = sum(items) - sum(payments_asociados)


Para cliente:

total_balance = sum(balance_por_venta) - sum(pagos_generales)

Endpoints Clave
Clientes
GET  /clients
POST /clients
GET  /clients/{id}/statement
GET  /clients/{id}/deliveries
POST /clients/{id}/payments

Productos
GET  /products
POST /products

Ventas
POST /sales
POST /sales/{sale_id}/payments

UX Decisiones

Mobile first

Foco automático para flujo rápido

Barra inferior fija con total

Scroll independiente para lista de items

Buscadores en lugar de select

Reset completo tras confirmar venta

Estado Actual
Funciona:

Crear cliente

Crear producto

Crear venta con múltiples items

Pago inicial

Pagos posteriores por venta

Pagos generales

Statement por cliente

Pantalla POS

Pantalla Cliente

Pendiente Próximo Paso:

Registrar pago desde pantalla Cliente (UI inline)

Reemplazar alert() por toast

Deploy en red local

Mejoras visuales

Cómo continuar el proyecto en un nuevo chat

Pegá el archivo sistema_ventas_context.tech.json

Decí:

Continuamos sistema_ventas desde este contexto.
Estamos en la pantalla Cliente.
Quiero implementar registrar pago inline.

Filosofía del Proyecto

Simple

Rápido

Claro

Sin sobreingeniería

Pensado para flujo real de mostrador

Si querés, el siguiente nivel es:

Convertirlo en PWA (instalable en iPhone como app)

Deploy en red local

O prepararlo como producto vendible

Decime cuál atacamos ahora.


psql -U postgres -d sistema_ventas