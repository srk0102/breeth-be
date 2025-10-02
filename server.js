// Set Dynamoose log level to only show warnings and errors
process.env.DYNAMOOSE_LOG_LEVEL = "warn";

import { InitializeApp } from "./app";
import { Logger } from "./utils";
import { PORT, NODE_ENV } from "./config";
const http = require("http");
const { Server } = require("socket.io");

//Initialize server
(async () => {
  try {
    const app = await InitializeApp();
    const server = http.createServer(app);
    const io = new Server(server);

    io.on("connection", (socket) => {
      console.log("A user connected");

      socket.on("disconnect", () => {
        console.log("User disconnected");
      });

      socket.on("chat message", (msg) => {
        io.emit("chat message", msg); // Broadcast to all connected clients
      });
    });

    server.listen(PORT, () => {
      Logger.success(`Server Running on ${PORT}, environment: ${NODE_ENV}`);
    });
  } catch (err) {
    Logger.error("Bootstrap server error" + err.message);
    throw err;
  }
})();
