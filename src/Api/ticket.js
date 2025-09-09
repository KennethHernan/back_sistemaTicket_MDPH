import { Router } from "express";
import { createTicket, listarTickets, cancelarTicket, asignarResponsable, finalizarTicket } from "../services/ticketService.js";
const router = Router();

// ROUTER CREAR USUARIO
router.post("/createTicket", async (req, res) => {
  try {    
    const result = await createTicket(req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(result.status).json(result);
  } catch (err) {
    console.error("Error inesperado:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
router.get("/allTicket", async (req, res) => {
  try {
    const allTicket = await listarTickets();
    return res.json(allTicket);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudieron obtener los tickets" });
  }
});
router.post("/cancelTicket", async (req, res) => {
  try {
    const result = await cancelarTicket(req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo cancelar el Ticket" });
  }
});
router.post("/asignarResponsable", async (req, res) => {
  try {
    const result = await asignarResponsable(req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo asignar responsable" });
  }
});
router.post("/finalizarTicket", async (req, res) => {
  try {
    const result = await finalizarTicket(req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo finalizar ticket" });
  }
});

export default router;
