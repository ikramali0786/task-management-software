# TaskFlow — Deployment Guide
## Render (Frontend + Backend) + MongoDB Atlas (Database)

> **Estimated time:** 20–30 minutes
> **Cost:** $0 — all free tiers, no credit card needed for Atlas

---

## Overview

```
Your Team's Browser
       │
       ▼
┌─────────────────────────────┐
│   Render Static Site        │  ← React app (taskflow-client)
│   taskflow-client.onrender  │    Free tier, global CDN
└──────────┬──────────────────┘
           │ HTTPS API calls + WebSocket
           ▼
┌─────────────────────────────┐
│   Render Web Service        │  ← Node.js + Socket.io (taskflow-server)
│   taskflow-server.onrender  │    Free tier, 512MB RAM
└──────────┬──────────────────┘
           │ mongoose connection
           ▼
┌─────────────────────────────┐
│   MongoDB Atlas M0          │  ← Free cluster, 512MB storage
│   cluster.mongodb.net       │    Automatic backups
└─────────────────────────────┘
```

---

## Prerequisites

You need two things installed before starting:

### 1. Git
```bash
# Check if installed:
git --version

# If not installed on macOS, run:
xcode-select --install
# Or download from: https://git-scm.com/download/mac
```

### 2. Node.js (for running npm install)
Download from: **https://nodejs.org** → LTS version → macOS (ARM64 for Apple Silicon M1/M2/M3)

```bash
# Verify after install:
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

---

## PART 1 — Install Dependencies Locally

Once Node.js is installed, open Terminal and run:

```bash
# Navigate to project
cd "/Users/ikramali/Documents/Task Management Software"

# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

---

## PART 2 — Push to GitHub

GitHub is the bridge between your code and Render.

### Step 1: Create GitHub Account
Go to **https://github.com** and sign up (free).

