# Integrating Cloudflare D1 with EduMark

This branch (`cloudflare-d1`) contains the initial setup for migrating from Supabase to Cloudflare D1.

## Getting Started

### 1. Create a D1 Database
Run the following command to create your D1 database:
```bash
npx wrangler d1 create edumark-db
```

### 2. Update `wrangler.toml`
Copy the `database_id` from the output of the previous command and paste it into `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "edumark-db"
database_id = "77017dda-125a-48e6-86f1-b155f6eb1157"
```

### 3. Initialize the Schema
Run the following command to apply the schema to your local development database and the remote database:

**Local:**
```bash
npx wrangler d1 execute edumark-db --local --file=./schema.sql
```

**Remote:**
```bash
npx wrangler d1 execute edumark-db --remote --file=./schema.sql
```

### 4. Development
To run the project with Cloudflare Pages Functions locally:
```bash
npx wrangler pages dev --port 3000 --proxy 3000 -- npm run dev
```

This command will:
- Proxy requests to your Vite dev server (`npm run dev`)
- Run Cloudflare Pages Functions (in `/functions`)
- Provide access to the D1 database binding (`DB`)

## Current API Endpoints

- `GET /api/test`: Tests the connection to the D1 database.

## Migration Plan

1.  **Authentication**: Continue using Supabase Auth or migrate to Cloudflare Turnstile/KV/D1 for a custom auth solution.
2.  **Data Fetching**: Replace Supabase client calls with `fetch` calls to the `/api/*` endpoints.
3.  **Functions**: Implement the logic for students, attendance, and logs in the `/functions/api/` directory.
