const { sendPush } = require('./firebase');

async function notifyAdmins(prisma, io, { title, message, type = 'admin_notification', data = {} }) {
  const notification = await prisma.adminNotification.create({
    data: { title, message, type, data: JSON.stringify(data) }
  });
  io?.to('admins').emit('notification:new', notification);
  try {
    const devices = await prisma.adminDevice.findMany({ select: { token: true } });
    await Promise.all(devices.map(device => sendPush(device.token, {
      title,
      body: message,
      type,
      data: { notificationId: notification.id, ...data }
    })));
  } catch (error) {
    console.error('Admin notification push failed:', error.message);
  }
  return notification;
}

module.exports = { notifyAdmins };
