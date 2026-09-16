# Caregivers Messenger

Messenger-style chat website with Wallet (Test Coin), Group chat, 1-1 calls signaling, and Admin Panel.

**Website Name:** Caregivers  
**Default Language:** Myanmar (+ English)  
**Admin Password:** `29580284`  
**Wallet:** Test Coin only

---

## Features

- User Register / Login (JWT)
- 1-1 Real-time Chat
- Group Chat (no member limit)
  - Group Admin only can add members
  - Invite Link join
- Search Friend → all registered users → Message / Add Friend
- Friend requests
- Online status + typing (socket ready)
- 1-1 Voice/Video call signaling (WebRTC ready)
- Wallet (Test Coin)
  - Deposit request + Screenshot upload
  - Withdraw request (Account Name, Phone, QR optional)
- Admin Panel (`/admin`)
  - User list, Ban / Unban, Mute / Unmute
  - Approve / Reject Deposit & Withdraw
  - Set Bank/Wallet payment info
  - Manually add/remove coins
- Bilingual UI (Myanmar / English)
- Dark mode
- Favicon = provided character image

---

## Project Structure

```
caregivers/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── index.js
│   │   ├── middleware/auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── chat.js
│   │   │   ├── groups.js
│   │   │   ├── wallet.js
│   │   │   └── admin.js
│   │   ├── socket/index.js
│   │   └── utils/helpers.js
│   ├── uploads/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/favicon.jpg
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── i18n/ (my.json, en.json)
│   │   ├── context/AuthContext.jsx
│   │   ├── services/api.js
│   │   └── pages/ (Login, Register, Home, Admin)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
└── README.md
```

---

## Local Development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL to your PostgreSQL connection string
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Backend runs on http://localhost:4000

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

### Admin Panel

Open http://localhost:5173/admin  
Password: **29580284**

---

## Railway Deploy

1. Push this folder to a GitHub repository
2. Create a new project on [Railway](https://railway.app)
3. Add **PostgreSQL** plugin → copy `DATABASE_URL`
4. **Backend service**
   - Root Directory: `backend`
   - Start Command: `npx prisma generate && npx prisma db push && node src/index.js`
   - Environment Variables:
     ```
     DATABASE_URL=<from postgres plugin>
     JWT_SECRET=<random long string>
     ADMIN_PASSWORD=29580284
     CLIENT_URL=https://your-frontend.up.railway.app
     FIREBASE_PROJECT_ID=<Firebase project id>
     FIREBASE_CLIENT_EMAIL=<Firebase service-account client email>
     FIREBASE_PRIVATE_KEY=<Firebase service-account private key>
     FIREBASE_STORAGE_BUCKET=<Firebase Storage bucket name>
     PORT=4000
     ```
5. **Frontend service**
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npx vite preview --host 0.0.0.0 --port $PORT`
   - Environment Variables:
     ```
     VITE_API_URL=https://your-backend.up.railway.app
     ```
6. After deploy, open the frontend URL and register a user.

### Persistent media storage

Chat attachments, stickers, and post photos/videos are uploaded to Firebase Storage when the four `FIREBASE_*` variables above are configured. This is required on Railway or any other platform with an ephemeral filesystem; otherwise the app intentionally falls back to the local `uploads/` directory for development and self-hosted deployments.

---

## Important Notes

- This is a **demo / educational** project.
- Real money is **not** automatically processed.
- Admin must manually approve deposits and transfer money for withdrawals.
- Change `JWT_SECRET` and `ADMIN_PASSWORD` in production.
- Video/Audio calls have signaling ready; full WebRTC UI can be extended later.

---

Made for **Caregivers**
