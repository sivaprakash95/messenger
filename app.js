const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Initialize Express and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB Connection
mongoose.connect('mongodb://localhost/messenger', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Import models
const User = require('./models/user');
const Message = require('./models/message');

// Render login page
app.get('/', (req, res) => {
  res.render('index');
});

// Handle user login or registration
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  let user = await User.findOne({ username });
  if (!user) {
    // If the user doesn't exist, register them
    const hashedPassword = bcrypt.hashSync(password, 10);
    user = new User({ username, password: hashedPassword });
    await user.save();
  } else if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).send('Invalid credentials');
  }

  const token = jwt.sign({ userId: user._id }, 'secret', { expiresIn: '1h' });
  res.redirect(`/chat?token=${token}`);
});

// Chat page
app.get('/chat', async (req, res) => {
  const token = req.query.token;
  const decoded = jwt.verify(token, 'secret');

  const user = await User.findById(decoded.userId);
  const messages = await Message.find().sort({ timestamp: 1 });
  res.render('chat', { username: user.username, messages });
});

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('chat message', async (msgData) => {
    const { username, message } = msgData;
    const messageObj = new Message({ sender: username, message });
    await messageObj.save();

    io.emit('chat message', { username, message });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
