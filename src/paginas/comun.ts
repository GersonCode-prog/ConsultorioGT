// ============================================================
//  PIEZAS COMPARTIDAS ENTRE PORTALES
//  citas, pacientes, recetas, recibos, expediente y perfil
// ============================================================
import type { Contexto } from '../lib/app';
import type { Cita, Paciente, Rol, Usuario } from '../lib/tipos';
import { obtener, porId, guardarItem, nuevoId, config } from '../lib/datos';
import {
  ROLES, ESTADOS, medico, paciente, especialidad, nombreCompleto, nombreMedico, nombreMedicoCompleto, textoEdad, medicosActivos,
  horariosDisponibles, trabajaEl, textoHora, horaFin, cambiarEstado, consultasDePaciente, recetasDePaciente, citasDePaciente,
  imc, DIAS_SEMANA, pendienteDeAtender, usuarioDe,
} from '../lib/clinica';
import { avatar, badge, badgeEstado, chipEsp, documentoReceta, documentoRecibo, vacio, tarjeta, graficaLinea } from '../lib/vistas';
import { escapar, fechaLarga, fechaMedia, hoy, coincide, haceTiempo, relativa, parrafos, fechaCorta } from '../lib/formato';
import { icono } from '../lib/iconos';
import { abrirModal, aviso, confirmar, modalFormulario, campo, opciones } from '../lib/ui';
import { ruta } from '../lib/ruta';

// ---------- Documentos ----------
function modalImprimible(titulo: string, html: string) {
  const d = abrirModal({
    titulo, ancho: 'md', cuerpo: html,
    pie: `<button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button><button type="button" class="btn btn-primario" data-imprimir>${icono('imprimir', 16)} Imprimir</button>`,
  });
  d.classList.add('imprimible');
  d.querySelector('[data-imprimir]')!.addEventListener('click', () => window.print());
  return d;
}
export const verReceta = (id: string) => { const r = porId('recetas', id); if (r) modalImprimible('💊 Receta médica', documentoReceta(r)); };
export const verRecibo = (id: string) => {
  const c = porId('cobros', id); if (!c) return;
  modalImprimible(c.estado === 'Pagado' ? '🧾 Recibo de pago' : '🧾 Detalle de cobro', documentoRecibo(c, porId('usuarios', c.cajeroId)?.nombre ?? ''));
};

