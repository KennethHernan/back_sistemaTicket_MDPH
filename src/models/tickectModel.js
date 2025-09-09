import { Schema, model } from "mongoose";

const ticketsSchema = new Schema(
  {
    numeroTicket: { type: Number, required: true, unique: true },
    detail: { type: String, required: true },
    namePC: { type: String, required: true },
    incidencia: { type: String, required: true },
    estado: { type: String, default: "PENDIENTE" },
    ip: { type: String, required: true },
    imgUrl: { type: String, required: true },
    asignado : { type: String, default: "EN ESPERA" },
    lastSeen: Date,
    isOnline: Boolean,
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

export const Ticket = model("Ticket", ticketsSchema);

export const updateUserLastSeen = async (ticketId) => {
  await Ticket.findByIdAndUpdate(ticketId, {
    lastSeen: new Date().toISOString(),
    isOnline: true,
  });
};

export default Ticket;