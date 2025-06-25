# Gemini Quotes Backend

This is the backend API for the Gemini Quotes application. It provides endpoints for serving daily AI-generated quotes, managing categories, and more. The backend uses Node.js, Express, and a Postgres database. Quote generation leverages the Google Gemini API.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [Environment Variables](#environment-variables)
- [Database](#database)
- [API Endpoints](#api-endpoints)
- [Seeding](#seeding)
  - [Categories](#categories)
  - [Quotes](#quotes)
- [Production (Render)](#production-render)
- [Scheduled Seeding (GitHub Actions)](#scheduled-seeding-github-actions)
- [Contributing](#contributing)

---

## Features

- REST API for fetching quotes and categories
- Daily quotes generated using the Gemini API (rate-limited)
- Categories and quotes stored in Postgres
- Automatic daily quote seeding via GitHub Actions
- Production-ready server with CORS and JSON parsing

---

## Tech Stack

- Node.js
- Express
- TypeScript
- Postgres
- Drizzle ORM
- Google Gemini API

---

## Getting Started

### Local Development

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd <repo-folder>
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Setup your environment:**
   - Copy `.env.example` to `.env` and fill in the required variables.

4. **Run database migrations (if required):**
   > _Add your migration command here if you use one (e.g. `npx drizzle-kit push`)_ 

5. **Start the backend:**
   ```sh
   npm run dev
   ```

### Environment Variables

Create a `.env` file in the root directory with the following:

```
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
GEMINI_API_KEY=your-gemini-key
PORT=3001
```

---

## Database

- The backend uses a Postgres database.
- Core tables:
  - `categories`: name, description
  - `quotes`: quote, author, category_id, type, date

---

## API Endpoints

### Quotes

- `GET /api/quotes`  
  Returns all quotes (optionally filter by category, date, etc.)

- `GET /api/quotes/:id`  
  Returns a single quote by ID.

- `GET /api/quotes/daily`  
  Returns today's daily quotes for all categories.

### Categories

- `GET /api/categories`  
  Returns all categories.

---

## Seeding

### Categories

- Categories are seeded automatically on first run (unless already present).

### Quotes

- **Daily quotes** are seeded by a separate script (`src/seedQuotes.ts`) and are NOT seeded on production server startup.
- Seeding is handled by a scheduled GitHub Actions workflow.

#### Manual Seeding (local/dev only)

If you want to seed locally:

```sh
npx ts-node src/seedQuotes.ts
```

---

## Production (Render)

- The API server is deployed to Render using a special branch (e.g., `render`).
- The server entry point (`src/index.ts`) **does not run any seeding logic**; it only starts the Express API.
- All seeding is handled by GitHub Actions workflows.

---

## Scheduled Seeding (GitHub Actions)

- GitHub Actions runs `src/seedQuotes.ts` daily via a scheduled workflow (`.github/workflows/daily-quote-cron.yml`).
- This script fetches new quotes using the Gemini API (rate-limited) and inserts them into the database.
- Ensure you have set the `DATABASE_URL` and `GEMINI_API_KEY` secrets in your repository.

Sample workflow snippet:
```yaml
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  run-seeder:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx ts-node src/seedQuotes.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

## Contributing

- Fork this repo and create a pull request for new features or fixes.
- Please open an issue for bug reports or feature requests.

---