// ---------- Registro y edición de pacientes ----------
export function formularioPaciente(p: Paciente | undefined, alGuardar: (p: Paciente) => void) {
  modalFormulario({
    titulo: p ? '✏️ Editar paciente' : '🧑 Registrar paciente', ancho: 'lg', textoGuardar: p ? 'Guardar cambios' : 'Registrar paciente',
    campos: `
      ${campo('Nombres *', `<input name="nombres" required value="${escapar(p?.nombres ?? '')}" />`)}
      ${campo('Apellidos *', `<input name="apellidos" required value="${escapar(p?.apellidos ?? '')}" />`)}
      ${campo('Fecha de nacimiento *', `<input name="nacimiento" type="date" required max="${hoy()}" value="${p?.nacimiento ?? ''}" />`)}
      ${campo('Sexo', `<select name="genero">${opciones([{ valor: 'F', texto: 'Femenino' }, { valor: 'M', texto: 'Masculino' }], p?.genero)}</select>`)}
      ${campo('DPI', `<input name="dpi" value="${escapar(p?.dpi ?? '')}" placeholder="0000 00000 0000" />`)}
      ${campo('Teléfono *', `<input name="telefono" required value="${escapar(p?.telefono ?? '')}" placeholder="5555-5555" />`)}
      ${campo('Correo', `<input name="correo" type="email" value="${escapar(p?.correo ?? '')}" />`)}
      ${campo('Tipo de sangre', `<select name="sangre">${opciones(['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((x) => ({ valor: x, texto: x || 'No sabe' })), p?.sangre)}</select>`)}
      ${campo('Dirección', `<input name="direccion" value="${escapar(p?.direccion ?? '')}" />`, 'completo')}
      ${campo('Alergias', `<input name="alergias" value="${escapar(p?.alergias ?? '')}" placeholder="Ninguna conocida" />`)}
      ${campo('Seguro médico', `<input name="seguro" value="${escapar(p?.seguro ?? '')}" placeholder="Particular" />`)}
      ${campo('Antecedentes médicos', `<input name="antecedentes" value="${escapar(p?.antecedentes ?? '')}" placeholder="Enfermedades, cirugías..." />`, 'completo')}
      ${campo('Contacto de emergencia', `<input name="emergenciaNombre" value="${escapar(p?.emergenciaNombre ?? '')}" />`)}
      ${campo('Teléfono de emergencia', `<input name="emergenciaTelefono" value="${escapar(p?.emergenciaTelefono ?? '')}" />`)}`,
    alGuardar: (d) => {
      const n = obtener('pacientes').length + 1;
      const codigo = p?.codigo ?? `P-${String(Math.max(n, ...obtener('pacientes').map((x) => Number(x.codigo.slice(2)) + 1))).padStart(4, '0')}`;
      const nuevo: Paciente = {
        id: p?.id ?? nuevoId('p'), codigo, registrado: p?.registrado ?? hoy(),
        nombres: d.nombres.trim(), apellidos: d.apellidos.trim(), nacimiento: d.nacimiento, genero: d.genero as 'F' | 'M', dpi: d.dpi.trim(),
        telefono: d.telefono.trim(), correo: d.correo.trim(), sangre: d.sangre, direccion: d.direccion.trim(), alergias: d.alergias.trim(),
        seguro: d.seguro.trim(), antecedentes: d.antecedentes.trim(), emergenciaNombre: d.emergenciaNombre.trim(), emergenciaTelefono: d.emergenciaTelefono.trim(),
      };
      guardarItem('pacientes', nuevo);
      const u = usuarioDe('paciente', nuevo.id);
      if (u) guardarItem('usuarios', { ...u, nombre: nombreCompleto(nuevo) });
      aviso(p ? 'Datos del paciente actualizados' : `Paciente registrado · ${codigo}`);
      alGuardar(nuevo);
    },
  });
}

// ---------- Nueva cita / reprogramar ----------
interface OpcionesCita { pacienteId?: string; medicoId?: string; fecha?: string; hora?: string; reprogramar?: Cita; elegirPaciente?: boolean; origen?: Cita['origen']; alGuardar: (c: Cita) => void }

export function modalCita(o: OpcionesCita) {
  const r = o.reprogramar;
  let pacienteId = r?.pacienteId ?? o.pacienteId ?? '';
  let medicoId = r?.medicoId ?? o.medicoId ?? '';
  let fecha = o.fecha ?? (r && r.fecha >= hoy() ? r.fecha : hoy());
  let hora = o.hora ?? '';
  const elegirPaciente = o.elegirPaciente !== false && !r;
  const medicos = medicosActivos();
  const grupos = obtener('especialidades').map((e) => {
    const ms = medicos.filter((m) => m.especialidadId === e.id);
    return ms.length ? `<optgroup label="${escapar(e.icono + ' ' + e.nombre)}">${ms.map((m) => `<option value="${m.id}" ${m.id === medicoId ? 'selected' : ''}>${escapar(nombreMedico(m))}</option>`).join('')}</optgroup>` : '';
  }).join('');

  const d = abrirModal({
    titulo: r ? '🔁 Reprogramar cita' : '📅 Nueva cita', ancho: 'lg',
    cuerpo: `<form class="form-modal" id="form-cita" novalidate>
      ${elegirPaciente ? `<div class="campo completo"><span>Paciente *</span>
        <div class="herramientas"><div class="buscador">${icono('buscar', 18)}<input class="control" id="buscar-pac" placeholder="Buscar por nombre, código o teléfono..." /></div>
        <button type="button" class="btn btn-secundario btn-sm" id="nuevo-pac">${icono('mas', 16)} Nuevo paciente</button></div>
        <select class="control" id="sel-pac" size="4" required></select></div>`
        : `<div class="ayuda">${icono('usuario', 16)} <strong>${escapar(nombreCompleto(paciente(pacienteId)))}</strong>${r ? ` · cita actual: ${fechaMedia(r.fecha)} a las ${textoHora(r.hora)}` : ''}</div>`}
      ${campo('Médico *', `<select name="medico" id="sel-med" required><option value="">Elige un médico...</option>${grupos}</select>`)}
      ${campo('Fecha *', `<input type="date" id="sel-fecha" required min="${hoy()}" value="${fecha}" />`)}
      <div class="campo completo"><span>Horario disponible *</span><div id="slots"></div></div>
      ${campo('Motivo de la consulta', `<input id="motivo" maxlength="120" value="${escapar(r?.motivo ?? '')}" placeholder="Ej. Dolor de garganta, control..." />`, 'completo')}
    </form>`,
    pie: `<button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button type="button" class="btn btn-primario" id="guardar-cita">${icono('check', 18)} ${r ? 'Reprogramar' : 'Agendar cita'}</button>`,
  });
  const $ = <T extends HTMLElement>(s: string) => d.querySelector(s) as T;

  const pintarPacientes = () => {
    const sel = $<HTMLSelectElement>('#sel-pac'); if (!sel) return;
    const q = $<HTMLInputElement>('#buscar-pac').value;
    const lista = obtener('pacientes').filter((p) => !q || coincide(`${nombreCompleto(p)} ${p.codigo} ${p.telefono} ${p.dpi}`, q)).sort((a, b) => a.nombres.localeCompare(b.nombres)).slice(0, 60);
    sel.innerHTML = lista.map((p) => `<option value="${p.id}" ${p.id === pacienteId ? 'selected' : ''}>${escapar(nombreCompleto(p))} · ${p.codigo} · ${escapar(p.telefono)}</option>`).join('');
    if (lista.length === 1) { sel.value = lista[0].id; pacienteId = lista[0].id; }
  };
  const pintarSlots = () => {
    const caja = $('#slots'); const m = medico(medicoId);
    if (!m) { caja.innerHTML = '<p class="stat-nota">Elige un médico para ver sus horarios.</p>'; return; }
    if (!trabajaEl(m, fecha)) { caja.innerHTML = `<div class="alerta azul">${icono('info', 18)}<span>${escapar(nombreMedico(m))} atiende los días ${m.dias.map((x) => DIAS_SEMANA[x].toLowerCase()).join(', ')}.</span></div>`; return; }
    const libres = horariosDisponibles(m, fecha, r?.id);
    if (!libres.includes(hora)) hora = '';
    caja.innerHTML = libres.length ? `<div class="slots">${libres.map((h) => `<button type="button" class="slot ${h === hora ? 'activo' : ''}" data-hora="${h}">${textoHora(h)}</button>`).join('')}</div>`
      : `<div class="alerta">${icono('alerta', 18)}<span>No hay horarios libres ese día. Prueba otra fecha.</span></div>`;
  };
  pintarPacientes(); pintarSlots();

  $<HTMLInputElement>('#buscar-pac')?.addEventListener('input', pintarPacientes);
  $<HTMLSelectElement>('#sel-pac')?.addEventListener('change', (e) => { pacienteId = (e.target as HTMLSelectElement).value; });
  $<HTMLSelectElement>('#sel-med').addEventListener('change', (e) => { medicoId = (e.target as HTMLSelectElement).value; pintarSlots(); });
  $<HTMLInputElement>('#sel-fecha').addEventListener('change', (e) => { fecha = (e.target as HTMLInputElement).value || hoy(); pintarSlots(); });
  $('#slots').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hora]'); if (!b) return;
    hora = b.dataset.hora!; pintarSlots();
  });
  $('#nuevo-pac')?.addEventListener('click', () => {
    d.close();
    formularioPaciente(undefined, (p) => modalCita({ ...o, pacienteId: p.id, medicoId, fecha, hora }));
  });
  $('#guardar-cita').addEventListener('click', () => {
    if (!pacienteId) return aviso('Selecciona un paciente', 'error');
    if (!medicoId) return aviso('Selecciona un médico', 'error');
    if (!hora) return aviso('Selecciona un horario disponible', 'error');
    const motivo = $<HTMLInputElement>('#motivo').value.trim() || 'Consulta';
    const cita: Cita = r
      ? { ...r, medicoId, fecha, hora, motivo, estado: 'Programada', llegada: null, nota: `Reprogramada (antes ${fechaMedia(r.fecha)} ${textoHora(r.hora)})` }
      : { id: nuevoId('c-'), pacienteId, medicoId, fecha, hora, motivo, estado: o.origen === 'En línea' ? 'Programada' : 'Confirmada', origen: o.origen ?? 'Recepción', llegada: null, creada: new Date().toISOString(), nota: '' };
    guardarItem('citas', cita);
    d.close();
    aviso(r ? 'Cita reprogramada ✅' : `Cita agendada · ${relativa(fecha)} a las ${textoHora(hora)} ✅`);
    o.alGuardar(cita);
  });
}

// ---------- Detalle de una cita con sus acciones ----------
export function detalleCita(citaId: string, rol: Rol, alCambiar: () => void) {
  const c = porId('citas', citaId)!;
  const p = paciente(c.pacienteId); const m = medico(c.medicoId);
  const hoyMismo = c.fecha === hoy();
  const acciones: string[] = [];
  if (rol === 'recepcion' || rol === 'admin') {
    if (c.estado === 'Programada') acciones.push(`<button type="button" class="btn btn-suave" data-accion="Confirmada">${icono('check', 16)} Confirmar</button>`);
    if (hoyMismo && (c.estado === 'Programada' || c.estado === 'Confirmada')) acciones.push(`<button type="button" class="btn btn-primario" data-accion="En espera">${icono('sala', 16)} Registrar llegada</button>`);
    if (pendienteDeAtender(c) && c.estado !== 'En consulta') acciones.push(`<button type="button" class="btn btn-secundario" data-reprogramar>${icono('calendario', 16)} Reprogramar</button>`);
    if (hoyMismo && (c.estado === 'Programada' || c.estado === 'Confirmada')) acciones.push(`<button type="button" class="btn btn-secundario" data-accion="No asistió">🚫 No asistió</button>`);
  }
  if (rol === 'medico' && hoyMismo && ['Confirmada', 'Programada', 'En espera', 'En consulta'].includes(c.estado)) acciones.push(`<a class="btn btn-primario" href="${ruta(`/medico/consulta?c=${c.id}`)}">${icono('estetoscopio', 16)} ${c.estado === 'En consulta' ? 'Continuar consulta' : 'Atender'}</a>`);
  if (pendienteDeAtender(c) && c.estado !== 'En consulta' && rol !== 'medico') acciones.push(`<button type="button" class="btn btn-secundario" data-cancelar style="color:var(--rojo)">${icono('cerrar', 16)} Cancelar cita</button>`);
  const consulta = obtener('consultas').find((x) => x.citaId === c.id);
  const receta = consulta && obtener('recetas').find((x) => x.consultaId === consulta.id);
  const cobro = obtener('cobros').find((x) => x.citaId === c.id);

  const d = abrirModal({
    titulo: `${ESTADOS[c.estado].icono} Cita ${c.estado === 'Atendida' ? 'atendida' : ''}`.trim(), ancho: 'md',
    cuerpo: `<div class="ficha-cab">${avatar(nombreCompleto(p), usuarioDe('paciente', c.pacienteId)?.color, 'lg')}
        <div><h3>${escapar(nombreCompleto(p))}</h3><p class="stat-nota">${p?.codigo} · ${p ? textoEdad(p.nacimiento) : ''} · 📞 ${escapar(p?.telefono ?? '')}</p></div><div style="margin-left:auto">${badgeEstado(c.estado)}</div></div>
      ${p?.alergias && rol !== 'paciente' ? `<div class="alergia mb">${icono('alerta', 18)} Alergias: ${escapar(p.alergias)}</div>` : ''}
      <dl class="ficha-datos">
        <div><dt>Fecha</dt><dd>${fechaLarga(c.fecha)}</dd></div><div><dt>Hora</dt><dd>${textoHora(c.hora)} – ${textoHora(horaFin(c.hora))}</dd></div>
        <div><dt>Médico</dt><dd>${escapar(nombreMedicoCompleto(m))}</dd></div><div><dt>Especialidad</dt><dd>${chipEsp(m?.especialidadId)}</dd></div>
        <div><dt>Motivo</dt><dd>${escapar(c.motivo)}</dd></div><div><dt>Lugar</dt><dd>${escapar(m?.consultorio ?? '')}</dd></div>
        <div><dt>Agendada</dt><dd>${c.origen === 'En línea' ? '🌐 En línea' : '🗂️ En recepción'} · ${haceTiempo(c.creada)}</dd></div>
        ${c.llegada ? `<div><dt>Llegó</dt><dd>${new Date(c.llegada).toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit' })}</dd></div>` : ''}
        ${c.nota ? `<div style="grid-column:1/-1"><dt>Nota</dt><dd>${escapar(c.nota)}</dd></div>` : ''}
      </dl>
      ${consulta && rol !== 'recepcion' ? `<div class="alerta verde" style="margin-top:1rem">${icono('check', 18)}<span><strong>Diagnóstico:</strong> ${escapar(consulta.diagnostico)}</span></div>` : ''}
      ${receta || cobro ? `<div class="herramientas" style="margin-top:1rem">${receta && rol !== 'recepcion' ? `<button type="button" class="btn btn-secundario btn-sm" data-receta="${receta.id}">${icono('pildora', 16)} Ver receta</button>` : ''}${cobro ? `<button type="button" class="btn btn-secundario btn-sm" data-recibo="${cobro.id}">${icono('recibo', 16)} ${cobro.estado === 'Pagado' ? 'Ver recibo' : 'Ver cobro pendiente'}</button>` : ''}</div>` : ''}`,
    pie: `<div class="herramientas" style="flex:1">${acciones.join('')}</div><button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button>`,
  });
  d.querySelectorAll<HTMLElement>('[data-accion]').forEach((b) => b.addEventListener('click', () => {
    const e = b.dataset.accion as Cita['estado'];
    cambiarEstado(c.id, e); d.close();
    aviso(e === 'En espera' ? `${p?.nombres.split(' ')[0]} pasó a sala de espera 🪑` : e === 'Confirmada' ? 'Cita confirmada ✅' : 'Marcada como no asistió', e === 'No asistió' ? 'info' : 'exito');
    alCambiar();
  }));
  d.querySelector('[data-reprogramar]')?.addEventListener('click', () => { d.close(); modalCita({ reprogramar: c, alGuardar: alCambiar }); });
  d.querySelector('[data-cancelar]')?.addEventListener('click', async () => {
    d.close();
    if (await confirmar('¿Cancelar esta cita?', `${fechaLarga(c.fecha)} a las ${textoHora(c.hora)} con ${nombreMedico(m)}. El horario quedará libre para otro paciente.`, 'Cancelar cita')) {
      guardarItem('citas', { ...c, estado: 'Cancelada', nota: `Cancelada por ${rol === 'paciente' ? 'el paciente' : 'recepción'}` }); aviso('Cita cancelada', 'info'); alCambiar();
    }
  });
  d.querySelector<HTMLElement>('[data-receta]')?.addEventListener('click', (e) => verReceta((e.currentTarget as HTMLElement).dataset.receta!));
  d.querySelector<HTMLElement>('[data-recibo]')?.addEventListener('click', (e) => verRecibo((e.currentTarget as HTMLElement).dataset.recibo!));
}

// ---------- Expediente clínico (médico) e historial (paciente) ----------
export function expedienteHTML(p: Paciente, modo: 'medico' | 'paciente') {
  const consultas = consultasDePaciente(p.id);
  const ultima = consultas[0];
  const pesoIMC = ultima ? imc(ultima.signos.peso, ultima.signos.talla) : null;
  const conPresion = [...consultas].reverse().filter((c) => /^\d+\/\d+$/.test(c.signos.presion)).slice(-8);
  const grafica = conPresion.length >= 2 ? graficaLinea([
    { nombre: 'Sistólica', color: '#dc2626', valores: conPresion.map((c) => Number(c.signos.presion.split('/')[0])) },
    { nombre: 'Diastólica', color: '#2563eb', valores: conPresion.map((c) => Number(c.signos.presion.split('/')[1])) },
  ], conPresion.map((c) => fechaCorta(c.fecha.slice(0, 10))), 60, 160) : '';
  const recetas = recetasDePaciente(p.id);
  const signo = (et: string, v: string, u = '') => `<div class="signo"><small>${et}</small><strong>${v}</strong> <span>${u}</span></div>`;

  return `
    <div class="grid g-1-2 mb">
      <section class="card"><div class="card-cuerpo">
        <div class="ficha-cab">${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'lg')}<div><h3>${escapar(nombreCompleto(p))}</h3><p class="stat-nota">${p.codigo} · ${textoEdad(p.nacimiento)} · ${p.genero === 'F' ? 'Femenino' : 'Masculino'}</p></div></div>
        ${p.alergias ? `<div class="alergia mb">${icono('alerta', 18)} Alergias: ${escapar(p.alergias)}</div>` : `<div class="alerta verde mb">${icono('check', 18)}<span>Sin alergias conocidas</span></div>`}
        <dl class="ficha-datos">
          <div><dt>Tipo de sangre</dt><dd>${escapar(p.sangre || '—')}</dd></div><div><dt>Seguro</dt><dd>${escapar(p.seguro || 'Particular')}</dd></div>
          <div style="grid-column:1/-1"><dt>Antecedentes</dt><dd>${escapar(p.antecedentes || 'Ninguno registrado')}</dd></div>
          <div><dt>Teléfono</dt><dd>${escapar(p.telefono)}</dd></div><div><dt>Emergencia</dt><dd>${escapar(p.emergenciaNombre || '—')}<br><small class="stat-nota">${escapar(p.emergenciaTelefono)}</small></dd></div>
        </dl>
        ${modo === 'medico' ? `<button type="button" class="btn btn-secundario btn-sm" style="margin-top:1rem" data-editar-clinico>${icono('editar', 16)} Actualizar alergias y antecedentes</button>` : ''}
      </div></section>
      <div class="pila">
        ${ultima ? tarjeta(`${icono('actividad')} Últimos signos vitales`, `<div class="signos">
          ${signo('Presión', ultima.signos.presion || '—', 'mmHg')}${signo('Pulso', String(ultima.signos.pulso ?? '—'), 'lpm')}${signo('Temp.', String(ultima.signos.temperatura ?? '—'), '°C')}
          ${signo('Peso', String(ultima.signos.peso ?? '—'), 'kg')}${signo('Talla', String(ultima.signos.talla ?? '—'), 'cm')}${signo('IMC', pesoIMC ? String(pesoIMC.valor) : '—', pesoIMC?.texto ?? '')}</div>
          <p class="stat-nota" style="margin-top:.6rem">Tomados el ${fechaLarga(ultima.fecha.slice(0, 10))}</p>`) : ''}
        ${grafica ? tarjeta(`${icono('corazon')} Evolución de la presión arterial`, grafica) : ''}
      </div>
    </div>
    <div class="grid g-2-1">
      ${tarjeta(`${icono('expediente')} Historial de consultas <span class="badge">${consultas.length}</span>`, consultas.length ? `<div class="historia">${consultas.map((c) => {
        const m = medico(c.medicoId); const e = especialidad(m?.especialidadId); const rx = recetas.find((r) => r.consultaId === c.id);
        return `<div class="hist-item"><span class="hist-punto" style="--c:${e?.color}">${e?.icono ?? '🩺'}</span><div class="hist-cuerpo">
          <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap"><h4>${escapar(c.diagnostico)}</h4><span class="hist-meta">${fechaMedia(c.fecha.slice(0, 10))}</span></div>
          <p class="hist-meta">${escapar(nombreMedico(m))} · ${escapar(e?.nombre ?? '')}</p>
          <p><strong>Motivo:</strong> ${escapar(c.motivo)}</p>
          ${modo === 'medico' ? `<p><strong>Hallazgos:</strong> ${escapar(c.examen)}</p>` : ''}
          <p><strong>Indicaciones:</strong> ${parrafos(c.plan)}</p>
          <div class="herramientas" style="margin-top:.6rem">${c.signos.presion ? `<span class="badge">❤️ ${escapar(c.signos.presion)}</span>` : ''}${c.signos.peso ? `<span class="badge">⚖️ ${c.signos.peso} kg</span>` : ''}
          ${rx ? `<button type="button" class="btn btn-suave btn-sm" data-receta="${rx.id}">${icono('pildora', 14)} Receta</button>` : ''}${c.seguimiento ? `<span class="badge info">Control: ${fechaMedia(c.seguimiento)}</span>` : ''}</div>
        </div></div>`;
      }).join('')}</div>` : vacio('📂', 'Sin consultas todavía', 'Aquí aparecerá cada consulta atendida.'))}
      ${tarjeta(`${icono('calendario')} Citas`, (() => {
        const lista = citasDePaciente(p.id).filter((c) => c.fecha >= hoy() && pendienteDeAtender(c));
        return lista.length ? `<div class="lista">${lista.map((c) => `<div class="lista-item"><div class="fecha-caja"><b>${Number(c.fecha.slice(8))}</b><span>${fechaCorta(c.fecha).split(' ')[1] ?? ''}</span></div>
          <div class="crece"><strong>${escapar(nombreMedico(medico(c.medicoId)))}</strong><small>${textoHora(c.hora)} · ${relativa(c.fecha)}</small></div>${badgeEstado(c.estado)}</div>`).join('')}</div>` : vacio('🗓️', 'Sin citas próximas');
      })())}
    </div>`;
}

export function enlazarExpediente(raiz: HTMLElement, p: Paciente, alCambiar: () => void) {
  raiz.querySelectorAll<HTMLElement>('[data-receta]').forEach((b) => b.addEventListener('click', () => verReceta(b.dataset.receta!)));
  raiz.querySelector('[data-editar-clinico]')?.addEventListener('click', () => modalFormulario({
    titulo: '🩺 Datos clínicos', ancho: 'md',
    campos: `${campo('Alergias', `<input name="alergias" value="${escapar(p.alergias)}" placeholder="Ninguna conocida" />`, 'completo')}
      ${campo('Antecedentes', `<textarea name="antecedentes" rows="3">${escapar(p.antecedentes)}</textarea>`, 'completo')}
      ${campo('Tipo de sangre', `<select name="sangre">${opciones(['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((x) => ({ valor: x, texto: x || 'No sabe' })), p.sangre)}</select>`)}`,
    alGuardar: (d) => { guardarItem('pacientes', { ...p, alergias: d.alergias.trim(), antecedentes: d.antecedentes.trim(), sangre: d.sangre }); aviso('Expediente actualizado'); alCambiar(); },
  }));
}

// ---------- Mi perfil ----------
export function paginaPerfil(ctx: Contexto) {
  const u = ctx.usuario;
  const colores = ['#0d9488', '#2563eb', '#7c3aed', '#ea580c', '#db2777', '#16a34a', '#0891b2', '#ca8a04', '#4f46e5', '#dc2626', '#334155'];
  const p = ctx.paciente; const m = ctx.medico;
  const datos: [string, string][] = p
    ? [['Código', p.codigo], ['Fecha de nacimiento', `${fechaMedia(p.nacimiento)} (${textoEdad(p.nacimiento)})`], ['Teléfono', p.telefono], ['Correo', p.correo || '—'], ['Dirección', p.direccion || '—'], ['Seguro', p.seguro || 'Particular']]
    : m ? [['Especialidad', especialidad(m.especialidadId)?.nombre ?? ''], ['Colegiado', m.colegiado], ['Consultorio', m.consultorio], ['Horario', `${m.dias.map((x) => DIAS_SEMANA[x].slice(0, 3)).join(', ')} · ${textoHora(m.horaInicio)} – ${textoHora(m.horaFin)}`], ['Teléfono', m.telefono], ['Correo', m.correo]]
    : [['Cargo', u.cargo || ROLES[u.rol].nombre], ['Clínica', config().clinica]];
  ctx.vista.innerHTML = `<div class="grid g-1-2">
    <section class="card"><div class="card-cuerpo" style="text-align:center">
      <div id="avatar-grande" style="display:grid;place-items:center">${avatar(u.nombre, u.color, 'xl')}</div>
      <h3 style="margin-top:.8rem">${escapar(u.nombre)}</h3><p class="stat-nota">@${escapar(u.usuario)}</p>
      <p style="margin:.6rem 0 1rem">${badge(`${ROLES[u.rol].emoji} ${ROLES[u.rol].nombre}`, 'rol')}</p>
      <p class="stat-etiqueta" style="margin-bottom:.5rem">Color de tu avatar</p>
      <div class="chips" style="justify-content:center">${colores.map((c) => `<button type="button" data-color="${c}" title="${c}" style="width:28px;height:28px;border-radius:50%;border:3px solid ${c === u.color ? 'var(--texto)' : '#fff'};background:${c};cursor:pointer;box-shadow:0 0 0 1px var(--borde)"></button>`).join('')}</div>
      <p class="stat-nota" style="margin-top:1rem">Último acceso: ${u.ultimoAcceso ? haceTiempo(u.ultimoAcceso) : '—'}</p>
    </div></section>
    <div class="pila">
      ${tarjeta(`${icono('usuario')} Mi información`, `<dl class="ficha-datos">${datos.map(([a, b]) => `<div><dt>${a}</dt><dd>${escapar(b)}</dd></div>`).join('')}</dl>
        ${p ? `<button type="button" class="btn btn-secundario btn-sm" style="margin-top:1rem" id="editar-datos">${icono('editar', 16)} Actualizar mis datos de contacto</button>` : '<p class="stat-nota" style="margin-top:1rem">¿Algún dato incorrecto? Comunícate con la administración.</p>'}`)}
      ${tarjeta(`${icono('llave')} Cambiar contraseña`, `<form class="form-modal" id="form-clave" novalidate>
        ${campo('Contraseña actual', '<input name="actual" type="password" required autocomplete="current-password" />', 'completo')}
        ${campo('Nueva contraseña', '<input name="nueva" type="password" required minlength="5" autocomplete="new-password" />')}
        ${campo('Confirmar nueva contraseña', '<input name="confirmar" type="password" required minlength="5" autocomplete="new-password" />')}
        <div class="completo"><button type="submit" class="btn btn-primario">${icono('check', 18)} Actualizar contraseña</button></div></form>`)}
    </div></div>`;

  ctx.vista.querySelectorAll<HTMLElement>('[data-color]').forEach((b) => b.addEventListener('click', () => {
    guardarItem('usuarios', { ...u, color: b.dataset.color! } as Usuario); aviso('Color actualizado'); setTimeout(() => location.reload(), 400);
  }));
  ctx.vista.querySelector('#editar-datos')?.addEventListener('click', () => modalFormulario({
    titulo: '📇 Mis datos de contacto', ancho: 'md',
    campos: `${campo('Teléfono *', `<input name="telefono" required value="${escapar(p!.telefono)}" />`)}${campo('Correo', `<input name="correo" type="email" value="${escapar(p!.correo)}" />`)}
      ${campo('Dirección', `<input name="direccion" value="${escapar(p!.direccion)}" />`, 'completo')}
      ${campo('Contacto de emergencia', `<input name="emergenciaNombre" value="${escapar(p!.emergenciaNombre)}" />`)}${campo('Teléfono de emergencia', `<input name="emergenciaTelefono" value="${escapar(p!.emergenciaTelefono)}" />`)}`,
    alGuardar: (d) => { guardarItem('pacientes', { ...p!, telefono: d.telefono.trim(), correo: d.correo.trim(), direccion: d.direccion.trim(), emergenciaNombre: d.emergenciaNombre.trim(), emergenciaTelefono: d.emergenciaTelefono.trim() }); aviso('Datos actualizados'); ctx.refrescar(); },
  }));
  const form = ctx.vista.querySelector<HTMLFormElement>('#form-clave')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const actual = porId('usuarios', u.id)!;
    if (d.actual !== actual.clave) return aviso('La contraseña actual no es correcta', 'error');
    if (d.nueva !== d.confirmar) return aviso('Las contraseñas nuevas no coinciden', 'error');
    guardarItem('usuarios', { ...actual, clave: d.nueva }); form.reset(); aviso('Contraseña actualizada 🔒');
  });
}

