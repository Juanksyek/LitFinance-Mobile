export type TicketEstado = "abierto" | "en_progreso" | "resuelto" | "cerrado";

export interface Mensaje {
  id: string;
  mensaje: string;
  esStaff: boolean;
  creadoPor: string;
  createdAt: string;
}

export interface Ticket {
  ticketId: string;
  userId: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  mensajes: Mensaje[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketRequest {
  titulo: string;
  descripcion: string;
}

export interface AddMessageRequest {
  mensaje: string;
}

export interface UpdateTicketRequest {
  titulo?: string;
  descripcion?: string;
}

export interface UpdateStatusRequest {
  estado: TicketEstado;
}

export interface TicketStatistics {
  total: number;
  abiertos: number;
  enProgreso: number;
  resueltos: number;
  cerrados: number;
}
