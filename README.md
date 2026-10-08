# CodeAlpha_EcommerceStore — Leafline

A simple full-stack e-commerce store (CodeAlpha Full Stack Task 1).

**Stack:** HTML/CSS/JavaScript · Node.js + Express · SQLite (better-sqlite3) · JWT auth (httpOnly cookie) · bcrypt

## Features
- Product listing with search and category filter
- Product details page
- Shopping cart (saved in the browser)
- User registration / login / logout
- Order processing (stock check and total calculated on the server inside a DB transaction)
- Order history
- Database tables: users, products, orders, order_items (auto-created and seeded on first run)

## Run
```bash
npm install
npm start
# open http://localhost:3000
```
Set `JWT_SECRET` env variable in production.

## API
| Method | Route | Auth |
|---|---|---|
| POST | /api/register, /api/login, /api/logout | – |
| GET | /api/me | – |
| GET | /api/products?q=&category= | – |
| GET | /api/products/:id | – |
| POST | /api/orders | yes |
| GET | /api/orders | yes |
