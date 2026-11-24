# E-Commerce and Inventory Management System (Backend)

Capstone Project 4 – Backend Development. A REST API with real-time notifications for customers, sellers and administrators.

**Stack:** Node.js · Express.js · MongoDB + Mongoose · JWT · bcrypt · Joi · EventEmitter · Socket.IO

## Features
- Customer / seller / admin roles (RBAC), bcrypt password hashing, JWT access + rotating refresh tokens
- Product and category management, search / filter / sort / pagination
- Server-side shopping cart and order workflow with validated status transitions
- **Atomic stock updates** (no overselling), stock restored on cancellation, low-stock alerts
- Aggregation reports: sales summary, best sellers, inventory summary by category
- Real-time notifications (Socket.IO) driven by an internal EventEmitter event bus
- Payment is **simulated** (orders are marked `SIMULATED_PAID`; no real gateway)

## Getting started
Prerequisites: Node.js 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
npm install
cp .env.example .env     # then edit secrets / MONGO_URI (.env is git-ignored)
npm run seed             # loads sample users, categories, products and one order
npm run dev              # or: npm start   -> http://localhost:5000
```

### Environment variables
| Variable | Purpose |
|---|---|
| PORT | HTTP port (default 5000) |
| MONGO_URI | MongoDB connection string |
| JWT_ACCESS_SECRET / JWT_REFRESH_SECRET | Signing secrets (use long random values) |
| JWT_ACCESS_EXPIRES / JWT_REFRESH_EXPIRES | Token lifetimes (15m / 7d) |
| BCRYPT_ROUNDS | bcrypt cost factor (10) |

### Seed accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@shop.com | Admin@123 |
| Seller | seller1@shop.com / seller2@shop.com | Seller@123 |
| Customer | customer1@shop.com / customer2@shop.com | Customer@123 |

Public registration only creates `customer` or `seller` accounts; admins come from the seed (or another admin).

## Architecture (MVC / layered)
```
server.js                     bootstrap: DB -> HTTP server -> Socket.IO
src/app.js                    middleware chain + route mounting
src/routes/        (R)        URL -> middleware -> controller
src/middleware/               auth (protect/authorize), validate (Joi), error (centralized)
src/controllers/   (C)        business logic
src/models/        (M)        Mongoose schemas, indexes
src/validators/               Joi schemas
src/config/                   db, events (EventEmitter), socket, listeners
seed/seed.js                  sample data
postman/                      API test collection
```
Request flow: **Route → Middleware (auth, role, validation) → Controller → Model → MongoDB → Response**. Any thrown error goes to the centralized handler and returns `{ success:false, message, errors? }`.

## Database design
| Collection | Key fields | Relationships |
|---|---|---|
| users | name, email (unique), password (bcrypt, hidden), role, isActive, refreshTokenHash | – |
| categories | name (unique), description | – |
| products | name, description, price, stock, lowStockThreshold, isActive | category → categories, seller → users |
| carts | user (unique), items[{product, quantity}] | user → users, product → products |
| orders | customer, items[{product, name, price, quantity, seller}], shippingAddress, totalAmount, status, payment, statusHistory | customer → users, items.product → products, items.seller → users |

Carts hold only IDs and quantities, so prices can't be forged. Orders store a **price/name snapshot** so history stays correct if a product changes later.

### Indexes
1. `products`: text index on `name, description` – powers `?q=` search
2. `products`: `{ category: 1, price: 1 }` – category filter with price range/sort
3. `products`: `{ seller: 1, isActive: 1 }` – seller listings and scoped reports
4. `orders`: `{ customer: 1, createdAt: -1 }` – order history
5. `orders`: `{ 'items.seller': 1, status: 1 }` – seller order queue
6. `orders`: `{ status: 1, createdAt: -1 }` – admin filters, date-range reports
7. `users.email`, `carts.user`, `categories.name` – unique indexes

### Aggregation pipelines
| Endpoint | Stages | Purpose |
|---|---|---|
| `GET /api/reports/sales-summary` | $match → $unwind → $group (by day) → $project → $sort | Revenue, units, order count per date |
| `GET /api/reports/best-selling` | $match → $unwind → $group → $sort → $limit → $lookup → $project | Top products with current stock |
| `GET /api/reports/inventory-summary` | $match → $group (by category) → $lookup → $project → $sort | Units and stock value per category |

Sellers automatically see only their own figures; admins see everything.

## Security and business rules
- bcrypt hashing; secrets only via `.env`; helmet, CORS, rate-limited auth routes
- Short-lived access token + refresh token stored **hashed** and rotated on every refresh; logout revokes it
- Enforced on the backend (not just UI): RBAC via `authorize(...)`, ownership checks (a seller cannot edit another seller's product; a customer cannot touch another customer's cart/orders)
- Prices read from the database at checkout, totals computed on the server
- Stock cannot go negative: `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })` is atomic, with rollback of already-reserved items if one fails
- Order transitions: `pending → confirmed → shipped → delivered`; `pending/confirmed → cancelled` (stock restored). Customers may only cancel; sellers act only on orders containing their products; admins can act on any order
- Products are soft-deleted so past orders stay valid

## API reference
All responses are JSON. Protected routes need `Authorization: Bearer <accessToken>`.

| Group | Method & Path | Access |
|---|---|---|
| Auth | POST `/api/auth/register`, `/login`, `/refresh` · POST `/logout` | public · logout: any user |
| Users | GET/PATCH `/api/users/me` | any user |
| | GET `/api/users`, GET/PATCH/DELETE `/api/users/:id` | admin |
| Categories | GET `/api/categories` | public |
| | POST `/api/categories`, PATCH/DELETE `/api/categories/:id` | admin |
| Products | GET `/api/products` (`q, category, seller, minPrice, maxPrice, inStock, sort, page, limit`), GET `/api/products/:id` | public |
| | POST `/api/products`, PATCH `/:id`, PATCH `/:id/stock`, DELETE `/:id` | seller (own) / admin |
| Cart | GET `/api/cart` · POST `/api/cart/items` · PATCH/DELETE `/api/cart/items/:productId` · DELETE `/api/cart` | customer |
| Orders | POST `/api/orders` | customer |
| | GET `/api/orders`, GET `/api/orders/:id` | role-scoped |
| | PATCH `/api/orders/:id/status` | customer (cancel) / seller / admin |
| Reports | GET `/api/reports/sales-summary`, `/best-selling`, `/inventory-summary`, `/low-stock` | seller (own) / admin |

### Sample requests
```http
POST /api/auth/login
{ "email": "customer1@shop.com", "password": "Customer@123" }
→ 200 { "success": true, "data": { "user": {...}, "accessToken": "...", "refreshToken": "..." } }

