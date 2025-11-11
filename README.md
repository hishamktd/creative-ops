# CreativeOps - Creative Studio Management SaaS

A comprehensive web-based platform for design and production studios to manage projects, tasks, assets, feedback, team activity, and invoicing.

## Features

### Core Modules
- **Project & Task Management**: Kanban + List view, status tracking, deadlines
- **Asset Management**: File uploads, version control, previews
- **Feedback & Revision System**: Pinned comments, threaded discussions, client view
- **Gamified Team Activity**: Live team dashboard with avatars and XP system
- **Invoice & Billing**: Generate, track, and export invoices
- **Dashboard**: Analytics, workload distribution, revenue overview

### User Roles
- Admin (full access)
- Team Members (project access)
- Clients (restricted view)

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **State Management**: Zustand
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Database Setup

Run the SQL migrations in `/supabase/migrations` in your Supabase SQL editor:

1. `001_initial_schema.sql` - Creates all tables and relationships
2. `002_rls_policies.sql` - Sets up Row Level Security
3. `003_seed_data.sql` - Adds sample data (optional)

## Project Structure

```
creative-ops/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main app pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   └── modules/          # Feature modules
├── lib/                  # Utility functions
│   ├── supabase/        # Supabase client & helpers
│   ├── hooks/           # Custom React hooks
│   └── utils/           # Helper functions
├── types/               # TypeScript type definitions
├── store/               # Zustand stores
└── supabase/           # Database migrations & types
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables

Ensure all variables from `.env.example` are set in your production environment.

## Development Guidelines

### Code Structure
- Keep components modular and reusable
- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use server components by default, client components only when needed

### Styling
- Use Tailwind CSS utility classes
- Primary color: Green (defined in tailwind.config.ts)
- Keep UI clean and minimal
- Ensure mobile responsiveness

### State Management
- Use Zustand for global state
- Use React Server Components for data fetching when possible
- Implement optimistic updates for better UX

## License

Proprietary - All rights reserved
