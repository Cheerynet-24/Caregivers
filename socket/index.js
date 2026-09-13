const jwt = require('jsonwebtoken');

function setupSocket(io, prisma) {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Auth required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'caregivers-secret');
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || user.isBanned) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${socket.user.username}`);

    // Set online
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() }
    });
    socket.broadcast.emit('user:online', { userId });

    // Join personal room
    socket.join(`user:${userId}`);

    // Join all group rooms
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true }
    });
    memberships.forEach(m => socket.join(`group:${m.groupId}`));

    // Private message
    socket.on('message:private', async (data) => {
      try {
        if (socket.user.isMuted) {
          return socket.emit('error', { message: 'You are muted' });
        }
        const { conversationId, content, type = 'text', fileUrl } = data;
        if (!conversationId || (!content && !fileUrl)) return;

        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [{ user1Id: userId }, { user2Id: userId }]
          }
        });
        if (!conversation) return socket.emit('error', { message: 'Conversation not found' });
        const otherUserId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
        const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { allowMessagesFrom: true } });
        if (otherUser?.allowMessagesFrom === 'friends') {
          const friendship = await prisma.friendship.findFirst({ where: { OR: [{ user1Id: userId, user2Id: otherUserId }, { user1Id: otherUserId, user2Id: userId }] } });
          if (!friendship) return socket.emit('error', { message: 'This user accepts messages from friends only' });
        }
        const blocked = await prisma.blockedUser.findFirst({
          where: { OR: [{ blockerId: userId, blockedId: otherUserId }, { blockerId: otherUserId, blockedId: userId }] }
        });
        if (blocked) return socket.emit('error', { message: 'This user is blocked' });

        const msg = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: content || null,
            type,
            fileUrl: fileUrl || null
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatar: true } }
          }
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // Find other user and emit
        const otherId = otherUserId;

        io.to(`user:${otherId}`).emit('message:new', msg);
        socket.emit('message:new', msg);
      } catch (err) {
        console.error('private msg error', err);
      }
    });

    socket.on('message:edit', async ({ messageId, content }) => {
      try {
        if (!messageId || !String(content || '').trim()) return;
        const message = await prisma.message.findFirst({ where: { id: messageId, senderId: userId } });
        if (!message) return socket.emit('error', { message: 'You can only edit your own message' });
        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { content: String(content).trim(), editedAt: new Date() },
          include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } }
        });
        if (message.conversationId) {
          const conversation = await prisma.conversation.findUnique({ where: { id: message.conversationId } });
          const otherId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
          io.to(`user:${otherId}`).emit('message:update', updated);
        } else if (message.groupId) io.to(`group:${message.groupId}`).emit('message:update', updated);
        socket.emit('message:update', updated);
      } catch (err) { console.error('message edit error', err); }
    });

    socket.on('message:delete', async ({ messageId }) => {
      try {
        const message = await prisma.message.findFirst({ where: { id: messageId, senderId: userId } });
        if (!message) return socket.emit('error', { message: 'You can only delete your own message' });
        const deleted = await prisma.message.update({
          where: { id: messageId },
          data: { content: 'This message was deleted', fileUrl: null, type: 'deleted', deletedAt: new Date() }
        });
        if (message.conversationId) {
          const conversation = await prisma.conversation.findUnique({ where: { id: message.conversationId } });
          const otherId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
          io.to(`user:${otherId}`).emit('message:delete', deleted);
        } else if (message.groupId) io.to(`group:${message.groupId}`).emit('message:delete', deleted);
        socket.emit('message:delete', deleted);
      } catch (err) { console.error('message delete error', err); }
    });

    // Group message
    socket.on('message:group', async (data) => {
      try {
        if (socket.user.isMuted) {
          return socket.emit('error', { message: 'You are muted' });
        }
        const { groupId, content, type = 'text', fileUrl } = data;
        if (!groupId || (!content && !fileUrl)) return;

        // Check membership
        const member = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId } }
        });
        if (!member) return;

        const msg = await prisma.message.create({
          data: {
            groupId,
            senderId: userId,
            content: content || null,
            type,
            fileUrl: fileUrl || null
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatar: true } }
          }
        });

        io.to(`group:${groupId}`).emit('message:new', msg);
      } catch (err) {
        console.error('group msg error', err);
      }
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      if (data.conversationId) {
        socket.to(`user:${data.toUserId}`).emit('typing:start', {
          conversationId: data.conversationId,
          userId,
          username: socket.user.username
        });
      }
      if (data.groupId) {
        socket.to(`group:${data.groupId}`).emit('typing:start', {
          groupId: data.groupId,
          userId,
          username: socket.user.username
        });
      }
    });

    socket.on('typing:stop', (data) => {
      if (data.conversationId) {
        socket.to(`user:${data.toUserId}`).emit('typing:stop', {
          conversationId: data.conversationId,
          userId
        });
      }
      if (data.groupId) {
        socket.to(`group:${data.groupId}`).emit('typing:stop', {
          groupId: data.groupId,
          userId
        });
      }
    });

    // WebRTC signaling for 1-1 calls
    socket.on('call:offer', (data) => {
      io.to(`user:${data.toUserId}`).emit('call:offer', {
        fromUserId: userId,
        fromUsername: socket.user.username,
        offer: data.offer,
        callType: data.callType // 'audio' | 'video'
      });
    });

    socket.on('call:answer', (data) => {
      io.to(`user:${data.toUserId}`).emit('call:answer', {
        fromUserId: userId,
        answer: data.answer
      });
    });

    socket.on('call:ice', (data) => {
      io.to(`user:${data.toUserId}`).emit('call:ice', {
        fromUserId: userId,
        candidate: data.candidate
      });
    });

    socket.on('call:end', (data) => {
      io.to(`user:${data.toUserId}`).emit('call:end', { fromUserId: userId });
    });

    // Group call signaling (basic - room based)
    socket.on('group-call:join', (data) => {
      socket.join(`call:${data.groupId}`);
      socket.to(`call:${data.groupId}`).emit('group-call:user-joined', {
        userId,
        username: socket.user.username
      });
    });

    socket.on('group-call:signal', (data) => {
      socket.to(`call:${data.groupId}`).emit('group-call:signal', {
        fromUserId: userId,
        signal: data.signal
      });
    });

    socket.on('group-call:leave', (data) => {
      socket.leave(`call:${data.groupId}`);
      socket.to(`call:${data.groupId}`).emit('group-call:user-left', { userId });
    });

    socket.on('disconnect', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() }
      });
      socket.broadcast.emit('user:offline', { userId });
      console.log(`User disconnected: ${socket.user.username}`);
    });
  });
}

module.exports = setupSocket;
