#!/bin/bash

# Debug Script for Realtime Channel Error
# Run this script to gather diagnostic information

echo "=========================================="
echo "Realtime Channel Error Debug Report"
echo "Date: $(date)"
echo "=========================================="
echo ""

echo "1. Checking Supabase Status..."
echo "----------------------------------------"
pnpm supabase status 2>&1
echo ""

echo "2. Checking Database State..."
echo "----------------------------------------"
echo "Users:"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT id, name, email, family_id, role FROM users;" 2>&1
echo ""

echo "Families:"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT id, name, invite_code FROM families;" 2>&1
echo ""

echo "Channels:"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT c.id, c.family_id, c.name, c.is_default, f.name as family_name FROM channels c JOIN families f ON c.family_id = f.id;" 2>&1
echo ""

echo "3. Checking Realtime Configuration..."
echo "----------------------------------------"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT schemaname, tablename FROM pg_publication_tables WHERE publication_name = 'supabase_realtime';" 2>&1
echo ""

echo "4. Checking RLS Policies on Messages..."
echo "----------------------------------------"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT schemaname, tablename, policyname, permissive, cmd FROM pg_policies WHERE tablename = 'messages';" 2>&1
echo ""

echo "5. Checking RLS Policies on Channels..."
echo "----------------------------------------"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT schemaname, tablename, policyname, permissive, cmd FROM pg_policies WHERE tablename = 'channels';" 2>&1
echo ""

echo "6. Checking Applied Migrations..."
echo "----------------------------------------"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;" 2>&1
echo ""

echo "7. Checking Environment Variables..."
echo "----------------------------------------"
if [ -f .env.local ]; then
    echo "NEXT_PUBLIC_SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2 | cut -c1-30)..."
else
    echo "❌ .env.local file not found!"
fi
echo ""

echo "8. Checking Docker Containers..."
echo "----------------------------------------"
docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}" 2>&1
echo ""

echo "9. Recent Supabase Realtime Logs (last 20 lines)..."
echo "----------------------------------------"
docker logs supabase_realtime_ourchat --tail 20 2>&1
echo ""

echo "=========================================="
echo "Debug Report Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review the output above"
echo "2. Check docs/testing/issue-realtime-channel-error.md for investigation steps"
echo "3. Run specific SQL queries from the investigation guide"
echo ""
