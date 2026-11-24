require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socket = require('./src/config/socket');
require('./src/config/listeners');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  const server = http.createServer(app);
  socket.init(server);
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
