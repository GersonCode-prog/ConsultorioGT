// ============================================================
//  REGLAS DE LA CLÍNICA: personas, horarios, citas y cobros
// ============================================================
import type { Cita, Cobro, Consulta, EstadoCita, Medico, Paciente, Rol, Usuario } from './tipos';
import { obtener, porId, guardarItem, config } from './datos';
import { hoy, aFecha, fechaISO } from './formato';

export const ROLES: Record<Rol, { nombre: string; portal: string; emoji: string; color: string; descripcion: string }> = {
  medico: { nombre: 'Médico', portal: 'Portal Médico', emoji: '🩺', color: '#0d9488', descripcion: 'Tu agenda del día, consultas, expedientes y recetas.' },
  recepcion: { nombre: 'Recepción', portal: 'Portal de Recepción', emoji: '🗂️', color: '#2563eb', descripcion: 'Citas, sala de espera, registro de pacientes y caja.' },
  paciente: { nombre: 'Paciente', portal: 'Portal del Paciente', emoji: '🧑', color: '#7c3aed', descripcion: 'Agenda tus citas y consulta tus recetas e historial.' },
  admin: { nombre: 'Administrador', portal: 'Portal Administrativo', emoji: '⚙️', color: '#ea580c', descripcion: 'Médicos, servicios, usuarios, reportes y configuración.' },
};

// ---------- Personas ----------
export const nombreCompleto = (p?: { nombres: string; apellidos: string }) => (p ? `${p.nombres} ${p.apellidos}` : '—');
export const nombreCorto = (p?: { nombres: string; apellidos: string }) => (p ? `${p.nombres.split(' ')[0]} ${p.apellidos.split(' ')[0]}` : '—');
export const tituloDe = (m?: Medico) => (!m ? '' : m.especialidadId === 'nut' ? (m.genero === 'F' ? 'Lcda.' : 'Lic.') : m.genero === 'F' ? 'Dra.' : 'Dr.');
export const nombreMedico = (m?: Medico) => (m ? `${tituloDe(m)} ${nombreCorto(m)}` : '—');
export const nombreMedicoCompleto = (m?: Medico) => (m ? `${tituloDe(m)} ${nombreCompleto(m)}` : '—');

export function edad(nacimiento: string) {
  const n = aFecha(nacimiento); const h = new Date();
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
  return e;
}
export function textoEdad(nacimiento: string) {
  const e = edad(nacimiento);
  if (e >= 2) return `${e} años`;
  const n = aFecha(nacimiento); const h = new Date();
  const meses = (h.getFullYear() - n.getFullYear()) * 12 + h.getMonth() - n.getMonth();
  return `${meses} meses`;
}

export const especialidad = (id?: string | null) => porId('especialidades', id);
export const medico = (id?: string | null) => porId('medicos', id);
export const paciente = (id?: string | null) => porId('pacientes', id);
export const medicosActivos = () => obtener('medicos').filter((m) => m.activo);
export const usuarioDe = (rol: Rol, refId: string) => obtener('usuarios').find((u) => u.rol === rol && u.refId === refId);
export const colorMedico = (m?: Medico) => especialidad(m?.especialidadId)?.color ?? '#64748b';

// ---------- Estados de las citas ----------
export const ESTADOS: Record<EstadoCita, { clase: string; color: string; icono: string }> = {
  Programada: { clase: 'info', color: '#2563eb', icono: '🗓️' },
  Confirmada: { clase: 'rol', color: '#0d9488', icono: '✅' },
  'En espera': { clase: 'warn', color: '#d97706', icono: '🪑' },
  'En consulta': { clase: 'morado', color: '#7c3aed', icono: '🩺' },
  Atendida: { clase: 'ok', color: '#16a34a', icono: '✔️' },
  Cancelada: { clase: 'bad', color: '#dc2626', icono: '✖️' },
  'No asistió': { clase: 'neutral', color: '#64748b', icono: '🚫' },
};
export const activa = (c: Cita) => c.estado !== 'Cancelada' && c.estado !== 'No asistió';
export const pendienteDeAtender = (c: Cita) => ['Programada', 'Confirmada', 'En espera', 'En consulta'].includes(c.estado);

// ---------- Horarios ----------
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const diaSemana = (f: string) => (aFecha(f).getDay() + 6) % 7; // 0 = lunes
export const trabajaEl = (m: Medico, f: string) => m.activo && m.dias.includes(diaSemana(f));
const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const horaFin = (h: string) => aHora(aMin(h) + config().duracionCita);
export const textoHora = (h: string) => { const [a, b] = h.split(':').map(Number); return `${a % 12 || 12}:${String(b).padStart(2, '0')} ${a < 12 ? 'a. m.' : 'p. m.'}`; };

export function horariosMedico(m: Medico) {
  const paso = config().duracionCita; const lista: string[] = [];
  for (let t = aMin(m.horaInicio); t + paso <= aMin(m.horaFin); t += paso) lista.push(aHora(t));
  return lista;
}

