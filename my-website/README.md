# 🍎 FreshMart - Grocery Delivery Website

A full-stack grocery delivery e-commerce website built with **Next.js 16**, **MongoDB**, **Express**, **React**, and **Node.js**. Features online payments via Stripe and admin panel for inventory management.

![FreshMart](https://img.shields.io/badge/FreshMart-Grocery%20Delivery-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green)
![Stripe](https://img.shields.io/badge/Stripe-Payments-blue)

## ✨ Features

### 🛒 Customer Features
- **Browse Products**: Filter by category, search, and sort products
- **Shopping Cart**: Add/remove items, quantity management
- **User Authentication**: Register/login with JWT tokens
- **Secure Checkout**: Stripe payment integration
- **Order Tracking**: Real-time order status updates
- **Responsive Design**: Mobile-first with Tailwind CSS

### 👨‍💼 Admin Features
- **Product Management**: Add, edit, delete products
- **Inventory Control**: Stock management and alerts
- **Order Management**: View and update order status
- **Analytics Dashboard**: Sales reports and insights
- **User Management**: Customer account management

### 💳 Payment & Security
- **Stripe Integration**: Secure online payments
- **Webhook Handling**: Automatic payment confirmation
- **Data Validation**: Input sanitization and validation
- **JWT Authentication**: Secure API access

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or cloud)
- Stripe account for payments

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd freshmart
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```

   For production deployments, use `.env.production.example` as the baseline instead of local development values.

   Fill in your environment variables:
   ```env
   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/freshmart?retryWrites=true&w=majority
   JWT_SECRET=replace_with_a_long_random_64_plus_character_secret
   STRIPE_PUBLISHABLE_KEY=pk_live_your_key
   STRIPE_SECRET_KEY=sk_live_your_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   OTP_DELIVERY_PROVIDER=twilio-verify
   TWILIO_ACCOUNT_SID=AC_your_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_VERIFY_SERVICE_SID=VA_your_verify_service_sid
   PHONEPE_WEBHOOK_SECRET=your_phonepe_secret
   PAYTM_WEBHOOK_SECRET=your_paytm_secret
   RAZORPAY_WEBHOOK_SECRET=your_razorpay_secret
   UPI_WEBHOOK_SECRET_GENERIC=your_generic_upi_secret
   UPI_PENDING_ORDER_TTL_MINUTES=15
   CRON_SECRET=your_cron_secret
   ```

   Production rules:
   - Use MongoDB Atlas, not localhost.
   - Use long random secrets for `JWT_SECRET`, `NEXTAUTH_SECRET`, and `CRON_SECRET`.
   - Use Stripe live keys only in production.

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

7. **Run launch readiness checks**
   ```bash
   npm run prelaunch:check
   ```

## 📁 Project Structure

```
freshmart/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   │   ├── auth/       # Authentication endpoints
│   │   │   ├── products/   # Product CRUD
│   │   │   ├── orders/     # Order management
│   │   │   └── payments/   # Stripe integration
│   │   ├── admin/          # Admin dashboard
│   │   ├── cart/           # Shopping cart
│   │   ├── products/       # Product listing
│   │   └── page.tsx        # Home page
│   ├── lib/                # Utility functions
│   │   └── mongodb.ts      # Database connection
│   └── models/             # MongoDB schemas
│       ├── User.ts
│       ├── Product.ts
│       └── Order.ts
├── public/                 # Static assets
├── .env.example           # Environment template
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **React Hooks** - State management

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication

### Payments & Security
- **Stripe** - Payment processing
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Products
- `GET /api/products` - Fetch all products
- `POST /api/products` - Create product (Admin)
- `GET /api/products/[id]` - Fetch single product
- `PUT /api/products/[id]` - Update product (Admin)
- `DELETE /api/products/[id]` - Delete product (Admin)

### Orders
- `GET /api/orders` - Fetch user orders
- `POST /api/orders` - Create new order

### Payments
- `POST /api/payments` - Create payment intent
- `POST /api/payments/webhook` - Stripe webhook
- `POST /api/payments/upi/webhook` - UPI webhook callback

### Maintenance
- `POST /api/maintenance/expire-pending-orders` - Sweep expired pending UPI orders

## 🚀 Deployment

### Vercel (Recommended)
1. **Connect your repository**
   ```bash
   vercel --prod
   ```

2. **Set environment variables** in Vercel dashboard

   Required production variables:
   ```env
   MONGODB_URI=
   JWT_SECRET=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   PHONEPE_WEBHOOK_SECRET=
   PAYTM_WEBHOOK_SECRET=
   RAZORPAY_WEBHOOK_SECRET=
   UPI_WEBHOOK_SECRET_GENERIC=
   UPI_PENDING_ORDER_TTL_MINUTES=15
   CRON_SECRET=
   ```

3. **Configure MongoDB** (use MongoDB Atlas for production)

4. **Set up Stripe webhooks** pointing to your Vercel URL

5. **Set up UPI webhooks** pointing to `/api/payments/upi/webhook`

   Provider hint options:
   - Send `x-upi-provider: phonepe`, `paytm`, or `razorpay`
   - Or call `/api/payments/upi/webhook?provider=phonepe`

6. **Schedule the maintenance sweep**

   Call `POST /api/maintenance/expire-pending-orders` on an interval shorter than your order TTL.

   Example request:
   ```bash
   curl -X POST https://your-domain.example/api/maintenance/expire-pending-orders \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   Recommended cadence:
   - Every 5 minutes if `UPI_PENDING_ORDER_TTL_MINUTES=15`

### Manual Deployment
```bash
npm run build
npm start
```

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure authentication
- **Input Validation**: Server-side validation
- **CORS Protection**: Configured for allowed origins
- **Rate Limiting**: API rate limiting (can be added)

## 📊 Database Schema

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (customer/admin/seller),
  phone: String,
  address: Object,
  isActive: Boolean
}
```

### Product
```javascript
{
  name: String,
  price: Number,
  category: String,
  stock: Number,
  image: String,
  rating: Number,
  discount: Number
}
```

### Order
```javascript
{
  user: ObjectId,
  orderItems: Array,
  totalPrice: Number,
  status: String,
  paymentResult: Object,
  shippingAddress: Object
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@freshmart.com or join our Discord community.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework
- [Stripe](https://stripe.com/) - Payment processing
- [MongoDB](https://mongodb.com/) - Database
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**Happy Shopping! 🛒**
