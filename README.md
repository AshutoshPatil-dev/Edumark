<div align="center">
  <h1>🎓 EduMark</h1>
  <p><strong>A beautifully considered attendance & ERP system for modern educational institutions.</strong></p>
  
  [![React 19](https://img.shields.io/badge/React-19-blue.svg?style=for-the-badge&logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-DB%20&%20Auth-3ECF8E.svg?style=for-the-badge&logo=supabase)](https://supabase.com/)
</div>

<br />

## 📖 Overview

**EduMark** is a high-performance, offline-first attendance powerhouse designed with a completely refreshed modern aesthetic. Track attendance across divisions and lectures, review approvals, generate academic reports, broadcast faculty announcements, and monitor student performance — all through a calm, "Paper & Ink" editorial interface.

## ✨ Key Features

- **📶 Offline-First Sync**: Never lose data again. Mark attendance in dead zones and let the app sync automatically when you're back online.
- **🎨 Premium Atomic UI**: A complete visual overhaul utilizing a standardized atomic design system—crisp, fast, and highly accessible.
- **📢 Faculty Announcements**: Built-in broadcast system allowing administrators and faculty to seamlessly share critical updates.
- **🗓️ Visual Timetable Editor**: Interactive editor for faculty to manage their weekly schedules effortlessly.
- **📱 PWA Ready**: Install EduMark directly on your phone or desktop for a native-app experience.
- **📄 Advanced Reporting**: Filtered attendance records with one-click PDF/Excel exports for administration.
- **🛡️ Enhanced Security**: 15-minute auto-logout with "offline-awareness" to keep data safe without locking you out.

## 🛠️ Tech Stack

- **Frontend Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Atomic Design UI, Motion (Framer Motion)
- **Backend & Auth**: Supabase (PostgreSQL, Row Level Security)
- **Routing**: React Router v7
- **Data Visualization**: Recharts

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18.x or newer
- **npm**
- A **Supabase** project instance

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AshutoshPatil-dev/Edumark.git
   cd Edumark
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` or `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   *The application will now be running on `http://localhost:3000`.*

## 📁 Project Architecture

```text
src/
├── components/   # Atomic UI elements (Buttons, Cards, Inputs, Alerts)
├── pages/        # Route-level screens (Dashboard, Attendance, Admin)
├── lib/          # Supabase client & third-party integrations
├── utils/        # Shared helpers and formatting functions
├── types.ts      # Global TypeScript interfaces and types
└── constants.ts  # System-wide configuration constants
```

## 📜 License

Proprietary. All rights reserved.
