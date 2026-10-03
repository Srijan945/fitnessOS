# FitOS — Your Personal Fitness Operating System

FitOS is a modern, modular monolith web application designed to act as your personal fitness operating system. It features tracking for nutrition, workouts, progress, and body measurements, along with AI-driven insights to help you reach your goals.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database / Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [Lucide Icons](https://lucide.dev/)

## Getting Started

Follow these steps to set up the project locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Local Database (Supabase)
Ensure you have Docker running on your machine, then run:
```bash
npx supabase start
```
*This command initializes local Supabase containers (database, auth, API, studio) and applies any existing migrations.*

### 3. Environment Variables
Create a `.env.local` file in the root directory and add the credentials provided by the `supabase start` command:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the Development Server
```bash
npm run dev
```

### 5. Access the App
- Open your browser and navigate to [http://localhost:3000](http://localhost:3000).
- You can also access the local Supabase Studio to view your database at [http://127.0.0.1:54323](http://127.0.0.1:54323).
