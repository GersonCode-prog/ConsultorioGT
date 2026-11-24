// ============================================================
//  MENÚ LATERAL DE CADA PORTAL
// ============================================================
import type { Rol } from './tipos';

export interface ItemMenu { id: string; texto: string; icono: string; ruta: string; grupo?: string; }

const m = (rol: Rol, id: string, texto: string, icono: string, grupo?: string): ItemMenu =>
  ({ id, texto, icono, ruta: id === 'inicio' ? `/${rol}/` : `/${rol}/${id}`, grupo });

export const MENUS: Record<Rol, ItemMenu[]> = {
  medico: [
    m('medico', 'inicio', 'Mi día', 'inicio', 'Consulta'), m('medico', 'agenda', 'Agenda', 'calendario'),
    m('medico', 'pacientes', 'Mis pacientes', 'usuarios', 'Expedientes'), m('medico', 'recetas', 'Recetas emitidas', 'pildora'),
  ],
  recepcion: [
    m('recepcion', 'inicio', 'Sala de espera', 'sala', 'Hoy'), m('recepcion', 'citas', 'Agenda de citas', 'calendario'),
    m('recepcion', 'pacientes', 'Pacientes', 'usuarios', 'Registro'), m('recepcion', 'caja', 'Caja', 'caja', 'Cobros'),
  ],
  paciente: [
    m('paciente', 'inicio', 'Inicio', 'inicio', 'Mi salud'), m('paciente', 'agendar', 'Agendar cita', 'mas'), m('paciente', 'citas', 'Mis citas', 'calendario'),
    m('paciente', 'recetas', 'Mis recetas', 'pildora'), m('paciente', 'historial', 'Mi historial', 'actividad'), m('paciente', 'pagos', 'Pagos', 'pagos', 'Cuenta'),
  ],
  admin: [
    m('admin', 'inicio', 'Panel', 'grafica', 'Clínica'), m('admin', 'medicos', 'Médicos', 'estetoscopio'), m('admin', 'servicios', 'Especialidades y precios', 'capas'),
    m('admin', 'reportes', 'Reportes', 'recibo', 'Gestión'), m('admin', 'usuarios', 'Usuarios', 'usuarios'), m('admin', 'configuracion', 'Configuración', 'ajustes', 'Sistema'),
  ],
};
