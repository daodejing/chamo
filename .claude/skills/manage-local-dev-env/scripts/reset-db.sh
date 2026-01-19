#!/bin/bash

# Reset local development database and clear MailHog emails
# Usage: ./reset-db.sh [--env dev|test]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/apps/backend"

# Default to dev environment
ENV="dev"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENV="$2"
            shift 2
            ;;
        -y|--yes)
            SKIP_CONFIRM=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--env dev|test] [-y|--yes]"
            echo ""
            echo "Options:"
            echo "  --env dev|test  Environment to reset (default: dev)"
            echo "  -y, --yes       Skip confirmation prompt"
            echo ""
            echo "This script will:"
            echo "  - Drop and recreate the database"
            echo "  - Run all migrations"
            echo "  - Clear all MailHog emails"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set database URL based on environment
if [ "$ENV" = "test" ]; then
    export DATABASE_URL="postgresql://ourchat_test_user:ourchat_test_password@localhost:5433/ourchat_test?schema=public"
    DB_NAME="ourchat_test"
else
    export DATABASE_URL="postgresql://ourchat_user:ourchat_password@localhost:5432/ourchat_dev?schema=public"
    DB_NAME="ourchat_dev"
fi

echo "🗄️  Database Reset Script"
echo "========================"
echo "Environment: $ENV"
echo "Database: $DB_NAME"
echo ""

# Confirm unless -y flag
if [ "$SKIP_CONFIRM" != "true" ]; then
    echo "⚠️  WARNING: This will DELETE ALL DATA in the $DB_NAME database!"
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo "🔄 Resetting database..."
cd "$BACKEND_DIR"
pnpm prisma migrate reset --force --skip-generate

echo ""
echo "🔄 Regenerating Prisma client..."
pnpm prisma generate

echo ""
echo "📧 Clearing MailHog emails..."
curl -s -X DELETE http://localhost:8025/api/v1/messages > /dev/null 2>&1 || echo "   (MailHog not running or no emails to clear)"

echo ""
echo "✅ Reset complete!"
echo "   - Database: $DB_NAME (all migrations applied)"
echo "   - MailHog: cleared"
