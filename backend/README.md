# Pronote Backend API

A complete Node.js/Express backend for the Pronote clinical documentation platform.

## Features

- 🔐 **Authentication**: JWT-based auth with signup, login, password change
- 👤 **User Management**: Profile updates, settings, admin controls
- 📝 **Clinical Notes**: Full CRUD with templates, content sections, signing
- 🎤 **Audio Processing**: Upload, transcription via OpenAI Whisper
- 🤖 **AI Generation**: Clinical note generation from transcriptions
- 💳 **Subscriptions**: Stripe integration for payments
- 👑 **Admin Dashboard**: User management, statistics, activity logs
- 🔒 **Security**: Helmet, CORS, rate limiting, input validation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT
- **Payments**: Stripe
- **AI**: OpenAI (Whisper + GPT-4)
- **Validation**: Zod

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Secret for JWT tokens (generate a strong random string) |
| `OPENAI_API_KEY` | OpenAI API key for transcription/AI |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `FRONTEND_URL` | Frontend URL for CORS |

### 3. Set Up Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL schema file: `src/db/schema.sql`

This will create all necessary tables, indexes, and security policies.

### 4. (Optional) Seed Database

```bash
npm run db:seed
```

This creates demo accounts:
- Admin: `admin@pronote.com` / `admin123`
- Clinician: `demo@pronote.com` / `demo123`

### 5. Set Up Supabase Storage

1. Go to Supabase Dashboard > Storage
2. Create a new bucket called `audio-files`
3. Set it to public (or configure appropriate RLS policies)

### 6. Run the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/change-password` | Change password |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get profile |
| PUT | `/api/users/profile` | Update profile |
| GET | `/api/users/settings` | Get settings |
| PUT | `/api/users/settings` | Update settings |
| GET | `/api/users/stats` | Get dashboard stats |
| DELETE | `/api/users/account` | Delete account |

### Clinical Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | List notes (with pagination) |
| GET | `/api/notes/recent` | Get recent notes |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| POST | `/api/notes/:id/sign` | Sign note |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| GET | `/api/templates/:id` | Get template |
| POST | `/api/templates` | Create custom template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |

### Audio
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audio/upload` | Upload audio file |
| POST | `/api/audio/transcribe` | Transcribe audio |
| POST | `/api/audio/generate-note` | Generate note from transcription |
| GET | `/api/audio/files` | List audio files |
| DELETE | `/api/audio/files/:id` | Delete audio file |

### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscriptions` | Get subscription info |
| GET | `/api/subscriptions/plans` | Get available plans |
| POST | `/api/subscriptions/create-checkout` | Create Stripe checkout |
| POST | `/api/subscriptions/create-portal` | Create billing portal |
| POST | `/api/subscriptions/cancel` | Cancel subscription |
| POST | `/api/subscriptions/reactivate` | Reactivate subscription |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/:id` | Get user details |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/:id` | Update user |
| PUT | `/api/admin/users/:id/status` | Update user status |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/activity` | Activity logs |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe webhooks |

## Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Create products and prices for each plan:
   - Starter ($99/month)
   - Practice ($79/month)
   - Enterprise (contact sales)
4. Set up a webhook endpoint pointing to `/api/webhooks/stripe`
5. Configure the webhook to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`

## OpenAI Setup

1. Create an OpenAI account at https://platform.openai.com
2. Generate an API key
3. Add it to your `.env` file

The backend uses:
- **Whisper API** for audio transcription
- **GPT-4o** for clinical note generation

## Frontend Integration

To connect your frontend to this backend:

1. Create a `.env` file in your frontend root:
```
VITE_API_URL=http://localhost:3001/api
VITE_USE_API=true
```

2. The frontend stores are already configured to use the API when `VITE_USE_API=true`

## Project Structure

```
server/
├── src/
│   ├── index.ts          # Express app entry point
│   ├── db/
│   │   ├── schema.sql    # Database schema
│   │   └── seed.ts       # Database seeder
│   ├── lib/
│   │   ├── supabase.ts   # Supabase client
│   │   ├── stripe.ts     # Stripe client
│   │   └── openai.ts     # OpenAI client
│   ├── middleware/
│   │   ├── auth.ts       # Authentication middleware
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts       # Auth routes
│   │   ├── users.ts      # User routes
│   │   ├── notes.ts      # Notes routes
│   │   ├── templates.ts  # Templates routes
│   │   ├── audio.ts      # Audio routes
│   │   ├── subscriptions.ts
│   │   ├── admin.ts      # Admin routes
│   │   └── webhooks.ts   # Webhook handlers
│   └── types/
│       └── schemas.ts    # Zod validation schemas
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Security

- All passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire after 7 days
- Rate limiting: 100 requests per 15 minutes
- CORS configured for specific origin
- Helmet for HTTP security headers
- Input validation with Zod
- Row-level security in Supabase

## License

MIT
