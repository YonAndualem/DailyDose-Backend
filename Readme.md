# DailyDose-Backend

A TypeScript-powered backend for the DailyDose application, providing daily inspirational quotes via a RESTful API.

**Live API:** [https://daily-dose-backend.vercel.app](https://daily-dose-backend.vercel.app)

---

## Features

- **TypeScript:** Type-safe, maintainable server code.
- **REST API:** Easily connect with any frontend or mobile app.
- **Daily Quotes:** Serves a unique quote every day.
- **Random Quotes:** Retrieve random or categorized quotes.
- **Vercel Deployment:** Instant cloud deployment and free hosting.
- **(Optional) Authentication:** (Add if you support auth)
- **(Optional) Database Integration:** (Add DB info if applicable)

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

```bash
git clone https://github.com/YonAndualem/DailyDose-Backend.git
cd DailyDose-Backend
npm install
# or
yarn install
```

### Running Locally

```bash
npm run dev
# or
yarn dev
```

The server should start at `http://localhost:3000` by default.

---

## API Endpoints

| Method | Endpoint            | Description                     |
|--------|---------------------|---------------------------------|
| GET    | `/api/quote`        | Get the quote of the day        |
| GET    | `/api/random`       | Get a random quote              |
| GET    | `/api/categories`   | List all available categories   |
| GET    | `/api/quotes/:id`   | Get a quote by ID               |

---

## Deployment

This project is deployed on [Vercel](https://vercel.com/).  
To deploy your own:

1. Push your repo to GitHub.
2. Connect the repo on [vercel.com](https://vercel.com/import).
3. Configure any environment variables.
4. Deploy!

---

## Contributing

Contributions welcome! Please open an issue or pull request.

---


## Author

- [YonAndualem](https://github.com/YonAndualem)
