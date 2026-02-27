# Bobsled Leaderboard Worker

Cloudflare Worker backend for the global bobsled leaderboard, using R2 for storage.

## Setup

1. Install dependencies:
   ```bash
   cd worker
   npm install
   ```

2. Create the R2 bucket:
   ```bash
   npx wrangler r2 bucket create bobsled-leaderboard
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

## API

### `GET /api/leaderboard/:trackId`
Returns the top 50 times for a track (`alpine`, `glacier`, `inferno`).

### `POST /api/leaderboard/:trackId`
Submit a new score. Body:
```json
{
  "name": "ABC",
  "time": 42.123,
  "topSpeed": 28.5
}
```

### `GET /api/health`
Health check endpoint.

## Configuration

Set `CORS_ORIGIN` in `wrangler.toml` to your frontend domain in production.
