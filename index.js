const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

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

// API Routes
try { app.use('/api/auth', require('./routes/auth')); } catch (e) { console.log("Error loading auth route:", e.message); }
try { app.use('/api/users', require('./routes/users')); } catch (e) { console.log("Error loading users route:", e.message); }
try { app.use('/api/chat', require('./routes/chat')); } catch (e) { console.log("Error loading chat route:", e.message); }
try { app.use('/api/groups', require('./routes/groups')); } catch (e) { console.log("Error loading groups route:", e.message); }
try { app.use('/api/wallet', require('./routes/wallet')); } catch (e) { console.log("Error loading wallet route:", e.message); }
try { app.use('/api/admin', require('./routes/admin')); } catch (e) { console.log("Error loading admin route:", e.message); }

// Socket.io Setup
try {
  const registerSocketHandlers = require('./socket');
  registerSocketHandlers(io);
} catch (e) {
  console.log("Socket handler loaded separately or not found.");
}

// Frontend (React Build) ဖိုင်များကို ချိတ်ဆက်ပေးခြင်း (Root မှ frontend/dist သို့ ညွှန်းထားသည်)
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// React Router / Admin Panel တွေအတွက် SPA Fallback Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Server စတင်လည်ပတ်ခြင်း
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

