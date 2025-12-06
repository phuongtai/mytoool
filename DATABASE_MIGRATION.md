# Database Migration Guide

## Setup Instructions

### 1. Create Database Tables

Go to your Supabase Dashboard → SQL Editor and run the SQL from `api/schema.sql`:

```bash
# Or copy the content from api/schema.sql and paste it in Supabase SQL Editor
```

This will create:
- `topics` table - stores topic names and descriptions
- `steps` table - stores learning steps for each topic
- `items` table - stores words, phrases, and sentences

### 2. Migrate Data from JSON to Database

Run the migration script to import your existing topics.json data:

```bash
node api/migrate-topics.js
```

This will:
- Read `src/data/topics.json`
- Insert all topics, steps, and items into Supabase
- Preserve the order and relationships

### 3. Verify Migration

Check your Supabase dashboard to confirm:
- Topics table has all your topics
- Steps table has all learning steps
- Items table has all words, phrases, and sentences

### 4. Test the API

The frontend now fetches topics from `/api/topics` instead of the JSON file.

Start your dev server and verify topics load correctly:

```bash
yarn dev
```

## Database Schema

### Topics Table
- `id` (UUID) - Primary key
- `name` (TEXT) - Topic name (unique)
- `description` (TEXT) - Topic description
- `order_index` (INTEGER) - Display order

### Steps Table
- `id` (UUID) - Primary key
- `topic_id` (UUID) - Foreign key to topics
- `step_number` (INTEGER) - Step number within topic
- `order_index` (INTEGER) - Display order

### Items Table
- `id` (UUID) - Primary key
- `step_id` (UUID) - Foreign key to steps
- `type` (TEXT) - 'word', 'phrase', or 'sentence'
- `english` (TEXT) - English text
- `vietnamese` (TEXT) - Vietnamese translation
- `order_index` (INTEGER) - Display order

## Benefits

✅ **Centralized Data** - Topics stored in database, not static JSON
✅ **Easy Updates** - Modify topics via Supabase dashboard
✅ **Scalable** - Add new topics without redeploying
✅ **Multi-user** - Same data across all users
✅ **Future Features** - Can add user progress tracking, favorites, etc.
