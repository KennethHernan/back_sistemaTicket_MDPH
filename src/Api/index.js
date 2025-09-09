import http from "http";
import app from "./app.js";
import conectarDB from "../utils/database.js";
import { Server } from "socket.io";

const PORT = 5000;
const IP = "192.168.2.189";

const server = http
  .createServer(app)

  .listen(PORT)
  .on("listening", () => console.log(`${IP}:${PORT}`))
  .on("error", (error) => {
    console.log(error);
    process.exit(1);
  });

const io = new Server(server, {
  cors: {
    origin: "http://192.168.2.189:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`✅ Total de clientes conectados: ${io.engine.clientsCount}`);
});

conectarDB(io);
