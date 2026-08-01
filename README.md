# ShopWave — Full-Stack E-Commerce Platform

**A production-style e-commerce web application built as a final year project**, featuring a glassmorphism single-page frontend, a Node.js/Express REST API backend, JWT authentication, and a 250+ product catalog (real products & photos via the DummyJSON API) with server-side search, filtering, and pagination.

**Live Demo:** https://fancy-lamington-4698e4.netlify.app
**Backend API:** https://shopwave-fullstack.onrender.com

*(Note: the backend runs on a free hosting tier — if it hasn't been used in the last ~15 minutes, the first request can take up to 50 seconds to wake it up. Please be patient on first load!)*

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5, CSS3 (glassmorphism design system), Vanilla JavaScript (SPA routing, fetch API) | UI, client-side state, API consumption |
| Backend | Node.js, Express.js | REST API server |
| Database | MongoDB Atlas (Mongoose) | Data persistence (products, users, orders, reviews, coupons) |
| Authentication | jsonwebtoken (JWT), bcryptjs (password hashing) | Stateless auth, role-based access control |
| Utilities | jsPDF, QRCode.js, Font Awesome, Web Speech API | Invoice generation, order QR codes, icons, voice search |
| Deployment | Render (backend), Netlify (frontend) | Live hosting |

Why these choices? MongoDB Atlas provides a real, cloud-hosted, concurrent-write-safe database with schema modeling via Mongoose, matching how production Node.js applications are typically built.

## Project Structure

shopwave-fullstack/
  backend/
    server.js
    db.js (MongoDB connection, auto-seeds ~250 products via DummyJSON + admin account)
    models/ (Product.js, User.js, Order.js, Review.js, Coupon.js)
    middleware/auth.js
    routes/ (auth.js, products.js, cart.js, orders.js, admin.js, coupons.js)
    package.json
    .env.example
  frontend/
    index.html
    style.css
    app.js
  README.md
  LICENSE
  .gitignore

## Features

Core Shopping: 250+ product catalog across 10 categories, server-side pagination and search, price range slider, in-stock filter, multi-field sorting, infinite scroll, product detail pages with color/size selection, image zoom, Best Sellers, Recently Viewed, Compare up to 4 products, Wishlist with WhatsApp share.

Authentication & Account: JWT register/login with bcrypt hashing, forgot/reset password flow (demo mode), role-based access control, address book, loyalty points and referral program.

Cart & Checkout: cart persists in localStorage for guests, synced to backend for logged-in users, save for later, gift wrapping, coupon codes, GST tax calculation, multi-step checkout, real stock deduction on order.

Orders: order history with status timeline, cancel/reorder, real PDF invoice generation (jsPDF), real QR code generation (QRCode.js).

Reviews & Trust: star ratings and written reviews persisted server-side, automatic "Verified Buyer" badge based on real order history, trust badges.

Engagement: spin-the-wheel discount popup with real usable coupon, flash sale countdown, voice search (Web Speech API), rule-based FAQ chatbot.

Admin Panel: revenue dashboard with 7-day sales chart, product management, order management, user list, coupon management.

UX Polish: glassmorphism design, dark/light theme toggle, multi-currency and multi-language switch, skeleton loading states, toast notifications, custom 404 page, fully responsive.

## Setup & Installation

Prerequisites: Node.js v18+, a free MongoDB Atlas cluster (or local MongoDB), a modern browser.

Start the backend:
cd backend
npm install
cp .env.example .env
Edit .env: set MONGO_URI to your MongoDB Atlas connection string
npm start

Expected output:
MongoDB connected (ShopWave)
Fetched 194 real products from DummyJSON
Seeded 254 products across 10 categories
Seeded default admin user: admin@shopwave.com / admin123
ShopWave API running at http://localhost:5000

Open the frontend: open frontend/index.html directly, or use VS Code's Live Server extension.

Demo credentials:
Admin: admin@shopwave.com / admin123
Customer: sign up with any email

## Live Demo

Frontend (Netlify): https://fancy-lamington-4698e4.netlify.app
Backend API (Render): https://shopwave-fullstack.onrender.com

Free-tier note: the backend spins down after ~15 minutes of inactivity, so the first request afterward can take up to 50 seconds to wake up.

## API Reference

POST /api/auth/register - create account, returns JWT
POST /api/auth/login - login, returns JWT
GET /api/auth/me - current user profile (auth required)
POST /api/auth/forgot-password - generate a demo reset code
POST /api/auth/reset-password - reset password using the code
POST/DELETE /api/auth/addresses - manage address book (auth required)
GET /api/products - list products with category/search/sort/maxPrice/instock/page/limit
GET /api/products/:id - single product
POST/PUT/DELETE /api/products/:id - manage catalog (admin only)
GET/POST /api/products/:id/reviews - product reviews
GET /api/categories - distinct category list
GET/PUT/DELETE /api/cart - server-synced cart (auth required)
POST /api/orders - place an order (auth required)
GET /api/orders and /api/orders/:id - order history/detail (auth required)
PUT /api/orders/:id/cancel - cancel an order (auth required)
PUT /api/orders/:id/status - update order status (admin only)
GET /api/admin/stats, /orders, /users - admin dashboard data
GET/POST/DELETE /api/coupons - coupon list/manage/apply

## What's Real vs Simulated

REST API, JWT auth, password hashing: fully real.
Product catalog, search, pagination, filters: fully real, server-side.
Orders, stock deduction, reviews, coupons: fully real, persisted in MongoDB Atlas.
Cart sync for logged-in users: real, falls back to localStorage for guests.
PDF invoices / QR codes: genuinely generated from live data.
Live deployment: real, backend on Render, frontend on Netlify.
Forgot password: real logic, but no email provider, reset code shown on-screen.
Payment gateways: UI only, no live transaction.
Voice search: real (Web Speech API). Chatbot: rule-based, not an LLM.
Social login: placeholder button only.
Email/SMS notifications: UI toggles only.
Product images: real photos for 7 of 10 categories fetched live from DummyJSON; Books, Toys & Baby, and Pet Supplies use icon tiles since DummyJSON doesn't cover those categories.

## Future Roadmap

1. Wire up Razorpay test mode for real sandboxed payments.
2. Connect the chatbot to a real LLM API via a backend proxy route.
3. Add a real email provider for password resets and order confirmations.
4. Add Dockerfile, docker-compose.yml, and a GitHub Actions CI workflow.
5. Add automated tests (Jest + Supertest for the API, Playwright for the frontend).
6. Upgrade off Render/Netlify free tiers to remove the cold-start delay.

## Resume Bullet Points

ShopWave — Full-Stack E-Commerce Platform | Node.js, Express, MongoDB, JWT, JavaScript | Live Demo: https://fancy-lamington-4698e4.netlify.app

Designed, built, and deployed a full-stack e-commerce application with a 25+ endpoint REST API, MongoDB Atlas database with Mongoose schema modeling, JWT authentication with bcrypt hashing, and role-based admin authorization. Implemented server-side search/filter/pagination across a 250+ product catalog spanning 10 categories with real product photos, a backend-synced shopping cart, order management with real stock deduction, a review system with automatic verified-buyer detection, and PDF invoice generation. Deployed backend to Render and frontend to Netlify.

## License

MIT — free to use for learning, portfolio, and academic submission.