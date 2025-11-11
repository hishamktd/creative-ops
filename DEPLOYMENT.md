# CreativeOps - Deployment Guide

This guide will help you deploy your CreativeOps platform to production.

## Prerequisites

- Node.js 18+ installed
- pnpm 8+ installed
- A Supabase account (free tier works)
- A Vercel account (optional, for deployment)

## 1. Supabase Setup

### Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in project details:
   - Name: CreativeOps
   - Database Password: (generate a strong password)
   - Region: Choose closest to your users
4. Wait for the project to be created (~2 minutes)

### Get Your API Keys

1. In your Supabase project, go to Settings → API
2. Copy the following values:
   - Project URL (under "Project URL")
   - `anon` public key (under "Project API keys")
   - `service_role` key (under "Project API keys" - keep this secret!)

### Run Database Migrations

1. In your Supabase project, go to SQL Editor
2. Run each migration file in order:

**Step 1: Run `001_initial_schema.sql`**
- Copy the contents of `supabase/migrations/001_initial_schema.sql`
- Paste into the SQL Editor
- Click "Run"

**Step 2: Run `002_rls_policies.sql`**
- Copy the contents of `supabase/migrations/002_rls_policies.sql`
- Paste into the SQL Editor
- Click "Run"

**Step 3: Run `003_seed_data.sql`**
- Copy the contents of `supabase/migrations/003_seed_data.sql`
- Paste into the SQL Editor
- Click "Run"

### Enable Realtime (Optional but Recommended)

1. Go to Database → Replication
2. Enable replication for these tables:
   - `team_activity`
   - `notifications`
   - `tasks`

## 2. Local Development Setup

### Install Dependencies

```bash
pnpm install
```

### Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 3. Create Your First Admin User

1. Go to [http://localhost:3000/signup](http://localhost:3000/signup)
2. Fill in the form:
   - Full Name: Your Name
   - Email: your@email.com
   - Password: (choose a strong password)
   - Role: Select "Admin"
3. Click "Sign Up"
4. You'll be redirected to the dashboard

## 4. Production Deployment (Vercel)

### Prepare for Deployment

1. Push your code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

### Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`

### Add Environment Variables

In Vercel project settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Deploy

1. Click "Deploy"
2. Wait for the deployment to complete
3. Visit your deployed app!

## 5. Alternative Deployment Options

### Deploy to Netlify

1. Push code to GitHub
2. Go to [https://netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repository
5. Configure build settings:
   - Build command: `pnpm build`
   - Publish directory: `.next`
6. Add environment variables (same as Vercel)
7. Click "Deploy"

### Deploy with Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm install -g pnpm
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t creative-ops .
docker run -p 3000:3000 creative-ops
```

## 6. Post-Deployment Setup

### Configure Email (Optional)

1. In Supabase, go to Authentication → Email Templates
2. Customize email templates for:
   - Confirmation emails
   - Password reset emails
   - Magic link emails

### Set Up Storage (For File Uploads)

1. In Supabase, go to Storage
2. Create a new bucket called "assets"
3. Set permissions:
   - Public access: No
   - Allowed file types: images, videos, PDFs
4. Create RLS policies for the bucket

### Configure Custom Domain (Optional)

In Vercel:
1. Go to Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

## 7. Monitoring & Maintenance

### Set Up Error Tracking

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for usage analytics

### Database Backups

Supabase automatically backs up your database daily. To enable point-in-time recovery:
1. Upgrade to Supabase Pro plan
2. Go to Settings → Database
3. Enable Point-in-Time Recovery

### Performance Monitoring

1. Use Vercel Analytics (built-in)
2. Monitor Supabase dashboard for:
   - Database performance
   - API usage
   - Storage usage

## 8. Scaling Considerations

### Database Optimization

As your app grows:
1. Add database indexes for frequently queried columns
2. Use database connection pooling
3. Consider read replicas for heavy read workloads

### Caching

Implement caching strategies:
1. Use Next.js ISR (Incremental Static Regeneration)
2. Add Redis for session storage
3. Use CDN for static assets

### File Storage

For production file uploads:
1. Use Supabase Storage
2. Or integrate with S3, Cloudinary, or similar
3. Implement file size limits and validation

## 9. Security Checklist

- [ ] All environment variables are set correctly
- [ ] RLS policies are enabled on all tables
- [ ] Service role key is kept secret
- [ ] HTTPS is enabled (automatic with Vercel)
- [ ] CORS is configured properly
- [ ] File upload validation is in place
- [ ] Rate limiting is configured
- [ ] Regular security updates are scheduled

## 10. Troubleshooting

### Common Issues

**Issue: Can't connect to Supabase**
- Verify environment variables are correct
- Check if Supabase project is running
- Verify network connectivity

**Issue: Authentication not working**
- Check Supabase Auth settings
- Verify email templates are configured
- Check redirect URLs in Supabase settings

**Issue: Database queries failing**
- Verify RLS policies are set up correctly
- Check user permissions
- Review Supabase logs

### Getting Help

- Check the [Next.js documentation](https://nextjs.org/docs)
- Review [Supabase documentation](https://supabase.com/docs)
- Open an issue on GitHub

## Congratulations!

Your CreativeOps platform is now deployed and ready for your team to use!

Next steps:
1. Invite your team members
2. Create your first project
3. Start tracking tasks and assets
4. Customize the platform to your needs
