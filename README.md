# TaskFlow - Modern Team Task Management

A beautiful, real-time task management tool for remote freelance teams.

## Stack
- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Backend**: Node.js + Express + Socket.io
- **Database**: MongoDB
- **Auth**: JWT (access token 15m + refresh token 7d in httpOnly cookie)
- **State**: Zustand
- **Deployment**: Docker + docker-compose

## Features
- Real-time Kanban board with drag-and-drop
- Team management with invite codes
- Live notifications via WebSockets
- Dark / Light / System theme
- Glass morphism UI with smooth animations
- Fully responsive

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- npm

### 1. Install dependencies
```bash
# Root
npm install

# Server
cd server && npm install

# Client
cd client && npm install
```

### 2. Configure environment
```bash
# Copy and edit root .env
cp .env.example .env

# Edit server/.env with your MongoDB URI and JWT secrets
# Edit client/.env with your API URL
```

### 3. Run dev servers
```bash
# From root - starts both client (5173) and server (5000)
npm run dev
```

Open http://localhost:5173

---

## Docker Deployment (Self-hosted)

### 1. Configure production .env
```bash
cp .env.example .env
# Set strong values for MONGO_USER, MONGO_PASS, JWT_SECRET, JWT_REFRESH_SECRET
```

### 2. Build and run
```bash
docker-compose up --build -d
```

App will be available at http://your-server-ip

---

## Project Structure

```
/
├── client/          # React frontend (Vite)
├── server/          # Node.js API + Socket.io
├── docker-compose.yml
└── .env.example
```

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

GET    /api/teams
POST   /api/teams
GET    /api/teams/:id
POST   /api/teams/:id/invite
POST   /api/teams/:id/join

GET    /api/tasks?teamId=...
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/tasks/stats?teamId=...

GET    /api/notifications
PATCH  /api/notifications/read-all
```

## Socket Events

| Event | Direction | Description |
|---|---|---|
| `task:created` | Server → Team Room | New task created |
| `task:updated` | Server → Team Room | Task field changed |
| `task:deleted` | Server → Team Room | Task deleted |
| `task:moved` | Server → Team Room | Kanban DnD move |
| `notification:new` | Server → User Room | Personal notification |

---

## Part 2 Roadmap
- Task comments & threads
- Subtask checklists
- File attachments
- Email notifications
- Due date reminders (cron)
- Full-text search
- Time tracking
