import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import pollsRouter from "./routes/polls";
import { registerSocketHandlers } from "./socket";

dotenv.config();

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];
const corsOptions = {
  origin: clientOrigin.length > 0 ? clientOrigin : "*",
  methods: ["GET", "POST"],
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/polls", pollsRouter);

const io = new Server(server, { cors: corsOptions });
app.set("io", io);
registerSocketHandlers(io);

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const port = Number(process.env.PORT) || 4000;
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
