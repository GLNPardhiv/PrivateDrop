import app from "./app.js";
import connectDB from "./db/db.js";
import { cleanupExpiredFiles } from "./services/s3.services.js";

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Optimise TCP sockets for large file transfers
    server.on('connection', (socket) => {
      // Disable Nagle's algorithm – send data immediately
      socket.setNoDelay(true);
      // Keep connections alive
      socket.setKeepAlive(true, 60000);
      // Note: setWriteBufferSize is not a standard method; we rely on the OS default
    });

    // Increase server timeouts to prevent premature closing
    server.timeout = 600000; // 10 minutes
    server.keepAliveTimeout = 600000;

  })
  .catch((error) => {
    console.error(`Error connecting to the database: ${error.message}`);
    process.exit(1);
  });

// Cleanup expired files every 5 minutes
setInterval(cleanupExpiredFiles, 5 * 60 * 1000);
cleanupExpiredFiles();