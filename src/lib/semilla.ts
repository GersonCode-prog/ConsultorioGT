// ============================================================
//  DATOS FICTICIOS DE DEMOSTRACIÓN
//  Se generan con una semilla fija y fechas relativas a hoy,
//  así la clínica siempre se ve "viva" al abrir la demo.
// ============================================================
import type {
  Cita, Cobro, Config, Consulta, Especialidad, EstadoCita, Medicamento, Medico, Paciente, Receta, Servicio, Signos, Usuario,
} from './tipos';
import { fechaISO, sinAcentos } from './formato';

export const VERSION = 1;

// Generador pseudoaleatorio con semilla (mulberry32)
function crearAzar(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catálogo clínico por especialidad (motivo → diagnóstico → plan → medicamentos)
interface Caso { motivo: string; sintomas: string; examen: string; diagnostico: string; plan: string; meds: Medicamento[]; servicios?: string[] }
const M = (nombre: string, dosis: string, frecuencia: string, duracion: string): Medicamento => ({ nombre, dosis, frecuencia, duracion });

const CASOS: Record<string, Caso[]> = {
  gen: [
    { motivo: 'Dolor de garganta y fiebre', sintomas: 'Dolor al tragar desde hace 2 días, fiebre no cuantificada.', examen: 'Amígdalas hiperémicas con exudado. Ganglios cervicales palpables.', diagnostico: 'Faringoamigdalitis aguda', plan: 'Abundantes líquidos, reposo relativo. Regresar si la fiebre persiste más de 3 días.', meds: [M('Acetaminofén 500 mg', '1 tableta', 'Cada 8 horas', '5 días'), M('Amoxicilina 500 mg', '1 cápsula', 'Cada 8 horas', '7 días')] },
    { motivo: 'Tos y congestión nasal', sintomas: 'Rinorrea, estornudos y tos seca de 3 días.', examen: 'Mucosa nasal congestionada. Pulmones limpios.', diagnostico: 'Rinofaringitis viral', plan: 'Lavados nasales con solución salina. Evitar cambios bruscos de temperatura.', meds: [M('Loratadina 10 mg', '1 tableta', 'Cada 24 horas', '5 días'), M('Acetaminofén 500 mg', '1 tableta', 'Cada 8 horas si hay malestar', '3 días')] },
    { motivo: 'Dolor abdominal y diarrea', sintomas: 'Evacuaciones líquidas (5 al día) y cólicos desde ayer.', examen: 'Abdomen blando, ruidos aumentados. Hidratado.', diagnostico: 'Gastroenteritis aguda', plan: 'Dieta blanda, hidratación oral. Consultar si hay sangre en heces o vómitos persistentes.', meds: [M('Sales de rehidratación oral', '1 sobre en 1 litro de agua', 'A libre demanda', '3 días')], servicios: ['s-hece'] },
    { motivo: 'Control de presión arterial', sintomas: 'Asintomático. Toma su medicamento diariamente.', examen: 'Ruidos cardiacos rítmicos. Sin edema.', diagnostico: 'Hipertensión arterial en control', plan: 'Dieta baja en sal, caminar 30 minutos al día. Control en 1 mes.', meds: [M('Losartán 50 mg', '1 tableta', 'Cada 24 horas (mañana)', '30 días')], servicios: ['s-lipi'] },
    { motivo: 'Dolor de cabeza frecuente', sintomas: 'Cefalea opresiva por las tardes, relacionada con estrés laboral.', examen: 'Examen neurológico normal.', diagnostico: 'Cefalea tensional', plan: 'Pausas activas, higiene del sueño, hidratación.', meds: [M('Ibuprofeno 400 mg', '1 tableta', 'Cada 8 horas con comida', '3 días')] },
    { motivo: 'Ardor al orinar', sintomas: 'Disuria y urgencia urinaria de 2 días.', examen: 'Dolor leve en hipogastrio. Puño percusión negativa.', diagnostico: 'Infección urinaria baja', plan: 'Tomar abundante agua. Control con examen de orina al terminar el tratamiento.', meds: [M('Nitrofurantoína 100 mg', '1 cápsula', 'Cada 12 horas', '7 días')], servicios: ['s-orina'] },
  ],
  ped: [
    { motivo: 'Fiebre y tos', sintomas: 'Fiebre de 38.5 °C y tos desde hace 2 días. Come bien.', examen: 'Faringe hiperémica. Pulmones sin ruidos agregados.', diagnostico: 'Infección respiratoria superior', plan: 'Control de temperatura, líquidos. Signos de alarma explicados a los padres.', meds: [M('Acetaminofén jarabe', 'Según peso (indicado en consulta)', 'Cada 6 horas si hay fiebre', '3 días')], servicios: ['s-nebu'] },
    { motivo: 'Control de niño sano', sintomas: 'Sin molestias. Desarrollo acorde a su edad.', examen: 'Peso y talla en percentil adecuado.', diagnostico: 'Niño sano — crecimiento adecuado', plan: 'Esquema de vacunación al día. Próximo control en 6 meses.', meds: [] },
    { motivo: 'Dolor de oído', sintomas: 'Otalgia derecha desde anoche, irritable.', examen: 'Membrana timpánica derecha abombada.', diagnostico: 'Otitis media aguda', plan: 'Analgesia y control en 48 horas.', meds: [M('Ibuprofeno suspensión', 'Según peso (indicado en consulta)', 'Cada 8 horas', '3 días')] },
  ],
  gin: [
    { motivo: 'Control prenatal', sintomas: 'Embarazo en curso, sin molestias.', examen: 'Altura uterina acorde. Frecuencia cardiaca fetal normal.', diagnostico: 'Embarazo de evolución normal', plan: 'Continuar vitaminas prenatales. Próximo control en 4 semanas.', meds: [M('Ácido fólico + hierro', '1 tableta', 'Cada 24 horas', '30 días')], servicios: ['s-usg'] },
    { motivo: 'Control anual', sintomas: 'Sin molestias.', examen: 'Examen ginecológico sin alteraciones.', diagnostico: 'Examen ginecológico normal', plan: 'Control anual. Autoexamen de mama mensual.', meds: [], servicios: ['s-pap'] },
  ],
  car: [
    { motivo: 'Palpitaciones', sintomas: 'Sensación de latidos fuertes, ocasional, sin desmayos.', examen: 'Ritmo regular. Soplos ausentes.', diagnostico: 'Extrasístoles benignas', plan: 'Reducir café y bebidas energéticas. Control en 3 meses.', meds: [], servicios: ['s-ekg'] },
    { motivo: 'Control de hipertensión', sintomas: 'Mareo ocasional por las mañanas.', examen: 'Sin edema. Pulsos periféricos presentes.', diagnostico: 'Hipertensión arterial', plan: 'Registro de presión en casa. Dieta baja en sal.', meds: [M('Losartán 50 mg', '1 tableta', 'Cada 24 horas', '30 días')], servicios: ['s-ekg'] },
  ],
  der: [
    { motivo: 'Granos en la cara', sintomas: 'Lesiones en frente y mejillas desde hace meses.', examen: 'Comedones y pápulas inflamatorias.', diagnostico: 'Acné vulgar moderado', plan: 'Limpieza facial 2 veces al día, protector solar. Control en 8 semanas.', meds: [M('Peróxido de benzoilo gel 5 %', 'Capa delgada', 'Por la noche', '8 semanas')] },
    { motivo: 'Manchas con picazón', sintomas: 'Enrojecimiento y comezón en antebrazos tras usar un detergente nuevo.', examen: 'Placas eritematosas bien delimitadas.', diagnostico: 'Dermatitis de contacto', plan: 'Evitar el detergente. Ropa de algodón.', meds: [M('Hidrocortisona crema 1 %', 'Capa delgada', 'Cada 12 horas', '7 días')] },
  ],
  tra: [
    { motivo: 'Dolor de rodilla', sintomas: 'Dolor tras torcedura jugando fútbol hace 3 días.', examen: 'Edema leve, estabilidad conservada.', diagnostico: 'Esguince de rodilla grado I', plan: 'Reposo, hielo 20 minutos 3 veces al día, elevar la pierna.', meds: [M('Ibuprofeno 400 mg', '1 tableta', 'Cada 8 horas con comida', '5 días')], servicios: ['s-rx'] },
    { motivo: 'Dolor de espalda baja', sintomas: 'Dolor lumbar al levantar peso, sin irradiación.', examen: 'Contractura paravertebral lumbar.', diagnostico: 'Lumbalgia mecánica', plan: 'Calor local, ejercicios de estiramiento. Evitar cargar peso.', meds: [M('Naproxeno 550 mg', '1 tableta', 'Cada 12 horas con comida', '5 días')] },
  ],
  nut: [
    { motivo: 'Quiere bajar de peso', sintomas: 'Aumento de peso en el último año. Poca actividad física.', examen: 'IMC en rango de sobrepeso.', diagnostico: 'Sobrepeso', plan: 'Plan de alimentación personalizado y actividad física 150 minutos por semana. Control en 4 semanas.', meds: [], servicios: ['s-plan'] },
    { motivo: 'Alimentación saludable', sintomas: 'Desea mejorar hábitos alimenticios.', examen: 'Peso adecuado.', diagnostico: 'Asesoría nutricional', plan: 'Plato balanceado, 8 vasos de agua al día.', meds: [] },
  ],
  odo: [
    { motivo: 'Dolor de muela', sintomas: 'Dolor al comer cosas frías en molar inferior izquierdo.', examen: 'Caries en pieza 36.', diagnostico: 'Caries dental', plan: 'Restauración con resina en la pieza afectada.', meds: [M('Ibuprofeno 400 mg', '1 tableta', 'Cada 8 horas si hay dolor', '3 días')], servicios: ['s-resina'] },
    { motivo: 'Limpieza dental', sintomas: 'Sangrado de encías al cepillarse.', examen: 'Placa bacteriana y encías inflamadas.', diagnostico: 'Gingivitis leve', plan: 'Técnica de cepillado e hilo dental diario.', meds: [M('Enjuague de clorhexidina 0.12 %', '15 mL', 'Cada 12 horas', '7 días')], servicios: ['s-limp'] },
  ],
};

export function generarDatos() {
  const azar = crearAzar(20261124);
  const entero = (a: number, b: number) => Math.floor(a + azar() * (b - a + 1));
  const elegir = <T,>(lista: T[]) => lista[Math.floor(azar() * lista.length)];
  const sucede = (p: number) => azar() < p;

  const ahora = new Date();
  const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return fechaISO(d); };
  const diaSemana = (f: string) => (new Date(f + 'T12:00:00').getDay() + 6) % 7; // 0 = lunes
  const minutosReales = ahora.getHours() * 60 + ahora.getMinutes();
  const AHORA_MIN = minutosReales >= 510 && minutosReales <= 990 ? minutosReales : 630; // 8:30–16:30, si no 10:30

  const config: Config = {
    clinica: 'Clínica Médica Vida Plena', lema: 'Tu salud, en buenas manos',
    direccion: '12 calle 3-45, zona 10, Ciudad de Guatemala', telefono: '2300-4500', whatsapp: '5500-4500',
    correo: 'citas@vidaplena.demo', nit: '1234567-8', horaApertura: '07:00', horaCierre: '18:00', duracionCita: 30,
  };

  const especialidades: Especialidad[] = [
    { id: 'gen', nombre: 'Medicina General', icono: '🩺', color: '#0d9488', descripcion: 'Atención de enfermedades comunes, chequeos y control de enfermedades crónicas.' },
    { id: 'ped', nombre: 'Pediatría', icono: '🧸', color: '#f59e0b', descripcion: 'Cuidado de la salud de bebés, niños y adolescentes.' },
    { id: 'gin', nombre: 'Ginecología', icono: '🌸', color: '#ec4899', descripcion: 'Salud de la mujer, control prenatal y chequeos anuales.' },
    { id: 'car', nombre: 'Cardiología', icono: '❤️', color: '#ef4444', descripcion: 'Prevención y tratamiento de enfermedades del corazón.' },
    { id: 'der', nombre: 'Dermatología', icono: '✨', color: '#8b5cf6', descripcion: 'Cuidado de la piel, cabello y uñas.' },
    { id: 'tra', nombre: 'Traumatología', icono: '🦴', color: '#2563eb', descripcion: 'Lesiones de huesos, articulaciones y músculos.' },
    { id: 'nut', nombre: 'Nutrición', icono: '🥗', color: '#16a34a', descripcion: 'Planes de alimentación y control de peso.' },
    { id: 'odo', nombre: 'Odontología', icono: '🦷', color: '#0ea5e9', descripcion: 'Limpiezas, resinas y salud bucal para toda la familia.' },
  ];

  const medicoBase = (id: string, nombres: string, apellidos: string, genero: 'F' | 'M', especialidadId: string, dias: number[], horaInicio: string, horaFin: string, precio: number, consultorio: string, bio: string): Medico => ({
    id, nombres, apellidos, genero, especialidadId, dias, horaInicio, horaFin, precio, consultorio, bio, activo: true,
    colegiado: String(entero(10000, 29999)), telefono: `${elegir(['3', '4', '5'])}${entero(100, 999)}-${entero(1000, 9999)}`,
    correo: `${sinAcentos(nombres.split(' ')[0]).toLowerCase()}.${sinAcentos(apellidos.split(' ')[0]).toLowerCase()}@vidaplena.demo`,
  });
  const medicos: Medico[] = [
    medicoBase('m1', 'Andrea', 'Morales Pineda', 'F', 'gen', [0, 1, 2, 3, 4], '07:00', '13:00', 200, 'Consultorio 1', 'Médica general con 10 años de experiencia en atención primaria y enfermedades crónicas.'),
    medicoBase('m2', 'José Luis', 'Aguilar Reyes', 'M', 'gen', [0, 1, 2, 3, 4, 5], '13:00', '18:00', 200, 'Consultorio 2', 'Médico general enfocado en medicina preventiva y del adulto.'),
    medicoBase('m3', 'Gabriela', 'Castillo Ruiz', 'F', 'ped', [0, 1, 2, 3, 4], '08:00', '14:00', 300, 'Consultorio 3', 'Pediatra con especialidad en desarrollo infantil y vacunación.'),
    medicoBase('m4', 'Mariana', 'López Estrada', 'F', 'gin', [0, 2, 4], '08:00', '13:00', 400, 'Consultorio 4', 'Ginecóloga y obstetra. Control prenatal y salud de la mujer.'),
    medicoBase('m5', 'Ricardo', 'Méndez Solís', 'M', 'car', [1, 3], '09:00', '15:00', 500, 'Consultorio 5', 'Cardiólogo clínico. Hipertensión, arritmias y prevención cardiovascular.'),
    medicoBase('m6', 'Sofía', 'Herrera Monzón', 'F', 'der', [0, 2, 4], '13:00', '18:00', 350, 'Consultorio 4', 'Dermatóloga clínica y estética.'),
    medicoBase('m7', 'Fernando', 'Pérez Barrios', 'M', 'tra', [1, 3, 5], '08:00', '13:00', 450, 'Consultorio 6', 'Traumatólogo y ortopedista. Lesiones deportivas.'),
    medicoBase('m8', 'Daniela', 'Ramírez Cifuentes', 'F', 'nut', [0, 1, 3], '14:00', '18:00', 250, 'Consultorio 3', 'Nutricionista clínica. Control de peso y nutrición deportiva.'),
    medicoBase('m9', 'Kevin', 'Ajú Coc', 'M', 'odo', [0, 1, 2, 3, 4, 5], '08:00', '16:00', 250, 'Clínica dental', 'Odontólogo general. Limpiezas, resinas y odontología preventiva.'),
  ];

  const servicios: Servicio[] = [
    { id: 's-hema', nombre: 'Hematología completa', tipo: 'Laboratorio', precio: 90, especialidadId: null },
    { id: 's-gluc', nombre: 'Glucosa en ayunas', tipo: 'Laboratorio', precio: 35, especialidadId: null },
    { id: 's-lipi', nombre: 'Perfil de lípidos', tipo: 'Laboratorio', precio: 150, especialidadId: null },
    { id: 's-orina', nombre: 'Examen de orina', tipo: 'Laboratorio', precio: 40, especialidadId: null },
    { id: 's-hece', nombre: 'Examen de heces', tipo: 'Laboratorio', precio: 40, especialidadId: null },
    { id: 's-iny', nombre: 'Aplicación de inyección', tipo: 'Procedimiento', precio: 35, especialidadId: 'gen' },
    { id: 's-cura', nombre: 'Curación de herida', tipo: 'Procedimiento', precio: 100, especialidadId: 'gen' },
    { id: 's-nebu', nombre: 'Nebulización', tipo: 'Procedimiento', precio: 75, especialidadId: 'ped' },
    { id: 's-usg', nombre: 'Ultrasonido obstétrico', tipo: 'Imagen', precio: 350, especialidadId: 'gin' },
    { id: 's-pap', nombre: 'Papanicolaou', tipo: 'Laboratorio', precio: 200, especialidadId: 'gin' },
    { id: 's-ekg', nombre: 'Electrocardiograma', tipo: 'Procedimiento', precio: 250, especialidadId: 'car' },
    { id: 's-crio', nombre: 'Crioterapia', tipo: 'Procedimiento', precio: 300, especialidadId: 'der' },
    { id: 's-rx', nombre: 'Rayos X', tipo: 'Imagen', precio: 250, especialidadId: 'tra' },
    { id: 's-yeso', nombre: 'Inmovilización con yeso', tipo: 'Procedimiento', precio: 450, especialidadId: 'tra' },
    { id: 's-plan', nombre: 'Plan nutricional personalizado', tipo: 'Procedimiento', precio: 200, especialidadId: 'nut' },
    { id: 's-limp', nombre: 'Limpieza dental', tipo: 'Procedimiento', precio: 300, especialidadId: 'odo' },
    { id: 's-resina', nombre: 'Resina dental', tipo: 'Procedimiento', precio: 400, especialidadId: 'odo' },
  ];

  // ---------- Pacientes ----------
  const nombresF = ['María José', 'Ana Lucía', 'Valeria', 'Camila', 'Sofía', 'Andrea', 'Fernanda', 'Gabriela', 'Lucía', 'Isabel', 'Daniela', 'Paola', 'Carmen', 'Rosa María', 'Alejandra', 'Mónica', 'Silvia', 'Elena', 'Ximena', 'Mariela'];
  const nombresM = ['Carlos', 'José', 'Luis', 'Juan Pablo', 'Diego', 'Andrés', 'Javier', 'Mario', 'Pedro', 'Jorge', 'Ricardo', 'Sebastián', 'Mateo', 'Daniel', 'Óscar', 'Roberto', 'Héctor', 'Kevin', 'Alejandro', 'Esteban'];
  const apellidos = ['García', 'López', 'Hernández', 'Pérez', 'González', 'Rodríguez', 'Martínez', 'Ramírez', 'Morales', 'Castillo', 'Gómez', 'Reyes', 'Cruz', 'Ortiz', 'Mejía', 'Barrios', 'Chávez', 'Juárez', 'Xitumul', 'Ajcalón', 'Toledo', 'Paz', 'Figueroa', 'Monterroso'];
  const zonas = ['zona 1', 'zona 5', 'zona 7', 'zona 11', 'zona 12', 'zona 18', 'Mixco', 'Villa Nueva', 'San Miguel Petapa', 'Santa Catarina Pinula'];
  const sangres = ['O+', 'O+', 'O+', 'A+', 'A+', 'B+', 'AB+', 'O-'];
  const alergiasPosibles = ['Penicilina', 'Sulfas', 'Mariscos', 'Ácido acetilsalicílico', 'Polen'];
  const antecedentesPosibles = ['Hipertensión arterial', 'Diabetes tipo 2', 'Asma en la infancia', 'Gastritis', 'Migraña', 'Cirugía de apéndice'];
  const seguros = ['Seguros El Roble', 'Aseguradora Rural', 'Pan-American Life', 'Seguros G&T'];
  const telefono = () => `${elegir(['3', '4', '5'])}${entero(100, 999)}-${entero(1000, 9999)}`;
  const dpi = () => `${entero(1000, 3999)} ${entero(10000, 99999)} ${elegir(['0101', '0108', '0115', '0301', '0901'])}`;

  const pacientes: Paciente[] = [];
  const crearPaciente = (p: Partial<Paciente> & { nombres: string; apellidos: string; genero: 'F' | 'M'; nacimiento: string }) => {
    const n = pacientes.length + 1;
    const pac: Paciente = {
      id: `p${n}`, codigo: `P-${String(n).padStart(4, '0')}`, dpi: dpi(), telefono: telefono(),
      correo: `${sinAcentos(p.nombres.split(' ')[0]).toLowerCase()}.${sinAcentos(p.apellidos.split(' ')[0]).toLowerCase()}${entero(1, 99)}@correo.demo`,
      direccion: `${entero(1, 25)}a. avenida ${entero(1, 40)}-${entero(10, 99)}, ${elegir(zonas)}`,
      sangre: elegir(sangres), alergias: sucede(0.18) ? elegir(alergiasPosibles) : '', antecedentes: sucede(0.3) ? elegir(antecedentesPosibles) : '',
      seguro: sucede(0.25) ? elegir(seguros) : '', emergenciaNombre: `${elegir([...nombresF, ...nombresM])} ${p.apellidos.split(' ')[0]}`, emergenciaTelefono: telefono(),
      registrado: dia(-entero(40, 700)), ...p,
    };
    pacientes.push(pac);
    return pac;
  };
  // Paciente de demostración
  const demo = crearPaciente({ nombres: 'Luis Fernando', apellidos: 'Hernández Gómez', genero: 'M', nacimiento: '1981-04-12', alergias: 'Penicilina', antecedentes: 'Hipertensión arterial (en tratamiento)', sangre: 'O+', seguro: '', emergenciaNombre: 'Claudia Gómez de Hernández', registrado: dia(-420) });
  for (let i = 0; i < 64; i++) {
    const g: 'F' | 'M' = sucede(0.55) ? 'F' : 'M';
    const nino = i % 9 === 0;
    const anio = ahora.getFullYear() - (nino ? entero(1, 12) : entero(18, 75));
    crearPaciente({
      nombres: elegir(g === 'F' ? nombresF : nombresM), apellidos: `${elegir(apellidos)} ${elegir(apellidos)}`, genero: g,
      nacimiento: `${anio}-${String(entero(1, 12)).padStart(2, '0')}-${String(entero(1, 28)).padStart(2, '0')}`,
    });
  }
  const edadDe = (p: Paciente) => ahora.getFullYear() - Number(p.nacimiento.slice(0, 4));
  const candidatos = (m: Medico) => pacientes.filter((p) => p.id !== demo.id && (
    m.especialidadId === 'ped' ? edadDe(p) < 15 : m.especialidadId === 'gin' ? p.genero === 'F' && edadDe(p) >= 16 : edadDe(p) >= 15 || m.especialidadId === 'gen' || m.especialidadId === 'odo'));

  // ---------- Horarios ----------
  const horarios = (m: Medico) => {
    const lista: string[] = [];
    let [h, mi] = m.horaInicio.split(':').map(Number);
    const fin = m.horaFin.split(':').map(Number);
    while (h * 60 + mi + config.duracionCita <= fin[0] * 60 + fin[1]) {
      lista.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
      mi += config.duracionCita; h += Math.floor(mi / 60); mi %= 60;
    }
    return lista;
  };

  const signosPara = (p: Paciente, base?: Partial<Signos>): Signos => {
    const nino = edadDe(p) < 13;
    const sis = entero(108, 132), dia_ = entero(68, 86);
    return {
      presion: nino ? '' : `${sis}/${dia_}`, pulso: entero(64, 92), temperatura: Math.round((36 + azar() * 1.2) * 10) / 10,
      peso: nino ? entero(12, 40) : entero(p.genero === 'F' ? 50 : 60, p.genero === 'F' ? 85 : 98), talla: nino ? entero(85, 150) : entero(p.genero === 'F' ? 148 : 160, p.genero === 'F' ? 170 : 185),
      saturacion: entero(95, 99), ...base,
    };
  };

  const citas: Cita[] = []; const consultas: Consulta[] = []; const recetas: Receta[] = []; const cobros: Cobro[] = [];
  let recibo = 1;
  const precioServicio = (id: string) => servicios.find((s) => s.id === id)!;
  const especialidad = (id: string) => especialidades.find((e) => e.id === id)!;

  // Registra una consulta atendida con su receta y su cobro
  function atender(c: Cita, caso: Caso, pagado: boolean, signosExtra?: Partial<Signos>) {
    const p = pacientes.find((x) => x.id === c.pacienteId)!;
    const m = medicos.find((x) => x.id === c.medicoId)!;
    // No recetar penicilinas a pacientes alérgicos
    const meds = caso.meds.map((x) => (p.alergias.includes('Penicilina') && x.nombre.startsWith('Amoxicilina') ? M('Azitromicina 500 mg', '1 tableta', 'Cada 24 horas', '3 días') : x));
    const fechaHora = new Date(`${c.fecha}T${c.hora}:00`); fechaHora.setMinutes(fechaHora.getMinutes() + entero(5, 25));
    const extra = (caso.servicios ?? []).filter(() => sucede(0.45));
    const cons: Consulta = {
      id: `cs-${c.id}`, citaId: c.id, pacienteId: p.id, medicoId: m.id, fecha: fechaHora.toISOString(), motivo: caso.motivo, sintomas: caso.sintomas,
      examen: caso.examen, diagnostico: caso.diagnostico, plan: caso.plan, signos: signosPara(p, signosExtra), servicios: extra,
      seguimiento: sucede(0.3) ? fechaISO(new Date(fechaHora.getTime() + entero(14, 40) * 86400000)) : null,
    };
    consultas.push(cons);
    if (meds.length) recetas.push({ id: `rx-${c.id}`, consultaId: cons.id, pacienteId: p.id, medicoId: m.id, fecha: cons.fecha, medicamentos: meds, indicaciones: caso.plan });
    const detalle = [{ concepto: `Consulta de ${especialidad(m.especialidadId).nombre}`, monto: m.precio }, ...extra.map((s) => ({ concepto: precioServicio(s).nombre, monto: precioServicio(s).precio }))];
    const total = detalle.reduce((s, d) => s + d.monto, 0);
    const pago = new Date(fechaHora); pago.setMinutes(pago.getMinutes() + 35);
    cobros.push({
      id: `cb-${c.id}`, citaId: c.id, consultaId: cons.id, pacienteId: p.id, medicoId: m.id, detalle, descuento: 0, total,
      estado: pagado ? 'Pagado' : 'Pendiente', metodo: pagado ? (p.seguro ? 'Seguro' : elegir(['Efectivo', 'Efectivo', 'Tarjeta', 'Tarjeta', 'Transferencia'])) : '',
      fecha: cons.fecha, fechaPago: pagado ? pago.toISOString() : null, recibo: pagado ? `R-${String(recibo++).padStart(6, '0')}` : '', cajeroId: pagado ? 'u-recepcion' : null,
    });
  }

  const nuevaCita = (medicoId: string, pacienteId: string, fecha: string, hora: string, estado: EstadoCita, motivo: string, origen: Cita['origen'] = 'Recepción'): Cita => {
    const c: Cita = { id: `c-${medicoId}-${fecha.replace(/-/g, '')}-${hora.replace(':', '')}`, pacienteId, medicoId, fecha, hora, motivo, estado, origen, llegada: null, creada: new Date(`${fecha}T07:00:00`).toISOString(), nota: '' };
    citas.push(c);
    return c;
  };

  // ---------- Historial del paciente de demostración ----------
  const historialDemo: [number, string, string, Partial<Signos>][] = [
    [-150, 'm1', '08:00', { presion: '148/96', peso: 88 }], [-110, 'm1', '08:30', { presion: '142/92', peso: 87 }],
    [-75, 'm5', '10:00', { presion: '136/88', peso: 86 }], [-40, 'm1', '09:00', { presion: '132/85', peso: 85 }], [-12, 'm1', '08:00', { presion: '126/82', peso: 84 }],
  ];
  historialDemo.forEach(([d, med, hora, sig]) => {
    let f = dia(d);
    const m = medicos.find((x) => x.id === med)!;
    while (!m.dias.includes(diaSemana(f))) f = fechaISO(new Date(new Date(f + 'T12:00:00').getTime() - 86400000));
    const caso = med === 'm5' ? CASOS.car[1] : CASOS.gen[3];
    const c = nuevaCita(med, demo.id, f, hora, 'Atendida', caso.motivo);
    atender(c, caso, d < -20, sig);
  });

  // ---------- Agenda: 21 días atrás y 21 adelante ----------
  for (let d = -21; d <= 21; d++) {
    const f = dia(d);
    const ds = diaSemana(f);
    if (ds === 6) continue; // domingo cerrado
    const ocupadosDia = new Set<string>(citas.filter((c) => c.fecha === f).map((c) => c.pacienteId)); // un paciente, una cita por día
    medicos.forEach((m) => {
      if (!m.dias.includes(ds)) return;
      const lista = horarios(m);
      const ocupacion = d < 0 ? 0.42 : d === 0 ? 0.75 : d <= 3 ? 0.55 : d <= 10 ? 0.32 : 0.14;
      const tomadas = lista.filter((h) => sucede(ocupacion) && !citas.some((c) => c.medicoId === m.id && c.fecha === f && c.hora === h));
      const pool = candidatos(m);
      tomadas.forEach((h) => {
        const libres = pool.filter((x) => !ocupadosDia.has(x.id));
        const p = elegir(libres.length ? libres : pool);
        ocupadosDia.add(p.id);
        const caso = elegir(CASOS[m.especialidadId]);
        if (d < 0) {
          const r = azar();
          const estado: EstadoCita = r < 0.86 ? 'Atendida' : r < 0.94 ? 'Cancelada' : 'No asistió';
          const c = nuevaCita(m.id, p.id, f, h, estado, caso.motivo, sucede(0.25) ? 'En línea' : 'Recepción');
          if (estado === 'Atendida') atender(c, caso, true);
        } else if (d === 0) {
          // Hoy: según la hora (entre 8:30 y 16:30; fuera de ese rango se simula media mañana)
          const minH = Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
          const despues = tomadas.filter((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)) + config.duracionCita > AHORA_MIN);
          const pos = despues.indexOf(h);
          let estado: EstadoCita = minH + config.duracionCita <= AHORA_MIN ? 'Atendida' : 'Confirmada';
          if (m.id === 'm1') { if (pos === 0 || pos === 1) estado = 'En espera'; }
          else if (pos === 0 && minH <= AHORA_MIN) estado = 'En consulta';
          else if (pos >= 0 && pos <= 1 && minH - AHORA_MIN <= 45) estado = 'En espera';
          if (estado === 'Confirmada' && sucede(0.3)) estado = 'Programada';
          const c = nuevaCita(m.id, p.id, f, h, estado, caso.motivo, 'Recepción');
          if (estado === 'Atendida') atender(c, caso, sucede(0.4));
          if (estado === 'En espera' || estado === 'En consulta') { const l = new Date(); l.setMinutes(l.getMinutes() - entero(4, 35)); c.llegada = l.toISOString(); }
        } else {
          const enLinea = d <= 7 && sucede(0.06);
          const estado: EstadoCita = enLinea ? 'Programada' : d <= 2 && sucede(0.6) ? 'Confirmada' : 'Programada';
          const c = nuevaCita(m.id, p.id, f, h, estado, caso.motivo, enLinea ? 'En línea' : 'Recepción');
          c.creada = new Date(Date.now() - entero(1, 72) * 3600000).toISOString();
        }
      });
    });
  }

  // Próxima cita del paciente de demostración (control con su médica)
  let proxima = dia(3);
  while (!medicos[0].dias.includes(diaSemana(proxima))) proxima = fechaISO(new Date(new Date(proxima + 'T12:00:00').getTime() + 86400000));
  const libre = horarios(medicos[0]).find((h) => !citas.some((c) => c.medicoId === 'm1' && c.fecha === proxima && c.hora === h)) ?? '12:30';
  nuevaCita('m1', demo.id, proxima, libre, 'Confirmada', 'Control de presión arterial').creada = new Date(Date.now() - 86400000 * 5).toISOString();

  // ---------- Usuarios ----------
  const colores = ['#0d9488', '#2563eb', '#7c3aed', '#ea580c', '#db2777', '#16a34a', '#0891b2', '#ca8a04', '#4f46e5', '#dc2626'];
  const usuarios: Usuario[] = [
    { id: 'u-admin', usuario: 'admin', clave: '12345', rol: 'admin', refId: null, nombre: 'Mónica Herrera Valdez', cargo: 'Administración', activo: true, color: '#ea580c', ultimoAcceso: new Date(Date.now() - 3600000 * 20).toISOString(), vistoAvisos: null },
    { id: 'u-recepcion', usuario: 'recepcion', clave: '12345', rol: 'recepcion', refId: null, nombre: 'Karla Pérez López', cargo: 'Recepción y caja · mañana', activo: true, color: '#2563eb', ultimoAcceso: new Date(Date.now() - 3600000 * 2).toISOString(), vistoAvisos: null },
    { id: 'u-recepcion2', usuario: 'jorge.cifuentes', clave: '12345', rol: 'recepcion', refId: null, nombre: 'Jorge Cifuentes Paz', cargo: 'Recepción y caja · tarde', activo: true, color: '#0891b2', ultimoAcceso: new Date(Date.now() - 3600000 * 26).toISOString(), vistoAvisos: null },
  ];
  const usados = new Set(usuarios.map((u) => u.usuario));
  const usuarioLibre = (base: string) => { let u = base; let n = 2; while (usados.has(u)) u = `${base}${n++}`; usados.add(u); return u; };
  medicos.forEach((m, i) => {
    const titulo = m.especialidadId === 'nut' ? (m.genero === 'F' ? 'Lcda.' : 'Lic.') : m.genero === 'F' ? 'Dra.' : 'Dr.';
    usuarios.push({
      id: `u-${m.id}`, usuario: i === 0 ? usuarioLibre('medico') : usuarioLibre(`${sinAcentos(m.nombres.split(' ')[0]).toLowerCase()}.${sinAcentos(m.apellidos.split(' ')[0]).toLowerCase()}`),
      clave: '12345', rol: 'medico', refId: m.id, nombre: `${titulo} ${m.nombres} ${m.apellidos}`, cargo: especialidad(m.especialidadId).nombre, activo: true,
      color: especialidad(m.especialidadId).color, ultimoAcceso: new Date(Date.now() - 3600000 * entero(1, 60)).toISOString(), vistoAvisos: null,
    });
  });
  pacientes.slice(0, 30).forEach((p, i) => {
    usuarios.push({
      id: `u-${p.id}`, usuario: i === 0 ? usuarioLibre('paciente') : usuarioLibre(`${sinAcentos(p.nombres.split(' ')[0]).toLowerCase()}.${sinAcentos(p.apellidos.split(' ')[0]).toLowerCase()}`),
      clave: '12345', rol: 'paciente', refId: p.id, nombre: `${p.nombres} ${p.apellidos}`, cargo: '', activo: true, color: i === 0 ? '#7c3aed' : elegir(colores),
      ultimoAcceso: sucede(0.6) || i === 0 ? new Date(Date.now() - 3600000 * entero(3, 400)).toISOString() : null, vistoAvisos: null,
    });
  });

  citas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return { config, especialidades, medicos, pacientes, servicios, citas, consultas, recetas, cobros, usuarios };
}