// Todas las horas de la clínica (para la agenda general)
export function horasClinica() {
  const c = config(); const lista: string[] = [];
  for (let t = aMin(c.horaApertura); t + c.duracionCita <= aMin(c.horaCierre); t += c.duracionCita) lista.push(aHora(t));
  return lista;
}

export const citaEn = (medicoId: string, fecha: string, h: string, ignorar?: string) =>
  obtener('citas').find((c) => c.medicoId === medicoId && c.fecha === fecha && c.hora === h && activa(c) && c.id !== ignorar);

export function horariosDisponibles(m: Medico, fecha: string, ignorar?: string) {
  if (!trabajaEl(m, fecha) || fecha < hoy()) return [];
  const ahora = new Date(); const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  return horariosMedico(m).filter((h) => !citaEn(m.id, fecha, h, ignorar) && !(fecha === hoy() && aMin(h) <= minAhora + 15));
}

// Próximos días en que el médico atiende (para elegir fecha)
export function proximosDias(m: Medico, cantidad = 14) {
  const dias: string[] = []; const d = new Date();
  for (let i = 0; dias.length < cantidad && i < 60; i++) {
    const f = fechaISO(d);
    if (m.dias.includes(diaSemana(f))) dias.push(f);
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

// ---------- Consultas de datos ----------
const porFechaHora = (a: Cita, b: Cita) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
export const citasDelDia = (fecha: string, medicoId?: string) => obtener('citas').filter((c) => c.fecha === fecha && (!medicoId || c.medicoId === medicoId)).sort(porFechaHora);
export const citasDePaciente = (pid: string) => obtener('citas').filter((c) => c.pacienteId === pid).sort(porFechaHora);
export const proximaCita = (pid: string) => citasDePaciente(pid).find((c) => c.fecha >= hoy() && pendienteDeAtender(c));
export const consultasDePaciente = (pid: string) => obtener('consultas').filter((c) => c.pacienteId === pid).sort((a, b) => b.fecha.localeCompare(a.fecha));
export const recetasDePaciente = (pid: string) => obtener('recetas').filter((r) => r.pacienteId === pid).sort((a, b) => b.fecha.localeCompare(a.fecha));
export const cobrosDePaciente = (pid: string) => obtener('cobros').filter((c) => c.pacienteId === pid).sort((a, b) => b.fecha.localeCompare(a.fecha));
export const cobrosPendientes = () => obtener('cobros').filter((c) => c.estado === 'Pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
export const pacientesDeMedico = (mid: string) => {
  const ids = new Set(obtener('citas').filter((c) => c.medicoId === mid && c.estado !== 'Cancelada').map((c) => c.pacienteId));
  return obtener('pacientes').filter((p) => ids.has(p.id));
};
export const solicitudesEnLinea = () => obtener('citas').filter((c) => c.origen === 'En línea' && c.estado === 'Programada' && c.fecha >= hoy()).sort(porFechaHora);

export function minutosEspera(c: Cita) {
  return c.llegada ? Math.max(0, Math.round((Date.now() - new Date(c.llegada).getTime()) / 60000)) : 0;
}

export function imc(peso: number | null, talla: number | null) {
  if (!peso || !talla) return null;
  const v = peso / Math.pow(talla / 100, 2);
  const texto = v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad';
  return { valor: Math.round(v * 10) / 10, texto };
}

// ---------- Acciones ----------
export function cambiarEstado(citaId: string, estado: EstadoCita) {
  const c = porId('citas', citaId)!;
  guardarItem('citas', { ...c, estado, llegada: estado === 'En espera' && !c.llegada ? new Date().toISOString() : c.llegada });
}

export function siguienteRecibo() {
  const max = obtener('cobros').reduce((m, c) => Math.max(m, Number(c.recibo.replace(/\D/g, '')) || 0), 0);
  return `R-${String(max + 1).padStart(6, '0')}`;
}

// Al terminar la consulta se genera el cobro para la caja
export function crearCobro(cons: Consulta) {
  const m = medico(cons.medicoId)!;
  const detalle = [
    { concepto: `Consulta de ${especialidad(m.especialidadId)?.nombre ?? 'medicina'}`, monto: m.precio },
    ...cons.servicios.map((id) => porId('servicios', id)).filter(Boolean).map((s) => ({ concepto: s!.nombre, monto: s!.precio })),
  ];
  const cobro: Cobro = {
    id: `cb-${cons.id}`, citaId: cons.citaId, consultaId: cons.id, pacienteId: cons.pacienteId, medicoId: m.id, detalle, descuento: 0,
    total: detalle.reduce((s, d) => s + d.monto, 0), estado: 'Pendiente', metodo: '', fecha: new Date().toISOString(), fechaPago: null, recibo: '', cajeroId: null,
  };
  guardarItem('cobros', cobro);
  return cobro;
}

export const totalCobrado = (lista: Cobro[]) => lista.filter((c) => c.estado === 'Pagado').reduce((s, c) => s + c.total, 0);
export const pacienteDeUsuario = (u: Usuario): Paciente | undefined => (u.rol === 'paciente' ? paciente(u.refId) : undefined);
export const medicoDeUsuario = (u: Usuario): Medico | undefined => (u.rol === 'medico' ? medico(u.refId) : undefined);
