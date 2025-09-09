import ora from "ora";
import { env } from "../config/environment.js";
import { connect } from "mongoose";
import Ticket from "../models/tickectModel.js";

export default async function conectarDB(io) {
  const spinner = ora("Conectando a BD...\r").start();

  try {
    const db = await connect(env.DB_URI);
    spinner.succeed(`Conexión a MongoDB exitosa: ${db.connection.name}\r`);
  } catch (error) {
    spinner.fail("Error al conectar a MongoDB\r");
    console.error(error);
  }

  const changeStream = Ticket.watch();

  changeStream.on("change", (change) => {
    io.emit("ticketChange", change);
  });
}
