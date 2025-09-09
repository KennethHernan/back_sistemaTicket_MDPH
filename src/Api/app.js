import express from "express";
import cors from "cors";
import net from "net";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import ticketRoute from "./ticket.js";
import { scanIP } from "../utils/ipscaner.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "HEAD", "CONNECT"],
  })
);
morgan.token("body", (req, res) => {
  if (res._body) {
    return JSON.stringify(res._body);
  }
  return "-";
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadFolder = path.join(__dirname, "../storage-img");

app.use("/images", express.static(path.resolve(__dirname, "../storage-img")));
app.use(morgan(":method :url :status :res[content-length] - :response-time ms :body"));
app.use("/api", ticketRoute);
app.get("/", (req, res) => {
  res.json({
    message: "Bienvenido al sistema de Ticket",
  });
});
app.get("/capturar", async (req, res) => {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  if (net.isIPv4(ip) === 0) {
    return res.json({ ip, nombrePC: "IP no IPv4 o inválida" });
  }

  try {
    const { nombrePC } = await scanIP(ip);
    return res.json({ ip, nombrePC });
  } catch (err) {
    console.error("Error en capturar:", err);
    return res.json({ ip, nombrePC: "DEFAULT" });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const tempName = Date.now() + "-" + file.originalname;
    cb(null, tempName);
  },
});
const upload = multer({ storage });
app.post("/upload", upload.single("imagen"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se subió ningún archivo" });
  }
  if (!req.body.nombrePC) {
    return res.status(400).json({ error: "No se cargó NombreHost" });
  }

  const oldPath = path.join(uploadFolder, req.file.filename);
  const newFilename =
    Date.now() + "-" + req.body.nombrePC + "-" + req.file.originalname;
  const newPath = path.join(uploadFolder, newFilename);

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Error al renombrar archivo" });
    }
    const publicUrl = `http://192.168.2.189:5000/images/${newFilename}`;
    res.json({ message: "Imagen subida con éxito", url: publicUrl });
  });
});

app.post("/deleteImg", (req, res) => {
  const { imgUrl } = req.body;

  if (!imgUrl) {
    return res.status(400).json({ error: "No se proporcionó la URL de la imagen" });
  }

  const filename = imgUrl.split("/").pop();
  const filePath = path.join(uploadFolder, filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Error al eliminar la imagen o no existe" });
    }
    console.log(`Imagen eliminada: ${filename}`);
    
    res.json({ message: "Imagen eliminada con éxito" });
  });
});

export default app;
