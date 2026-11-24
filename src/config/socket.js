const jwt = require('jsonwebtoken');
let io;

/**
 * Socket.IO setup. Clients must authenticate with their JWT access token:
 *   io(url, { auth: { token: '<accessToken>' } })
 * Rooms joined automatically:
 *   user:<userId>  -> private notifications
 *   role:<role>    -> broadcast to all admins / sellers / customers
 */
exports.init = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization || '').replace('Bearer ', '');
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: String(payload.id), role: payload.role };
      next();
    } catch (e) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
    socket.emit('connected', { userId: socket.user.id, role: socket.user.role });
  });
  return io;
};

exports.emitTo = (room, event, payload) => {
  if (io) io.to(room).emit(event, payload);
};
