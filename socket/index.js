const jwt = require('jsonwebtoken');
const { sendPush } = require('../utils/firebase');
const groupCallHosts = new Map();

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
        const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { allowMessagesFrom: true, fcmToken: true } });
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
            fileUrl: fileUrl || null,
            messageStatus: 'sent'
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
        const delivered = await prisma.message.update({
          where: { id: msg.id },
          data: { messageStatus: 'delivered' },
          include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } }
        });
        io.to(`user:${userId}`).emit('message:update', delivered);
        sendPush(otherUser.fcmToken, {
          title: socket.user.displayName || socket.user.username || 'New message',
          body: content || (type === 'audio' ? 'Voice message' : 'Attachment'),
          type: 'message',
          data: { fromUserId: userId, conversationId }
        });
        socket.emit('message:new', delivered);
      } catch (err) {
        console.error('private msg error', err);
      }
    });

    socket.on('message:seen', async ({ messageId }) => {
      if (!messageId) return;
      try {
        const message = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true, senderId: true, conversationId: true, groupId: true } });
        if (!message || message.senderId === userId) return;
        const updated = await prisma.message.update({ where: { id: messageId }, data: { messageStatus: 'seen', seenAt: new Date() }, select: { id: true, messageStatus: true, seenAt: true } });
        io.to(`user:${message.senderId}`).emit('message:update', updated);
      } catch (err) { console.error('message seen error', err); }
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
        await prisma.message.delete({ where: { id: messageId } });
        const deleted = { id: messageId };
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
            fileUrl: fileUrl || null,
            messageStatus: 'sent'
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatar: true } }
          }
        });

        io.to(`group:${groupId}`).emit('message:new', msg);
        const [group, members] = await Promise.all([
          prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
          prisma.groupMember.findMany({ where: { groupId, userId: { not: userId } }, select: { userId: true, user: { select: { fcmToken: true } } } })
        ]);
        const senderName = socket.user.displayName || socket.user.username || 'Someone';
        const messageBody = content || (type === 'audio' ? 'Voice message' : 'Attachment');
        for (const recipient of members) {
          sendPush(recipient.user?.fcmToken, {
            title: `${senderName} · ${group?.name || 'Group'}`,
            body: messageBody,
            type: 'message',
            data: { fromUserId: userId, groupId }
          }).catch(error => console.error('group message push error', error));
        }
        await prisma.message.update({ where: { id: msg.id }, data: { messageStatus: 'delivered' } });
        socket.emit('message:update', { id: msg.id, messageStatus: 'delivered' });
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
    socket.on('call:offer', async (data, acknowledge) => {
      try {
        const receiverId = data?.toUserId;
        const callType = data?.callType === 'video' ? 'video' : 'audio';
        if (!receiverId || receiverId === userId || !data?.offer) return acknowledge?.({ ok: false });
        const activeCall = await prisma.callLog.findFirst({ where: { status: 'answered', OR: [{ callerId: receiverId }, { receiverId }] }, select: { id: true } });
        if (activeCall) return acknowledge?.({ ok: false, busy: true, error: 'The person is already on another call' });
        const call = await prisma.callLog.create({ data: { callerId: userId, receiverId, callType, status: 'ringing' } });
        const conversation = await prisma.conversation.findFirst({ where: { isGroup: false, OR: [{ user1Id: userId, user2Id: receiverId }, { user1Id: receiverId, user2Id: userId }] } });
        if (conversation) {
          const message = await prisma.message.create({ data: { conversationId: conversation.id, senderId: userId, receiverId, content: callType === 'video' ? '📹 Video call' : '📞 Voice call', type: 'call', mediaUrl: call.id, messageStatus: 'delivered' }, include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } } });
          io.to(`user:${userId}`).to(`user:${receiverId}`).emit('message:new', message);
        }
        const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { fcmToken: true } });
        sendPush(receiver?.fcmToken, {
          title: `Incoming ${callType} call`,
          body: `${socket.user.displayName || socket.user.username} is calling you`,
          type: 'call',
          data: { callId: call.id, fromUserId: userId, callerName: socket.user.displayName || socket.user.username, callType, offer: Buffer.from(JSON.stringify(data.offer), 'utf8').toString('base64') }
        }).catch(err => console.error('call push error', err));
        io.to(`user:${receiverId}`).emit('call:offer', { callId: call.id, fromUserId: userId, fromUsername: socket.user.username, offer: data.offer, callType });
        acknowledge?.({ ok: true, callId: call.id });
      } catch (err) {
        console.error('call offer error', err);
        acknowledge?.({ ok: false });
      }
    });

    socket.on('call:answer', async (data, acknowledge) => {
      if (data?.callId) await prisma.callLog.updateMany({ where: { id: data.callId, receiverId: userId, status: 'ringing' }, data: { status: 'answered' } });
      io.to(`user:${data.toUserId}`).emit('call:answer', { fromUserId: userId, answer: data.answer, callId: data.callId });
      acknowledge?.({ ok: true });
    });

    socket.on('call:ice', (data) => {
      io.to(`user:${data.toUserId}`).emit('call:ice', {
        fromUserId: userId,
        candidate: data.candidate
      });
    });

    socket.on('call:end', async (data) => {
      const call = data?.callId ? await prisma.callLog.findFirst({ where: { id: data.callId, OR: [{ callerId: userId }, { receiverId: userId }] } }) : null;
      const outcome = call?.status === 'ringing' ? (data?.outcome === 'declined' ? 'declined' : 'missed') : (data?.outcome || 'completed');
      if (call) {
        const status = outcome === 'declined' ? 'declined' : outcome === 'missed' ? 'missed' : 'completed';
        const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
        const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { fcmToken: true } });
        sendPush(otherUser?.fcmToken, {
          title: '', body: '', type: 'call_cancel',
          data: { callId: call.id, fromUserId: userId }
        }).catch(err => console.error('call notification cancel error', err));
        await prisma.callLog.update({ where: { id: call.id }, data: { status, endedAt: new Date() } });
        const message = await prisma.message.findFirst({ where: { type: 'call', mediaUrl: call.id } });
        if (message) {
          const messageType = status === 'missed' ? 'missed_call' : status === 'declined' ? 'declined_call' : 'call_ended';
          const updated = await prisma.message.update({ where: { id: message.id }, data: { type: messageType, content: status === 'missed' ? `❌ Missed ${call.callType} call` : status === 'declined' ? `📵 Declined ${call.callType} call` : `📞 ${call.callType} call ended` } });
          io.to(`user:${call.callerId}`).to(`user:${call.receiverId}`).emit('message:update', updated);
        }
      }
      io.to(`user:${data.toUserId}`).emit('call:end', { fromUserId: userId, callId: data.callId });
    });

    // Group call signaling: only group members may join; WebRTC signals are targeted peer-to-peer.
    socket.on('group-call:join', async (data, acknowledge) => {
      const groupId = String(data?.groupId || '');
      const membership = groupId ? await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } }) : null;
      if (!membership) return acknowledge?.({ ok: false, error: 'You are not a group member' });
      const room = `call:${groupId}`;
      const isNewCall = !groupCallHosts.has(groupId);
      if (isNewCall) groupCallHosts.set(groupId, userId);
      const existing = (await io.in(room).fetchSockets()).filter(item => item.id !== socket.id).map(item => ({ userId: item.user.id, username: item.user.username }));
      socket.join(room);
      if (isNewCall) {
        const callType = data.callType === 'video' ? 'video' : 'audio';
        const callMessage = await prisma.message.create({
          data: { groupId, senderId: userId, content: callType === 'video' ? '📹 Group video call started' : '📞 Group voice call started', type: 'call', messageStatus: 'sent' },
          include: { sender: { select: { id: true, username: true, displayName: true, avatar: true } } }
        });
        io.to(`group:${groupId}`).emit('message:new', callMessage);
      }
      const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true, user: { select: { fcmToken: true } } } });
      const invite = { groupId, fromUserId: userId, fromUsername: socket.user.displayName || socket.user.username, callType: data.callType === 'video' ? 'video' : 'audio' };
      for (const member of members) {
        if (member.userId !== userId) {
          io.to(`user:${member.userId}`).emit('group-call:invite', invite);
          sendPush(member.user?.fcmToken, { title: `Incoming group ${invite.callType} call`, body: `${invite.fromUsername} is calling the group`, type: 'group_call', data: invite }).catch(error => console.error('group call push error', error));
        }
      }
      socket.to(room).emit('group-call:user-joined', { groupId, userId, username: socket.user.username, callType: data.callType === 'video' ? 'video' : 'audio' });
      acknowledge?.({ ok: true, participants: existing });
    });

    socket.on('group-call:signal', async (data) => {
      const groupId = String(data?.groupId || '');
      const toUserId = String(data?.toUserId || '');
      const membership = groupId ? await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } }) : null;
      if (!membership || !toUserId || !data.signal) return;
      io.to(`user:${toUserId}`).emit('group-call:signal', { groupId, fromUserId: userId, signal: data.signal });
    });

    socket.on('group-call:mute', async (data) => {
      const groupId = String(data?.groupId || '');
      const toUserId = String(data?.toUserId || '');
      const membership = groupId ? await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } }) : null;
      const targetMembership = groupId && toUserId ? await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: toUserId } } }) : null;
      if (!membership || !targetMembership || !toUserId || toUserId === userId || groupCallHosts.get(groupId) !== userId) return;
      io.to(`user:${toUserId}`).emit('group-call:remote-mute', { groupId, fromUserId: userId, muted: data.muted !== false });
    });

    socket.on('group-call:leave', (data) => {
      const groupId = String(data?.groupId || '');
      socket.leave(`call:${groupId}`);
      if (groupCallHosts.get(groupId) === userId) groupCallHosts.delete(groupId);
      socket.to(`call:${groupId}`).emit('group-call:user-left', { groupId, userId });
    });

    socket.on('disconnect', async () => {
      for (const [groupId, hostId] of groupCallHosts.entries()) if (hostId === userId) groupCallHosts.delete(groupId);
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
