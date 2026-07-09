import http from "http";
import { app } from "./app";
import { prisma } from "@/lib/prisma";
import { initSocketServer } from "@/lib/socket";

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    await prisma.$connect();
    console.log("Database connected");

    // Create HTTP server explicitly so Socket.io attaches cleanly
    const server = http.createServer(app);

    // Attach Socket.io BEFORE server.listen()
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
