// Demo listener for the viva:  npm run socket-demo -- <accessToken>
const { io } = require('socket.io-client');
const token = process.argv[2];
if (!token) { console.error('Usage: npm run socket-demo -- <accessToken>'); process.exit(1); }

const socket = io(process.env.URL || 'http://localhost:5000', { auth: { token } });
socket.on('connect', () => console.log('connected'));
socket.on('connect_error', (e) => console.error('auth failed:', e.message));
['connected', 'order:placed', 'order:new', 'order:status', 'stock:low'].forEach((ev) =>
  socket.on(ev, (data) => console.log(`[${ev}]`, JSON.stringify(data)))
);
