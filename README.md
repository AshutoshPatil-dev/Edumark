# EduMark

A considered attendance record system for educational institutions.
Track attendance across divisions and lectures, review approvals, generate
academic reports, and monitor student performance - all through a calm,
editorial interface.

## Features

- Role-based access for administrators, faculty, and class coordinators
- Daily attendance capture with edit and approval workflows
- Division, lecture, and subject-level record keeping
- Automated alerts for missed attendance windows
- Academic reports with Excel export
- Secure authentication and session management via Supabase

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Supabase (Auth + Postgres)
- React Router v7
- Recharts, date-fns, lucide-react

## Running locally

**Prerequisites:** Node.js 18 or newer.

1. Install dependencies
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root and set your Supabase
   credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. Start the development server
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`.

## Scripts

- `npm run dev` - start the Vite dev server
- `npm run build` - create a production build
- `npm run preview` - preview the production build
- `npm run lint` - type-check the project with `tsc`

## Project Structure

```
src/
  components/   Reusable UI (navbar, logo, alerts, logs)
  pages/        Route-level screens (dashboard, attendance, admin, etc.)
  lib/          Supabase client
  utils/        Shared helpers
  types.ts      Shared TypeScript types
  constants.ts  Shared constants
```

## License

Proprietary. All rights reserved.
