import http from "http";
import { app } from "./app";
import { connectDB, disconnectDB } from "@/lib/db";
import { initSocketServer } from "@/lib/socket";

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocketServer(server);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Socket.io server initialized");
    });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

main();

process.on("SIGTERM", async () => {
  await disconnectDB();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});