### Step 2: Create a New Repository
1. Click the **+** icon (top right) → **New repository**
2. Repository name: `taskflow`
3. Visibility: **Private** (recommended) or Public
4. **Do NOT** check "Initialize with README" (we'll push existing code)
5. Click **Create repository**
6. Copy the repo URL shown — looks like: `https://github.com/YOUR_USERNAME/taskflow.git`

### Step 3: Push Your Code
Run these commands in Terminal from your project folder:

```bash
cd "/Users/ikramali/Documents/Task Management Software"

# Initialize git
git init

# Stage all files (note: .env files are already in .gitignore — safe)
git add .

# First commit
git commit -m "feat: TaskFlow MVP - full-stack task management app"

# Connect to GitHub (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/taskflow.git

# Push to GitHub
git branch -M main
git push -u origin main
```

> **Tip:** GitHub will ask for your username and password the first time.
> For the password, use a **Personal Access Token** (not your account password):
> GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate new token
> Check: `repo` scope → Generate → copy the token → use as password

---

## PART 3 — MongoDB Atlas Setup

### Step 1: Create Account
Go to **https://www.mongodb.com/atlas** → Sign Up → Use Google or email
Choose: **"I'm learning MongoDB"** (gets you free tier)

### Step 2: Create a Free Cluster
1. Click **"Build a Database"**
2. Choose **M0 FREE** (make sure it says "Free forever")
3. Provider: **AWS**
4. Region: Choose the one closest to you (e.g., `us-east-1` for USA)
5. Cluster name: `Cluster0` (default is fine)
6. Click **Create**

### Step 3: Create a Database User
When the "Security Quickstart" appears:
1. **Authentication:** Username and Password
2. Username: `taskflow_admin`
3. Password: Click "Autogenerate Secure Password" → **COPY THIS PASSWORD** (you won't see it again)
4. Click **Create User**

### Step 4: Allow Network Access
Still in the Quickstart:
1. **Where would you like to connect from?** → Choose **"My Local Environment"**
2. In the IP Address field, type: `0.0.0.0/0`
   - This allows Render's servers to connect (Render uses dynamic IPs)
3. Description: `Allow all (Render deployment)`
4. Click **Add Entry** → **Finish and Close**

### Step 5: Get Your Connection String
1. Click **Connect** on your cluster
2. Choose **"Drivers"**
3. Driver: **Node.js**, Version: **5.5 or later**
4. Copy the connection string — it looks like:
   ```
   mongodb+srv://taskflow_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Edit the string:**
   - Replace `<password>` with your actual password
   - Add the database name before the `?`:
   ```
   mongodb+srv://taskflow_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/taskflow?retryWrites=true&w=majority
   ```
6. **Save this string** — you'll paste it into Render next

---

## PART 4 — Deploy Backend on Render

### Step 1: Create Render Account
Go to **https://render.com** → Sign up with GitHub (easiest)

### Step 2: Create the Backend Web Service
1. From Dashboard → click **"New +"** → **"Web Service"**
2. **Connect Repository** → Select your `taskflow` repo
   - If you don't see it, click "Configure GitHub App" and grant access
3. Fill in the settings:

| Setting | Value |
|---|---|
| **Name** | `taskflow-server` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/server.js` |
| **Plan** | `Free` |

### Step 3: Add Environment Variables
Scroll down to **"Environment Variables"** and add these one by one:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `MONGODB_URI` | `mongodb+srv://taskflow_admin:...` | Paste your Atlas connection string |
| `JWT_SECRET` | *(generate below)* | Random 64-char string |
| `JWT_REFRESH_SECRET` | *(generate below)* | Another random 64-char string |
| `JWT_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `CLIENT_URL` | *(leave blank for now)* | Fill after frontend deploys |

**To generate JWT secrets**, run this in Terminal:
```bash
# Run twice to get two different secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Deploy
Click **"Create Web Service"** → Render starts building.

Watch the logs — a successful deploy ends with:
```
🚀 TaskFlow server running on port 10000
   Mode: production
```

### Step 5: Copy Your Backend URL
At the top of the service page you'll see the URL:
```
https://taskflow-server-xxxx.onrender.com
```
**Copy this — you'll need it for the frontend.**

---

## PART 5 — Deploy Frontend on Render

### Step 1: Create Static Site
1. Render Dashboard → **"New +"** → **"Static Site"**
2. Connect the same `taskflow` repo
3. Fill in settings:

| Setting | Value |
|---|---|
| **Name** | `taskflow-client` |
| **Branch** | `main` |
| **Root Directory** | `client` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### Step 2: Add Environment Variables
Add these two variables (replace the URL with your actual backend URL from Part 4):

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://taskflow-server-xxxx.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://taskflow-server-xxxx.onrender.com` |

> **Important:** These `VITE_*` variables are baked into the React build at compile time.
> If you change them, you must trigger a new deploy for changes to take effect.

### Step 3: Deploy
Click **"Create Static Site"** → Render builds and deploys.

A successful deploy shows your frontend URL:
```
https://taskflow-client-xxxx.onrender.com
```
**Copy this URL.**

---

## PART 6 — Wire Everything Together (CORS Fix)

This is the most important step — without it, the frontend can't talk to the backend.

### Step 1: Update Backend CLIENT_URL
1. Go to Render → your `taskflow-server` service
2. Click **"Environment"** tab
3. Find `CLIENT_URL` → click **Edit**
4. Set value to your frontend URL:
   ```
   https://taskflow-client-xxxx.onrender.com
   ```
5. Click **Save Changes**
6. Render automatically redeploys the backend — wait ~2 minutes

### Step 2: Verify Backend Health
Open in browser:
```
https://taskflow-server-xxxx.onrender.com/health
```
Should return:
```json
{ "status": "ok", "timestamp": "2026-03-04T..." }
```

---

## PART 7 — Test Your Deployment

### Basic Test
1. Open `https://taskflow-client-xxxx.onrender.com`
2. You should see the TaskFlow login page
3. Click **"Create one"** → Register with your email
4. You should be redirected to the dashboard

### Real-time Test
1. Open the app in **Window 1** (regular browser) — log in as User A
2. Create a team → click **"Generate Invite Code"** → copy the code
3. Open the app in **Window 2** (incognito/private) → register as User B
4. Join the team with the invite code
5. In Window 1: Go to **Kanban Board** → Add a task
6. **In Window 2 — the task should appear instantly** (real-time Socket.io!)
7. Drag the task to "In Progress" in Window 1 → it moves in Window 2 too
8. Window 2 should show a notification bell badge

### Database Verification
1. Go to MongoDB Atlas → your cluster
2. Click **"Browse Collections"**
3. You should see the `taskflow` database with:
   - `users` collection — your registered users
   - `teams` collection — teams you created
   - `tasks` collection — tasks you added
   - `notifications` collection — notifications generated

---

## Sharing With Your Team

Once deployed, share:
- **App URL:** `https://taskflow-client-xxxx.onrender.com`
- **How to join:** Register → you (admin) generate invite code → share code → they join your team

---

## Troubleshooting

### "Failed to fetch" / API errors
- Check that `VITE_API_URL` in frontend matches your backend URL exactly (no trailing slash)
- Check browser console → Network tab → look for 4xx/5xx errors
- Check Render backend logs for error messages

### "CORS error" in browser console
- Make sure `CLIENT_URL` in backend env vars matches your frontend URL exactly
- After updating `CLIENT_URL`, wait for backend to redeploy (watch the logs)

### Socket.io not connecting / real-time not working
- Check browser console for WebSocket errors
- Make sure `VITE_SOCKET_URL` points to your backend (not ending in `/api`)
- Render free tier supports WebSockets natively — no extra config needed

### "Service unavailable" (backend sleeping)
- Free Render services sleep after 15 minutes of inactivity
- First request after sleep takes 30–60 seconds to wake up
- The app will auto-wake — just wait and refresh
- This is normal on the free tier

### MongoDB connection error in backend logs
- Verify `MONGODB_URI` is correct (no `<password>` placeholder left)
- Verify the Atlas Network Access allows `0.0.0.0/0`
- Check that the database name `taskflow` is in the connection string

### Build fails on Render
- Check Render build logs for the specific error
- Common: missing dependency → check `server/package.json` and `client/package.json`
- TypeScript errors → fix locally first (`cd server && npm run build`)

---

## Updating Your App Later

When you make code changes:
```bash
cd "/Users/ikramali/Documents/Task Management Software"
git add .
git commit -m "fix: description of what you changed"
git push
```
Render auto-detects the push and redeploys both services automatically.

---

## Quick Reference

| Service | URL Pattern |
|---|---|
| Your App | `https://taskflow-client-xxxx.onrender.com` |
| Backend API | `https://taskflow-server-xxxx.onrender.com/api` |
| Backend Health | `https://taskflow-server-xxxx.onrender.com/health` |
| Atlas Dashboard | `https://cloud.mongodb.com` |
| Render Dashboard | `https://dashboard.render.com` |

| Environment Variable | Where Set | Value |
|---|---|---|
| `MONGODB_URI` | Render backend | Atlas connection string |
| `JWT_SECRET` | Render backend | Random 64-char hex |
| `JWT_REFRESH_SECRET` | Render backend | Random 64-char hex |
| `CLIENT_URL` | Render backend | Frontend Render URL |
| `VITE_API_URL` | Render frontend | `{backend_url}/api` |
| `VITE_SOCKET_URL` | Render frontend | `{backend_url}` |
