# GreenCart Project - Start to End Documentation

Date: 2026-04-06

## 1) Project Overview

GreenCart is a full-stack grocery e-commerce and delivery platform with:
- Customer storefront
- Seller portal
- Admin monitoring dashboard
- Real-time delivery tracking
- Multi-method payments (UPI, Stripe, COD)

It is implemented as two apps in one workspace:
- `client/`: Vite + React frontend (customer + seller UX)
- `my-website/`: Next.js App Router backend/API + admin pages

## 2) High-Level Architecture

- Frontend (`client/`)
  - React Router app for customer and seller journeys
  - Global state via `AppContext`
  - API communication via `src/lib/api.js`
- Backend (`my-website/`)
  - Next.js API routes under `src/app/api/*`
  - Authentication and authorization middleware
  - MongoDB Atlas with Mongoose models
  - Validation, rate limiting, payment lifecycle, cron maintenance

## 3) Technology Stack

- Frontend: React 18, Vite, Tailwind CSS, React Router, react-hot-toast
- Backend: Next.js 16 (App Router), TypeScript, ESLint
- Database: MongoDB Atlas + Mongoose
- Auth: Firebase phone OTP + Twilio Verify + JWT
- Payments: Stripe, UPI deep links (PhonePe/GPay/Paytm), COD
- Realtime: Ably + React-Leaflet
- Validation: Zod
- Monitoring: structured logs + payment monitoring + Sentry hooks

## 4) Core User Roles

- Customer: browse, buy, track, review
- Seller: add/manage products, process orders, see revenue/reports
- Admin: monitor operations, stock risk, payment failures

## 5) Customer Features

### Home
- Hero/banner
- Category discovery
- Best sellers
- Why-choose-us section
- Newsletter subscription form

### Product Discovery
- Product listing with search/filter/sort
- Product details with gallery, stock state, pricing info

### Cart
- Add/remove/update quantity
- Mini cart drawer + full cart page
- Local persistence (`localStorage`)

### Checkout
- Address capture form
- Payment methods:
  - UPI deep links (PhonePe, GPay, Paytm)
  - Stripe card flow
  - COD
- UPI target currently configured to: `6303846720@ibl`

### Orders
- Order history and status views
- Real-time delivery location updates (Ably)
- Live map rendering (Leaflet)

### Reviews
- Product ratings and comments
- Verified purchase badge logic
- Product average rating recalculation

### Profile
- View/update profile and address
- Role badge and account details

### Contact
- Contact page with form and info blocks

### Newsletter
- Subscribe API integration
- Re-subscribe support for previously inactive entries

## 6) Seller Features

### Seller Dashboard
- Live metrics: orders, revenue, products, unique customers
- Daily X-report access

### Add Product
- Multi-image form (up to 4 images)
- Core fields: name, category, price, stock, descriptions
- Custom category support and sale price toggle

### Product List
- Inventory management and listing actions

### Orders Management
- Seller order handling
- Delivery state updates
- COD collection at delivery support

## 7) Admin Features

### Admin Dashboard
- KPI cards (orders, revenue, pending, low stock)
- Recent orders table
- Low stock alerts

### Payment Failure Monitoring
- Failure counts and trends
- Provider/reason breakdown
- Alerting threshold behaviors

## 8) Backend API Domains

- Auth:
  - `/api/auth/login`
  - `/api/auth/register`
  - `/api/auth/request-otp`
  - `/api/auth/verify-otp`
- Products:
  - `/api/products`
  - `/api/products/[id]`
  - `/api/products/logs`
- Orders:
  - `/api/orders`
  - `/api/orders/[id]`
  - `/api/orders/weekly`
  - `/api/orders/[id]/deliver`
- Payments:
  - `/api/payments`
  - `/api/payments/upi`
  - `/api/payments/webhook`
- Reviews:
  - `/api/reviews`
- User profile:
  - `/api/users/profile`
- Newsletter:
  - `/api/newsletter`
- Realtime:
  - `/api/realtime/token`
- Reports:
  - `/api/reports/x`
- Admin:
  - `/api/admin/payments/failures`
- Maintenance:
  - `/api/maintenance/expire-pending-orders`

## 9) Data and Inventory Safety

- Soft reservation at order creation
  - Decrements reservable stock
  - Sets pending expiration window
- Hard confirmation on successful payment webhook
  - Final stock commitment
- Expiration job (cron)
  - Restores stock for stale unpaid pending orders

## 10) Security and Reliability Controls

- JWT-based protected routes and role checks
- Zod request payload validation
- Endpoint-level rate limiting
- Webhook idempotency controls
- Error handling and structured logging
- Cron secret protection for maintenance endpoint

## 11) Deployment Model

- Backend (`my-website/`) deploys to Vercel
- Frontend (`client/`) deploys to Netlify or Vercel static hosting
- SPA rewrites configured for frontend routing
- Vercel cron configured for order expiry maintenance

## 12) Readiness and Validation Assets

- Prelaunch checks available via scripts
- Post-deploy validation script available:
  - `my-website/scripts/post-deploy-validate.ps1`

## 13) End-to-End User Journey (Summary)

1. User opens storefront and browses products.
2. User signs in (OTP or credentials) and adds items to cart.
3. User checks out using UPI/Stripe/COD.
4. Backend creates pending order and reserves stock.
5. Payment confirmation webhook finalizes order and stock.
6. Seller processes and dispatches order.
7. Customer tracks delivery live on map.
8. Delivered order enables verified review flow.
9. Admin monitors platform and payment anomalies.

## 14) Current State Summary

- Feature implementation: complete
- Lint status: clean
- Build status: passing
- Remaining go-live blockers: production environment variables and provider credentials

---

If needed, this document can be split into:
- Product Requirements (PRD)
- API Reference
- Deployment Runbook
- QA Test Plan
for team handoff and release operations.