POST /api/cart/items         (customer)
{ "productId": "<id>", "quantity": 2 }
→ 201 { "success": true, "data": { "items": [...], "totalAmount": 1598 } }

POST /api/orders             (customer)
{ "shippingAddress": { "fullName": "Asha", "phone": "9876543210", "line1": "12 MG Road",
                       "city": "Palwal", "state": "Haryana", "postalCode": "121102" } }
→ 201 order with payment.status = "SIMULATED_PAID"
→ 409 { "success": false, "message": "Insufficient stock for \"USB-C Hub\"" }

PATCH /api/orders/:id/status (seller)  { "status": "confirmed" }
```
Error shape: `{ "success": false, "message": "Validation failed", "errors": [{ "field": "price", "message": "..." }] }`

Status codes used: 200, 201, 400 (validation / bad transition), 401 (no or bad token), 403 (role / ownership), 404, 409 (duplicate / insufficient stock).

## EventEmitter and Socket.IO
**EventEmitter** (`src/config/events.js`) is the internal event bus. Controllers emit `order.placed`, `order.statusChanged` and `stock.low`; `src/config/listeners.js` reacts. This keeps controllers free of notification code and lets new reactions (email, audit log) be added without touching business logic.

**Socket.IO** (`src/config/socket.js`) delivers the real-time feature. Clients connect with their JWT (`auth: { token }`); unauthenticated sockets are rejected. Each client auto-joins `user:<id>` and `role:<role>` rooms.

| Event | Sent to | When |
|---|---|---|
| `order:placed` | the customer | order created |
| `order:new` | involved sellers + admins | order created |
| `order:status` | the customer | status changed |
| `stock:low` | owning seller + admins | stock ≤ threshold after a sale or manual stock update |

Demo: `npm run socket-demo -- <sellerAccessToken>` in one terminal, then place an order as a customer.

## Testing
Import `postman/ecommerce-api.postman_collection.json` into Postman, run `npm run seed`, then run the folders in order with the Collection Runner (tokens and IDs are stored automatically). It covers:
- **Success** cases (auth, CRUD, cart, order flow, reports, stock reduced/restored)
- **Validation failure** (missing fields, weak password)
- **Unauthorized access** (no token, invalid token, wrong role, other seller/customer)
- **Not found, duplicate, insufficient stock, empty cart, invalid status transition**

To regenerate the collection: `python3 scripts/build_postman.py`.

## Mapping to the evaluation rubric
| Rubric component | Where |
|---|---|
| Planning / problem understanding | This README, project report |
| Database design and modelling | `src/models`, tables above |
| Node.js and Express | `server.js`, `src/app.js` |
| MVC and REST API | routes / controllers / models, status codes |
| MongoDB and Mongoose | schemas, 3 aggregations, 7 indexes |
| Auth, authorization, security | `authController`, `middleware/auth.js`, RBAC and ownership rules |
| Middleware and error handling | `middleware/validate.js`, `middleware/error.js` |
| Real-time | `config/events.js`, `config/listeners.js`, `config/socket.js` |
| API testing | `postman/` |
| Demo, documentation, viva | README, seed data, `socket-demo` |
