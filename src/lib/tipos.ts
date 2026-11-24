// ============================================================
//  TIPOS DE DATOS DE LA CLÍNICA
// ============================================================

export type Rol = 'medico' | 'recepcion' | 'paciente' | 'admin';

export interface Config {
  clinica: string;
  lema: string;
  direccion: string;
  telefono: string;
  whatsapp: string;
  correo: string;
  nit: string;
  horaApertura: string;   // "07:00"
  horaCierre: string;     // "18:00"
  duracionCita: number;   // minutos
}

export interface Especialidad {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  descripcion: string;
}

export interface Medico {
  id: string;
  nombres: string;
  apellidos: string;
  genero: 'F' | 'M';
  especialidadId: string;
  colegiado: string;
  telefono: string;
  correo: string;
  consultorio: string;
  dias: number[];         // 0 = lunes … 5 = sábado
  horaInicio: string;
  horaFin: string;
  precio: number;         // precio de la consulta
  bio: string;
  activo: boolean;
}

export interface Paciente {
  id: string;
  codigo: string;         // P-0001
  nombres: string;
  apellidos: string;
  genero: 'F' | 'M';
  nacimiento: string;
  dpi: string;
  telefono: string;
  correo: string;
  direccion: string;
  sangre: string;
  alergias: string;       // vacío = ninguna conocida
  antecedentes: string;
  seguro: string;         // vacío = particular
  emergenciaNombre: string;
  emergenciaTelefono: string;
  registrado: string;
}

export interface Servicio {
  id: string;
  nombre: string;
  tipo: 'Consulta' | 'Procedimiento' | 'Laboratorio' | 'Imagen';
  precio: number;
  especialidadId: string | null;
}

export type EstadoCita = 'Programada' | 'Confirmada' | 'En espera' | 'En consulta' | 'Atendida' | 'Cancelada' | 'No asistió';

export interface Cita {
  id: string;
  pacienteId: string;
  medicoId: string;
  fecha: string;          // YYYY-MM-DD
  hora: string;           // HH:MM
  motivo: string;
  estado: EstadoCita;
  origen: 'Recepción' | 'En línea';
  llegada: string | null; // ISO, al registrar llegada
  creada: string;
  nota: string;
}

export interface Signos {
  presion: string;        // "120/80"
  pulso: number | null;
  temperatura: number | null;
  peso: number | null;    // kg
  talla: number | null;   // cm
  saturacion: number | null;
}

export interface Consulta {
  id: string;
  citaId: string | null;
  pacienteId: string;
  medicoId: string;
  fecha: string;          // ISO
  motivo: string;
  sintomas: string;
  examen: string;
  diagnostico: string;
  plan: string;
  signos: Signos;
  servicios: string[];    // ids de servicios adicionales
  seguimiento: string | null;
}

export interface Medicamento {
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

export interface Receta {
  id: string;
  consultaId: string;
  pacienteId: string;
  medicoId: string;
  fecha: string;
  medicamentos: Medicamento[];
  indicaciones: string;
}

export interface Cobro {
  id: string;
  citaId: string | null;
  consultaId: string | null;
  pacienteId: string;
  medicoId: string | null;
  detalle: { concepto: string; monto: number }[];
  descuento: number;
  total: number;
  estado: 'Pendiente' | 'Pagado' | 'Anulado';
  metodo: '' | 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Seguro';
  fecha: string;          // ISO de creación
  fechaPago: string | null;
  recibo: string;
  cajeroId: string | null;
}

export interface Usuario {
  id: string;
  usuario: string;
  clave: string;
  rol: Rol;
  refId: string | null;   // médico o paciente vinculado
  nombre: string;
  cargo: string;
  activo: boolean;
  color: string;
  ultimoAcceso: string | null;
  vistoAvisos: string | null;
}

export interface Colecciones {
  especialidades: Especialidad;
  medicos: Medico;
  pacientes: Paciente;
  servicios: Servicio;
  citas: Cita;
  consultas: Consulta;
  recetas: Receta;
  cobros: Cobro;
  usuarios: Usuario;
}
