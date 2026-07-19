# ☁️ LinkSphere Cloud Deployment Guide (Free Tier, No Credit Card Required)

This guide provides step-by-step instructions to deploy the entire LinkSphere stack (Frontend, Backend, MongoDB, Redis) to the cloud using industry-standard platforms. All chosen providers offer excellent free tiers that **do not require a credit card** to set up.

---

## 🏗️ Architecture Overview in Production

In production, the architecture adapts slightly from the local docker-compose configuration to utilize fully managed serverless and PaaS components, maximizing uptime and simplifying deployment:

```mermaid
graph TD
    Client[Vite + React Frontend] -->|Vercel Edge Proxy| API_Proxy{Vercel Rewrite Rules}
    API_Proxy -->|Serve Static Files / SPA Routes| Client
    API_Proxy -->|Proxy Pass API & Redirections| Backend[Render Node.js API]
    Backend -->|Read/Write Persistent Data| MongoDB[(MongoDB Atlas Cloud)]
    Backend -->|Cache Redirects & Rate Limits| Redis[(Upstash Serverless Redis)]
```

---

## 🛠️ Step 1: Managed Databases Setup

### 🍃 A. MongoDB Atlas (Database Layer)
MongoDB Atlas is a fully managed cloud database service. The **M0 Shared Tier** is free forever and provides 512 MB of storage, which is more than enough for thousands of links and analytics entries.

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and register a free account.
2. Create a new project named `LinkSphere` and click **Create a Database**.
3. Choose the **M0 Free** deployment tier. Select your preferred Cloud Provider (e.g., AWS) and region close to you.
4. Set up security:
   - **Database User**: Create a user with a secure password (e.g., `linksphere_user`). Store the password safely.
   - **IP Access List**: Since Render's free tier uses dynamic outgoing IP addresses, add `0.0.0.0/0` (Allow Access From Anywhere) to your database access list.
5. In the database dashboard, click **Connect** -> **Drivers** -> **Node.js**.
6. Copy the connection string. It will look like this:
   ```text
   mongodb+srv://linksphere_user:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
7. Replace `<password>` with your database user's actual password.

---

### 🔴 B. Upstash Redis (Caching & Rate-Limiting Layer)
Upstash provides serverless Redis with a free tier of **10,000 commands per day**, requiring no credit card.

1. Go to [Upstash](https://console.upstash.com/) and log in using your GitHub or Google account.
2. Click **Create Database**.
3. Set the database name to `linksphere-cache`, choose a region closest to your server deployment, and click **Create**.
4. Scroll down to the **Node.js Redis Client** / **Endpoint** section.
5. Copy the **Redis URL**. It will look like:
   ```text
   redis://default:your_upstash_token_here@your-db-name.upstash.io:6379
   ```
6. **Important for SSL (TLS)**: Because Upstash uses TLS in production, prefix the URL with `rediss://` (double 's') instead of `redis://` to ensure connection security:
   ```text
   rediss://default:your_upstash_token_here@your-db-name.upstash.io:6379
   ```

---

## 💻 Step 2: Backend Deployment (Render)

Render is a unified platform to host web apps. The free tier will spin down the backend service after 15 minutes of inactivity, but it will automatically wake up (taking ~50 seconds) when a new request is received.

1. Go to [Render](https://dashboard.render.com/) and register using your GitHub account.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository containing the `LinkSphere` codebase.
4. Configure the Web Service settings:
   - **Name**: `linksphere-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Instance Type**: `Free`
5. Click **Advanced** and add the following **Environment Variables**:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `5000` | The port the backend listens on |
| `MONGODB_URI` | `mongodb+srv://linksphere_user:...` | Your MongoDB Atlas connection string |
| `REDIS_URL` | `rediss://default:...` | Your Upstash Redis connection string |
| `JWT_SECRET` | `generate-a-long-random-string-here` | Key to sign access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | `generate-another-long-random-string-here` | Key to sign refresh tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | `15m` | Access token lifespan |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifespan |
| `FRONTEND_URL` | `https://your-frontend-app.vercel.app` | URL of your Vercel frontend (allow CORS) |

> [!TIP]
> If you have a custom SMTP email server (like Mailtrap, SendGrid, or Gmail App Password) for email verification and password resets, you can also add:
> - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM`.

6. Click **Create Web Service**. Wait for the build to finish. Once done, copy the URL of your Web Service (e.g., `https://linksphere-api.onrender.com`).

---

## 🎨 Step 3: Frontend Deployment (Vercel)

Vercel is the premier hosting provider for front-end frameworks. The Hobby tier is free, fast, and does not require credit card verification.

### A. Configure Proxy Routing in Codebase
Before deploying, you must tell the frontend where to route backend API requests. We handle this dynamically using Vercel's Edge Router rules.

1. Open [vercel.json](file:///d:/LinkSphere/client/vercel.json) in your code editor.
2. Replace the placeholder URLs (`https://linksphere-api.onrender.com`) with your actual Render API service URL copied from Step 2:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://your-actual-render-url.onrender.com/api/v1/:path*"
    },
    {
      "source": "/health",
      "destination": "https://your-actual-render-url.onrender.com/health"
    },
    {
      "source": "/(login|register|dashboard|settings|profile|p/[a-zA-Z0-9_-]+)",
      "destination": "/index.html"
    },
    {
      "source": "/:shortCode([a-zA-Z0-9_-]{4,15})",
      "destination": "https://your-actual-render-url.onrender.com/:shortCode"
    },
    {
      "source": "/((?!assets|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*\\..*)",
      "destination": "/index.html"
    }
  ]
}
```

3. Commit and push this change to your GitHub repository.

### B. Deploy on Vercel
1. Go to [Vercel](https://vercel.com/signup) and sign up using your GitHub account.
2. Click **Add New** -> **Project**.
3. Import your `LinkSphere` repository.
4. Configure the Vercel project settings:
   - **Framework Preset**: Choose **Vite** (detected automatically).
   - **Root Directory**: Click Edit, select the `client` folder, and click **Continue**.
   - **Build and Output Settings**: Defaults are correct (`npm run build` and `dist` output directory).
5. Click **Deploy**. Vercel will build the frontend assets and host it.
6. Once deployed, copy your Vercel URL (e.g., `https://linksphere.vercel.app`).

### C. Complete the CORS Configuration Loop
To allow your frontend client to communicate with your backend without CORS blocks:
1. Go back to your **Render Dashboard** for the backend service (`linksphere-api`).
2. Navigate to **Environment**.
3. Update the `FRONTEND_URL` environment variable value to match your actual Vercel URL: `https://your-app-name.vercel.app` (do not add a trailing slash).
4. Save the environment changes. Render will automatically redeploy the service with the updated CORS rule.

---

## 🚦 Verification Checklist

Once the services are deployed, perform the following verification steps:

1. **Verify Client SPA Routing**: Navigate to your Vercel URL. You should see the sleek LinkSphere authentication page. Try refreshing the page while on `/login` or `/register` to verify Vercel's rewrite rules route to the SPA correctly.
2. **Account Registration**: Create a new account. If SMTP is configured, verify you receive an activation mail. Otherwise, you can check MongoDB Atlas collections to ensure the user is added.
3. **URL Shortening**: Shorten a long link (e.g., `https://google.com`).
4. **Caching Verification**: Click the generated short URL (e.g., `https://your-app.vercel.app/abcd`). You should be instantly redirected. Click it a second time; the redirection should feel faster as the endpoint metadata is now cached in Upstash Redis.
5. **Analytics Verification**: Go to your dashboard and verify the click count increases, and geo-location/browser graphs are updated.
