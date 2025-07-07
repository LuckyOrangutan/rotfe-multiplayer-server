# RotFE Multiplayer Server

This is the Socket.io multiplayer server for the RotFE (Rise of the Fallen Empire) game.

## Local Development

1. Install dependencies:
```bash
cd server
npm install
```

2. Run the server:
```bash
npm start
```

The server will start on port 3001 by default.

## Deployment to Railway

### Step 1: Push to GitHub

First, make sure your entire project (including the server folder) is pushed to GitHub:

```bash
git add .
git commit -m "Add Socket.io multiplayer server"
git push origin main
```

### Step 2: Deploy on Railway

1. Go to [Railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your RotFE repository
5. Railway will detect the server folder

### Step 3: Configure Railway

1. In the Railway dashboard, click on your service
2. Go to "Settings" tab
3. Under "Service", set:
   - **Root Directory**: `/server`
   - **Start Command**: `npm start`
   
4. Go to "Variables" tab and add:
   - `PORT`: Railway will set this automatically

### Step 4: Generate Domain

1. In the "Settings" tab
2. Under "Networking", click "Generate Domain"
3. Copy the generated URL (e.g., `https://rotfe-server.up.railway.app`)

### Step 5: Update Your Frontend

1. Update your `.env.local` file:
```env
VITE_SOCKET_SERVER_URL="https://your-app-name.up.railway.app"
```

2. Commit and deploy your frontend to Vercel

## Environment Variables

The server uses the following environment variables:

- `PORT`: The port to run the server on (Railway sets this automatically)

## Testing

To test if the server is running, visit the root URL in your browser. You should see:

```json
{
  "status": "ok",
  "lobbies": 0,
  "players": 0
}
```

## Monitoring

Railway provides:
- Automatic HTTPS
- Logs (accessible in the dashboard)
- Metrics (CPU, Memory usage)
- Automatic restarts on crashes

## Costs

- Railway's hobby plan is $5/month
- Includes 500 hours of runtime (more than enough for a game server)
- Automatic sleep after 10 minutes of inactivity
