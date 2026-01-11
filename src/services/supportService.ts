import { API_BASE_URL } from "../constants/api";
import { apiRateLimiter } from "./apiRateLimiter";
import { sanitizeObjectStrings, fixMojibake } from "../utils/fixMojibake";
import {
  Ticket,
  CreateTicketRequest,
  AddMessageRequest,
  UpdateTicketRequest,
  UpdateStatusRequest,
  TicketStatistics,
} from "../types/support";

class SupportService {
  // headers and auth are handled by `apiRateLimiter` which attaches Authorization automatically

  /**
   * Crear un nuevo ticket de soporte
   */
  async createTicket(data: CreateTicketRequest): Promise<Ticket> {
    try {
      console.log("📤 [SupportService] createTicket - Iniciando...", { titulo: data.titulo });
      const url = `${API_BASE_URL}/support-tickets`;
      console.log("🌐 [SupportService] createTicket - URL:", url);
      console.log("📦 [SupportService] createTicket - Body:", data);
      const response = await apiRateLimiter.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      console.log("📥 [SupportService] createTicket - Respuesta:", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const rawErr = await response.json().catch(() => ({}));
        const error = sanitizeObjectStrings(rawErr);
        console.error("❌ [SupportService] createTicket - Error del servidor:", error);
        throw new Error(error.message || `Error ${response.status}: ${response.statusText}`);
      }

      const resultRaw = await response.json();
      const result = sanitizeObjectStrings(resultRaw);
      console.log("✅ [SupportService] createTicket - Ticket creado:", { ticketId: result.ticketId });
      return result;
    } catch (error: any) {
      console.error("❌ [SupportService] createTicket - Error:", error);
      throw error;
    }
  }

  /**
   * Obtener todos los tickets del usuario
   */
  async getMyTickets(): Promise<Ticket[]> {
    try {
      console.log("📤 [SupportService] getMyTickets - Iniciando...");
      const url = `${API_BASE_URL}/support-tickets`;
      console.log("🌐 [SupportService] getMyTickets - URL:", url);
      const response = await apiRateLimiter.fetch(url);
      console.log("📥 [SupportService] getMyTickets - Respuesta:", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const rawErr = await response.json().catch(() => ({}));
        const error = sanitizeObjectStrings(rawErr);
        console.error("❌ [SupportService] getMyTickets - Error del servidor:", error);
        throw new Error(error.message || "Error al obtener tickets");
      }

      const ticketsRaw = await response.json();
      const tickets = sanitizeObjectStrings(ticketsRaw) as any[];
      console.log("✅ [SupportService] getMyTickets - Tickets obtenidos:", { count: tickets.length });
      return tickets;
    } catch (error: any) {
      console.error("❌ [SupportService] getMyTickets - Error:", error);
      throw error;
    }
  }

  /**
   * Obtener detalle de un ticket específico
   */
  async getTicketDetail(ticketId: string): Promise<Ticket> {
    try {
      console.log("📤 [SupportService] getTicketDetail - Iniciando...", { ticketId });
      const url = `${API_BASE_URL}/support-tickets/${ticketId}`;
      console.log("🌐 [SupportService] getTicketDetail - URL:", url);
      const response = await apiRateLimiter.fetch(url);
      console.log("📥 [SupportService] getTicketDetail - Respuesta:", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const rawErr = await response.json().catch(() => ({}));
        const error = sanitizeObjectStrings(rawErr);
        console.error("❌ [SupportService] getTicketDetail - Error del servidor:", error);
        throw new Error(error.message || "Error al obtener el ticket");
      }

      const ticketRaw = await response.json();
      const ticket = sanitizeObjectStrings(ticketRaw);
      console.log("✅ [SupportService] getTicketDetail - Ticket obtenido:", { 
        ticketId: ticket.ticketId, 
        estado: ticket.estado,
        mensajesCount: ticket.mensajes?.length || 0 
      });
      return ticket;
    } catch (error: any) {
      console.error("❌ [SupportService] getTicketDetail - Error:", error);
      throw error;
    }
  }

