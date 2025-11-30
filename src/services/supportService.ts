import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import {
  Ticket,
  CreateTicketRequest,
  AddMessageRequest,
  UpdateTicketRequest,
  UpdateStatusRequest,
  TicketStatistics,
} from "../types/support";

class SupportService {
  private async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem("authToken");
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Crear un nuevo ticket de soporte
   */
  async createTicket(data: CreateTicketRequest): Promise<Ticket> {
    try {
      console.log("📤 [SupportService] createTicket - Iniciando...", { titulo: data.titulo });
      const headers = await this.getHeaders();
      console.log("🔑 [SupportService] createTicket - Headers obtenidos");
      
      const url = `${API_BASE_URL}/support-tickets`;
      console.log("🌐 [SupportService] createTicket - URL:", url);
      console.log("📦 [SupportService] createTicket - Body:", data);
      
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      console.log("📥 [SupportService] createTicket - Respuesta:", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("❌ [SupportService] createTicket - Error del servidor:", error);
        throw new Error(error.message || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
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
      const headers = await this.getHeaders();
      const url = `${API_BASE_URL}/support-tickets`;
      console.log("🌐 [SupportService] getMyTickets - URL:", url);
      
      const response = await fetch(url, { headers });
      console.log("📥 [SupportService] getMyTickets - Respuesta:", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ [SupportService] getMyTickets - Error del servidor:", error);
        throw new Error(error.message || "Error al obtener tickets");
      }

      const tickets = await response.json();
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
      const headers = await this.getHeaders();
      const url = `${API_BASE_URL}/support-tickets/${ticketId}`;
      console.log("🌐 [SupportService] getTicketDetail - URL:", url);
      
      const response = await fetch(url, { headers });
      console.log("📥 [SupportService] getTicketDetail - Respuesta:", { status: response.status, ok: response.ok });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ [SupportService] getTicketDetail - Error del servidor:", error);
        throw new Error(error.message || "Error al obtener el ticket");
      }

      const ticket = await response.json();
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
      
      const headers = await this.getHeaders();
      console.log("🔑 [SupportService] addMessage - Headers obtenidos");
      
      const url = `${API_BASE_URL}/support-tickets/${ticketId}/messages`;
      console.log("🌐 [SupportService] addMessage - URL:", url);
      console.log("📦 [SupportService] addMessage - Body:", data);
      
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      console.log("📥 [SupportService] addMessage - Respuesta:", { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [SupportService] addMessage - Error response (text):", errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText };
        }
        console.error("❌ [SupportService] addMessage - Error parseado:", error);
        throw new Error(error.message || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
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
    const response = await fetch(`${API_BASE_URL}/support-tickets/${ticketId}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el ticket");
    }

    return await response.json();
  }

  /**
   * Eliminar un ticket
   */
  async deleteTicket(ticketId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/support-tickets/${ticketId}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al eliminar el ticket");
    }

    return await response.json();
  }

  /**
   * Cambiar estado de un ticket (solo staff)
   */
  async updateTicketStatus(
    ticketId: string,
    data: UpdateStatusRequest
  ): Promise<Ticket> {
    const response = await fetch(
      `${API_BASE_URL}/support-tickets/${ticketId}/status`,
      {
        method: "PUT",
        headers: await this.getHeaders(),
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el estado");
    }

    return await response.json();
  }

  /**
   * Obtener estadísticas (solo staff)
   */
  async getStatistics(): Promise<TicketStatistics> {
    const response = await fetch(`${API_BASE_URL}/support-tickets/statistics`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener estadísticas");
    }

    return await response.json();
  }
}

export default new SupportService();
