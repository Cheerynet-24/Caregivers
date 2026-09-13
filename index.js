const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads folder setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Routes
try { app.use('/api/auth', require('./routes/auth')); } catch (e) { console.log("Auth route error:", e.message); }
try { app.use('/api/users', require('./routes/users')); } catch (e) { console.log("Users route error:", e.message); }
try { app.use('/api/chat', require('./routes/chat')); } catch (e) { console.log("Chat route error:", e.message); }
try { app.use('/api/groups', require('./routes/groups')); } catch (e) { console.log("Groups route error:", e.message); }
try { app.use('/api/wallet', require('./routes/wallet')); } catch (e) { console.log("Wallet route error:", e.message); }
try { app.use('/api/admin', require('./routes/admin')); } catch (e) { console.log("Admin route error:", e.message); }

// Socket.io Setup
try {
  const registerSocketHandlers = require('./socket');
  registerSocketHandlers(io);
} catch (e) {
  console.log("Socket handler loaded separately or not found.");
}

// Frontend static files & SPA fallback
const frontendDist = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Server is running, but frontend build is missing.');
  });
}

// Server Listen with 0.0.0.0 for Railway
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});