  /**
   * Agregar un mensaje a un ticket
   */
  async addMessage(ticketId: string, data: AddMessageRequest): Promise<Ticket> {
    try {
      console.log("📤 [SupportService] addMessage - Iniciando...", { ticketId, mensajeLength: data.mensaje.length });
      console.log("💬 [SupportService] addMessage - Mensaje:", data.mensaje);
      
      const url = `${API_BASE_URL}/support-tickets/${ticketId}/messages`;
      console.log("🌐 [SupportService] addMessage - URL:", url);
      console.log("📦 [SupportService] addMessage - Body:", data);
      const response = await apiRateLimiter.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      console.log("📥 [SupportService] addMessage - Respuesta:", { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorText = await response.text();
        const sanitizedText = fixMojibake(errorText || '');
        console.error("❌ [SupportService] addMessage - Error response (text):", sanitizedText);
        let errorParsed: any;
        try {
          errorParsed = JSON.parse(sanitizedText);
        } catch {
          errorParsed = { message: sanitizedText };
        }
        const error = sanitizeObjectStrings(errorParsed);
        console.error("❌ [SupportService] addMessage - Error parseado:", error);
        throw new Error(error.message || `Error ${response.status}: ${response.statusText}`);
      }

      const resultRaw = await response.json();
      const result = sanitizeObjectStrings(resultRaw);
      console.log("✅ [SupportService] addMessage - Mensaje agregado exitosamente");
      console.log("📊 [SupportService] addMessage - Ticket actualizado:", { 
        ticketId: result.ticketId,
        estado: result.estado,
        mensajesCount: result.mensajes?.length || 0
      });
      return result;
    } catch (error: any) {
      console.error("❌ [SupportService] addMessage - Error completo:", { 
        message: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Editar un ticket
   */
  async updateTicket(
    ticketId: string,
    data: UpdateTicketRequest
  ): Promise<Ticket> {
    const response = await apiRateLimiter.fetch(`${API_BASE_URL}/support-tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const rawErr = await response.json().catch(() => ({}));
      const error = sanitizeObjectStrings(rawErr);
      throw new Error(error.message || "Error al actualizar el ticket");
    }

    const updated = await response.json();
    return sanitizeObjectStrings(updated);
  }

  /**
   * Eliminar un ticket
   */
  async deleteTicket(ticketId: string): Promise<{ message: string }> {
    const response = await apiRateLimiter.fetch(`${API_BASE_URL}/support-tickets/${ticketId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const rawErr = await response.json().catch(() => ({}));
      const error = sanitizeObjectStrings(rawErr);
      throw new Error(error.message || "Error al eliminar el ticket");
    }

    const deleted = await response.json();
    return sanitizeObjectStrings(deleted) as { message: string };
  }

  /**
   * Cambiar estado de un ticket (solo staff)
   */
  async updateTicketStatus(
    ticketId: string,
    data: UpdateStatusRequest
  ): Promise<Ticket> {
    const response = await apiRateLimiter.fetch(
      `${API_BASE_URL}/support-tickets/${ticketId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const rawErr = await response.json().catch(() => ({}));
      const error = sanitizeObjectStrings(rawErr);
      throw new Error(error.message || "Error al actualizar el estado");
    }

    const updated = await response.json();
    return sanitizeObjectStrings(updated);
  }

  /**
   * Obtener estadísticas (solo staff)
   */
  async getStatistics(): Promise<TicketStatistics> {
    const response = await apiRateLimiter.fetch(`${API_BASE_URL}/support-tickets/statistics`);

    if (!response.ok) {
      const rawErr = await response.json().catch(() => ({}));
      const error = sanitizeObjectStrings(rawErr);
      throw new Error(error.message || "Error al obtener estadísticas");
    }

    const stats = await response.json();
    return sanitizeObjectStrings(stats) as TicketStatistics;
  }
}

export default new SupportService();
