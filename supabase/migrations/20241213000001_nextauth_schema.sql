-- Create next_auth schema for NextAuth.js
CREATE SCHEMA IF NOT EXISTS next_auth;

-- Create users table for NextAuth
CREATE TABLE IF NOT EXISTS next_auth.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create accounts table for NextAuth
CREATE TABLE IF NOT EXISTS next_auth.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, "providerAccountId")
);

-- Create sessions table for NextAuth
CREATE TABLE IF NOT EXISTS next_auth.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create verification_tokens table for NextAuth
CREATE TABLE IF NOT EXISTS next_auth.verification_tokens (
  identifier TEXT,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (identifier, token)
);

-- Update existing users table to work with NextAuth
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nextauth_user_id UUID REFERENCES next_auth.users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON next_auth.accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON next_auth.sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON next_auth.sessions("sessionToken");
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON next_auth.verification_tokens(token);

-- Enable RLS on NextAuth tables
ALTER TABLE next_auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE next_auth.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE next_auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE next_auth.verification_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for NextAuth tables
-- Users can read their own data
CREATE POLICY "Users can read own data" ON next_auth.users
  FOR SELECT USING (true); -- NextAuth needs to read user data

CREATE POLICY "Users can update own data" ON next_auth.users
  FOR UPDATE USING (true); -- NextAuth needs to update user data

CREATE POLICY "Users can insert data" ON next_auth.users
  FOR INSERT WITH CHECK (true); -- NextAuth needs to create users

-- Accounts policies
CREATE POLICY "Users can manage own accounts" ON next_auth.accounts
  FOR ALL USING (true); -- NextAuth manages accounts

-- Sessions policies  
CREATE POLICY "Users can manage own sessions" ON next_auth.sessions
  FOR ALL USING (true); -- NextAuth manages sessions

-- Verification tokens policies
CREATE POLICY "Anyone can manage verification tokens" ON next_auth.verification_tokens
  FOR ALL USING (true); -- NextAuth manages verification tokens

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA next_auth TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA next_auth TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA next_auth TO authenticated;

-- Grant permissions to anon users for signup
GRANT USAGE ON SCHEMA next_auth TO anon;
GRANT INSERT ON next_auth.users TO anon;
GRANT INSERT ON next_auth.accounts TO anon;
GRANT INSERT ON next_auth.sessions TO anon;
GRANT INSERT, SELECT ON next_auth.verification_tokens TO anon;