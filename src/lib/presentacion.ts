// ============================================================
//  TEXTOS DE PRESENTACIÓN DE CADA PORTAL (sitio e inicio de sesión)
// ============================================================
import type { Rol } from './tipos';

export const ORDEN_ROLES: Rol[] = ['paciente', 'medico', 'recepcion', 'admin'];

export const NOMBRE_CORTO: Record<Rol, string> = { paciente: 'Paciente', medico: 'Médico', recepcion: 'Recepción', admin: 'Admin' };

// Usuario de demostración de cada portal (contraseña 12345)
export const USUARIO_DEMO: Record<Rol, string> = { paciente: 'paciente', medico: 'medico', recepcion: 'recepcion', admin: 'admin' };

export const PUNTOS_ROL: Record<Rol, string[]> = {
  paciente: ['Agenda tu cita en línea', 'Recetas listas para imprimir', 'Historial y signos vitales', 'Pagos y recibos'],
  medico: ['Agenda del día y sala de espera', 'Consulta con signos y diagnóstico', 'Receta con alerta de alergias', 'Expediente clínico completo'],
  recepcion: ['Sala de espera en tiempo real', 'Agenda por médico y horario', 'Registro de pacientes', 'Caja, recibos y corte del día'],
  admin: ['Ingresos y ocupación', 'Médicos, horarios y precios', 'Reportes descargables', 'Usuarios y configuración'],
};
