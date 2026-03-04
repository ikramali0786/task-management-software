# TaskFlow - Setup Instructions

## Step 1: Install Node.js (Required)

Node.js is not installed on this machine. Install it first:

### Option A: Download from nodejs.org (Recommended)
1. Go to https://nodejs.org
2. Download the LTS version (v20+) for macOS (ARM64 for Apple Silicon)
3. Run the installer

### Option B: Install via Homebrew
```bash
# Install Homebrew first (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Node
brew install node@20
```

### Option C: Install via NVM (Node Version Manager)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc  # or ~/.bashrc
nvm install 20
nvm use 20
```

---

## Step 2: Install MongoDB (for local dev without Docker)

### Option A: MongoDB Community via Homebrew
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

### Option B: Use MongoDB Atlas (Cloud - Free Tier)
1. Go to https://www.mongodb.com/atlas
2. Create a free cluster
3. Get your connection string
4. Set it in `server/.env` as MONGODB_URI

### Option C: Use Docker just for MongoDB
```bash
docker run -d --name taskflow-mongo -p 27017:27017 mongo:7.0
```

---

## Step 3: Install Dependencies

Once Node.js is installed, run from the project root:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

---

## Step 4: Configure Environment

```bash
# Edit server/.env
MONGODB_URI=mongodb://localhost:27017/taskflow  # or your Atlas URI
JWT_SECRET=generate_a_strong_64_char_secret_here
JWT_REFRESH_SECRET=another_strong_64_char_secret_here
CLIENT_URL=http://localhost:5173

# Edit client/.env (already set for local dev)
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 5: Start Development Servers

```bash
# From the project root - starts both simultaneously
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health check**: http://localhost:5000/health

---

## Docker Deployment (Production)

If you have Docker and Docker Compose installed:

```bash
# 1. Copy and edit the root .env
cp .env.example .env
# Edit .env with your settings

# 2. Build and start all services
docker-compose up --build -d

# 3. View logs
docker-compose logs -f

# 4. Stop
docker-compose down
```

The app will be at http://localhost (port 80)

---

## Verifying Everything Works

1. Open http://localhost:5173
2. Register a new account
3. Create a team
4. Open a second browser window / incognito
5. Register another account, join team with invite code
6. Create a task in Window 1 → it appears in Window 2 in real-time!
7. Drag tasks between columns → both windows update simultaneously
8. Window 2 receives notification badge
