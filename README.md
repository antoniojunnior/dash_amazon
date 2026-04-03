# Amazon Operations Dashboard

A professional B2B SaaS dashboard designed to manage Amazon inventory, orders, and pricing with real-time synchronization and advanced analytics.

## Features

- **Inventory Management**: Track and manage stock levels across all Amazon marketplaces.
- **Order Synchronization**: Automated bi-daily synchronization of orders using Amazon SP-API.
- **Pricing Optimization**: Monitor and adjust prices to maximize profitability.
- **Dashboard Analytics**: Visualize sales data, inventory health, and operational metrics.
- **Background Sync**: Automated cron jobs for consistent data updates.

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database/Auth**: Supabase
- **API Integration**: Amazon Selling Partner API (SP-API)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- Supabase account and project
- Amazon Seller Central Developer credentials

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dash_amazon
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env.local` file and add your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   AMAZON_SELLER_ID=your_seller_id
   AMAZON_CLIENT_ID=your_client_id
   AMAZON_CLIENT_SECRET=your_client_secret
   AMAZON_REFRESH_TOKEN=your_refresh_token
   # ... other necessary variables
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `src/app`: Next.js pages and API routes.
- `src/components`: Reusable UI components.
- `src/lib`: Logic for API integrations, database access, and utility functions.
- `src/types`: TypeScript definitions.

## Deployment

### Cloudflare Pages / Workers (via OpenNext)

1. **Build Settings**: 
   - **Build Command**: `npm run build:cf` (Crucial to avoid infinite loops)
   - **Output Directory**: `.next` (Cloudflare will detect the worker from `wrangler.jsonc`)
2. **Environment Variables**:
   - Add all keys from `.env.example` (including Supabase and Amazon credentials) to the Cloudflare dashboard.
3. **Deploy**:
   - Every push to `main` will trigger a build and deploy.

## Maintenance

- **Backfill**: A manual backfill route is available at `/api/sync/backfill`.
- **Cron Jobs**: Automated sync runs via `/api/cron/sync-orders`.

---
Developed as part of the Amazon Operations Management suite.
