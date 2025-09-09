import { Ticket } from "../models/tickectModel.js";

export const createTicket = async (data) => {
  const { detalle, nombrePC, tipoIncidencia, ip, imagenUrl } = data;
  const lastTicket = await Ticket.findOne().sort({ numeroTicket: -1 }).exec();
  const nextNumeroTicket = lastTicket ? lastTicket.numeroTicket + 1 : 1;

  const newTicket = new Ticket({
    numeroTicket: nextNumeroTicket,
    detail: detalle,
    namePC: nombrePC,
    incidencia: tipoIncidencia,
    ip: ip,
    imgUrl: imagenUrl,
  });

  await newTicket.save();

  return {
    ok: true,
    status: 200,
    message: "Ticket creado exitosamente",
    numeroTicket: nextNumeroTicket
  };
};

export const listarTickets = async () => {
  return await Ticket.find().sort({ createdAt: -1 }); // ordena por fecha descendente
};

export const cancelarTicket = async (data) => {
  try {
    const { id } = data;
    const estado = "CANCELADO";

    const objTicket = await Ticket.findById(id);
    if (!objTicket)
      return {
        ok: false,
        status: 404,
        message: "Ticket no encontrado",
      };

    objTicket.estado = estado;
    await objTicket.save();

    return {
      ok: true,
      status: 200,
      message: "Ticket Cancelado",
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: error.message,
    };
  }
};

export const asignarResponsable = async (data) => {
  try {    
    const { id, asignado } = data;
    const estado = "EN CAMINO";
    const objTicket = await Ticket.findById(id);
    if (!objTicket)
      return {
        ok: false,
        status: 404,
        message: "Ticket no encontrado",
      };

    objTicket.asignado = asignado;
    objTicket.estado = estado;
    await objTicket.save();

    return {
      ok: true,
      status: 200,
      message: "Responsable asignado exitosamente",
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: error.message,
    };
  }
}; 

export const finalizarTicket = async (data) => {
  try {
    const { id } = data;
    const estado = "FINALIZADO";

    const objTicket = await Ticket.findById(id);
    if (!objTicket)
      return {
        ok: false,
        status: 404,
        message: "Ticket no encontrado",
      };

    objTicket.estado = estado;
    await objTicket.save();

    return {
      ok: true,
      status: 200,
      message: "Ticket Finalizado",
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: error.message,
    };
  }
};
