import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Para obtener ruta absoluta al archivo .py
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getHostByPython(ip) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../script/ipscaner.py");
    exec(`python ${scriptPath} --ips ${ip} --no-ping`, (err, stdout) => {
      if (err) return resolve("Error en Python");
      resolve(stdout.trim());
    });
  });
}

export async function scanIP(ip) {
  const nombrePC = await getHostByPython(ip);
  return { ip, nombrePC };
}
