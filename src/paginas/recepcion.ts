// ============================================================
//  PORTAL DE RECEPCIÓN
//  sala de espera · agenda de citas · pacientes · caja
// ============================================================
import type { Contexto } from '../lib/app';
import { parametro } from '../lib/app';
import type { Cita, Cobro } from '../lib/tipos';
import { obtener, porId, guardarItem, config } from '../lib/datos';
import {
  citasDelDia, paciente, medico, nombreCompleto, nombreCorto, nombreMedico, textoHora, minutosEspera, cambiarEstado, colorMedico,
  medicosActivos, trabajaEl, horasClinica, horariosMedico, citaEn, solicitudesEnLinea, cobrosPendientes, siguienteRecibo, especialidad,
  textoEdad, citasDePaciente, cobrosDePaciente, usuarioDe, diaSemana, totalCobrado, activa,
} from '../lib/clinica';
import { avatar, badgeEstado, stat, vacio, botonIcono, chipEsp, badge } from '../lib/vistas';
import { escapar, hoy, fechaLarga, fechaMedia, sumarDias, relativa, coincide, moneda, monedaCorta, haceTiempo, aFecha } from '../lib/formato';
import { icono } from '../lib/iconos';
import { abrirModal, aviso, confirmar, campo, opciones, descargar, aCSV } from '../lib/ui';
import { detalleCita, formularioPaciente, modalCita, verRecibo } from './comun';

const hora12 = (iso: string) => aFecha(iso).toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit' });

// ---------- Cobrar ----------
export function cobrar(cobroId: string, cajeroId: string, alTerminar: () => void) {
  const c = porId('cobros', cobroId)!;
  const p = paciente(c.pacienteId)!;
  const sub = c.detalle.reduce((s, d) => s + d.monto, 0);
  const d = abrirModal({
    titulo: '💵 Cobrar en caja', ancho: 'md',
    cuerpo: `<div class="ficha-cab">${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'md')}<div><h3 style="font-size:1.05rem">${escapar(nombreCompleto(p))}</h3><p class="stat-nota">${p.codigo} · ${escapar(p.seguro || 'Particular')}</p></div></div>
      <table class="tabla mb"><tbody>${c.detalle.map((x) => `<tr><td>${escapar(x.concepto)}</td><td class="derecha">${moneda(x.monto)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Subtotal</td><td class="derecha">${moneda(sub)}</td></tr></tfoot></table>
      <form class="form-modal" id="form-cobro" novalidate>
        ${campo('Forma de pago', `<select name="metodo" id="metodo">${opciones(['Efectivo', 'Tarjeta', 'Transferencia', 'Seguro'].map((x) => ({ valor: x, texto: x })), p.seguro ? 'Seguro' : 'Efectivo')}</select>`)}
        ${campo('Descuento (Q)', `<input name="descuento" id="descuento" type="number" min="0" max="${sub}" step="1" value="0" />`)}
        <div class="campo" id="caja-recibido">${'<span>Efectivo recibido (Q)</span>'}<input id="recibido" type="number" min="0" step="1" placeholder="Opcional" /></div>
        <div class="campo"><span>Total a cobrar</span><strong id="total" style="font-size:1.6rem;color:var(--rol-texto)">${moneda(sub)}</strong><small class="stat-nota" id="cambio"></small></div>
      </form>`,
    pie: `<button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button type="button" class="btn btn-exito" id="confirmar-cobro">${icono('check', 18)} Registrar pago</button>`,
  });
  const $ = <T extends HTMLElement>(s: string) => d.querySelector(s) as T;
  const total = () => Math.max(0, sub - (Number($<HTMLInputElement>('#descuento').value) || 0));
  const actualizar = () => {
    $('#total').textContent = moneda(total());
    const efectivo = $<HTMLSelectElement>('#metodo').value === 'Efectivo';
    $('#caja-recibido').hidden = !efectivo;
    const rec = Number($<HTMLInputElement>('#recibido').value);
    $('#cambio').textContent = efectivo && rec ? (rec >= total() ? `Cambio: ${moneda(rec - total())}` : `Faltan ${moneda(total() - rec)}`) : '';
  };
  ['#metodo', '#descuento', '#recibido'].forEach((s) => $(s).addEventListener('input', actualizar));
  actualizar();
  $('#confirmar-cobro').addEventListener('click', () => {
    const desc = Number($<HTMLInputElement>('#descuento').value) || 0;
    if (desc < 0 || desc > sub) return aviso('El descuento no es válido', 'error');
    const rec = Number($<HTMLInputElement>('#recibido').value);
    if ($<HTMLSelectElement>('#metodo').value === 'Efectivo' && rec && rec < total()) return aviso('El efectivo recibido no alcanza', 'error');
    const pagado: Cobro = { ...c, descuento: desc, total: total(), estado: 'Pagado', metodo: $<HTMLSelectElement>('#metodo').value as Cobro['metodo'], fechaPago: new Date().toISOString(), recibo: siguienteRecibo(), cajeroId };
    guardarItem('cobros', pagado);
    d.close(); aviso(`Pago registrado · ${pagado.recibo} ✅`);
    alTerminar(); verRecibo(pagado.id);
  });
}

// ---------- Sala de espera (inicio) ----------
export function inicioRecepcion(ctx: Contexto) {
  let filtro = '';
  const pintar = () => {
    const todas = citasDelDia(hoy()).filter((c) => activa(c));
    const citas = todas.filter((c) => !filtro || c.medicoId === filtro);
    const porLlegar = citas.filter((c) => c.estado === 'Programada' || c.estado === 'Confirmada');
    const espera = citas.filter((c) => c.estado === 'En espera').sort((a, b) => (a.llegada ?? '').localeCompare(b.llegada ?? ''));
    const consulta = citas.filter((c) => c.estado === 'En consulta');
    const atendidas = citas.filter((c) => c.estado === 'Atendida').reverse();
    const pend = cobrosPendientes();
    const medicosHoy = medicosActivos().filter((m) => trabajaEl(m, hoy()) || todas.some((c) => c.medicoId === m.id));
    const ficha = (c: Cita, accion: string) => {
      const p = paciente(c.pacienteId); const m = medico(c.medicoId);
      return `<div class="sala-ficha" style="--c:${colorMedico(m)}">
        <div class="sala-ficha-cab">${avatar(nombreCompleto(p), usuarioDe('paciente', c.pacienteId)?.color, 'sm')}<div style="min-width:0"><strong>${escapar(nombreCorto(p))}</strong><small>${escapar(nombreMedico(m))}</small></div><span class="hora-chip">${textoHora(c.hora)}</span></div>
        ${c.estado === 'En espera' ? `<span class="espera" style="color:${minutosEspera(c) >= 20 ? 'var(--rojo)' : ''}">⏱️ ${minutosEspera(c)} min esperando · llegó ${hora12(c.llegada!).replace(/\s?[ap]\. ?m\./, '')}</span>` : ''}
        ${c.estado === 'En consulta' ? `<span class="stat-nota">🚪 ${escapar(m?.consultorio ?? '')}</span>` : ''}
        ${accion}</div>`;
    };
    const columna = (titulo: string, lista: Cita[], contenido: (c: Cita) => string, vacioTxt: string) =>
      `<div class="sala-col"><h3>${titulo}<span>${lista.length}</span></h3>${lista.length ? lista.map(contenido).join('') : `<p class="stat-nota" style="text-align:center;padding:1rem 0">${vacioTxt}</p>`}</div>`;

    ctx.vista.innerHTML = `
      <div class="grid g4 mb">
        ${stat({ icono: '🗓️', etiqueta: 'Citas de hoy', valor: String(todas.length), nota: `${medicosHoy.length} médicos atendiendo` })}
        ${stat({ icono: '🪑', etiqueta: 'En sala de espera', valor: String(todas.filter((c) => c.estado === 'En espera').length), nota: `${todas.filter((c) => c.estado === 'Programada' || c.estado === 'Confirmada').length} por llegar`, tono: 'ambar' })}
        ${stat({ icono: '✅', etiqueta: 'Atendidos', valor: String(todas.filter((c) => c.estado === 'Atendida').length), nota: `${todas.filter((c) => c.estado === 'En consulta').length} en consulta ahora`, tono: 'verde' })}
        ${stat({ icono: '💵', etiqueta: 'Por cobrar en caja', valor: monedaCorta(pend.reduce((s, c) => s + c.total, 0)), nota: `${pend.length} pacientes`, tono: 'morado' })}
      </div>
      <section class="card">
        <div class="card-cabecera"><h2>${icono('sala')} Sala de espera · ${fechaLarga(hoy())}</h2>
          <div class="herramientas"><button type="button" class="btn btn-secundario btn-sm" id="nuevo-pac">${icono('usuario', 16)} Registrar paciente</button><button type="button" class="btn btn-primario btn-sm" id="nueva">${icono('mas', 16)} Nueva cita</button></div></div>
        <div class="card-cuerpo">
          <div class="chips mb"><button type="button" class="chip ${filtro ? '' : 'activo'}" data-filtro="">Todos <span class="cuenta">${todas.length}</span></button>
            ${medicosHoy.map((m) => `<button type="button" class="chip ${filtro === m.id ? 'activo' : ''}" data-filtro="${m.id}">${especialidad(m.especialidadId)?.icono} ${escapar(nombreMedico(m))} <span class="cuenta">${todas.filter((c) => c.medicoId === m.id).length}</span></button>`).join('')}</div>
          <div class="sala">
            ${columna('Por llegar', porLlegar, (c) => ficha(c, `<button type="button" class="btn btn-primario btn-sm" data-llego="${c.id}">${icono('check', 15)} Llegó</button>`), 'Todos llegaron 🎉')}
            ${columna('En sala de espera', espera, (c) => ficha(c, `<button type="button" class="btn btn-secundario btn-sm" data-ver="${c.id}">Ver cita</button>`), 'Nadie esperando')}
            ${columna('En consulta', consulta, (c) => ficha(c, ''), 'Consultorios libres')}
            ${columna('Atendidos', atendidas, (c) => {
              const cb = obtener('cobros').find((x) => x.citaId === c.id);
              return ficha(c, cb?.estado === 'Pendiente' ? `<button type="button" class="btn btn-exito btn-sm" data-cobrar="${cb.id}">${icono('caja', 15)} Cobrar ${monedaCorta(cb.total)}</button>` : cb ? `<span class="badge ok">Pagado · ${escapar(cb.recibo)}</span>` : '');
            }, 'Aún no hay atendidos')}
          </div>
        </div>
      </section>`;

    ctx.vista.querySelectorAll<HTMLElement>('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.filtro!; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-llego]').forEach((b) => b.addEventListener('click', () => {
      const c = porId('citas', b.dataset.llego)!; cambiarEstado(c.id, 'En espera');
      aviso(`${nombreCorto(paciente(c.pacienteId))} pasó a sala de espera 🪑`); pintar();
    }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => detalleCita(b.dataset.ver!, 'recepcion', pintar)));
    ctx.vista.querySelectorAll<HTMLElement>('[data-cobrar]').forEach((b) => b.addEventListener('click', () => cobrar(b.dataset.cobrar!, ctx.usuario.id, pintar)));
    ctx.vista.querySelector('#nueva')!.addEventListener('click', () => modalCita({ alGuardar: pintar }));
    ctx.vista.querySelector('#nuevo-pac')!.addEventListener('click', () => formularioPaciente(undefined, () => pintar()));
  };
  pintar();
  // Actualiza los minutos de espera cada minuto (si no hay ventanas abiertas)
  const t = setInterval(() => { if (!document.body.contains(ctx.vista)) clearInterval(t); else if (!document.querySelector('dialog[open]')) pintar(); }, 60000);
}

// ---------- Agenda de citas ----------
export function citasRecepcion(ctx: Contexto) {
  let fecha = hoy();
  let pestana = parametro('ver') === 'solicitudes' ? 'solicitudes' : 'agenda';
  const pintar = () => {
    const sol = solicitudesEnLinea();
    const tabs = `<div class="tabs"><button type="button" class="tab ${pestana === 'agenda' ? 'activo' : ''}" data-tab="agenda">📅 Agenda del día</button>
      <button type="button" class="tab ${pestana === 'solicitudes' ? 'activo' : ''}" data-tab="solicitudes">🌐 Pedidas en línea ${sol.length ? badge(String(sol.length), 'warn') : ''}</button></div>`;
    if (pestana === 'solicitudes') {
      ctx.vista.innerHTML = `${tabs}<section class="card"><div class="card-cabecera"><h2>${icono('calendario')} Citas pedidas por pacientes en línea</h2><span class="stat-nota">Llama al paciente y confirma su asistencia</span></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Paciente</th><th>Fecha y hora</th><th>Médico</th><th>Motivo</th><th>Pedida</th><th></th></tr></thead>
        <tbody>${sol.map((c) => { const p = paciente(c.pacienteId); const m = medico(c.medicoId); return `<tr>
          <td><div class="persona">${avatar(nombreCompleto(p), usuarioDe('paciente', c.pacienteId)?.color, 'sm')}<div><strong>${escapar(nombreCompleto(p))}</strong><small>📞 ${escapar(p?.telefono ?? '')}</small></div></div></td>
          <td><strong style="display:block">${relativa(c.fecha)}</strong><small class="stat-nota">${fechaMedia(c.fecha)} · ${textoHora(c.hora)}</small></td>
          <td>${escapar(nombreMedico(m))}<br>${chipEsp(m?.especialidadId)}</td><td>${escapar(c.motivo)}</td><td><small>${haceTiempo(c.creada)}</small></td>
          <td><div class="acciones"><button type="button" class="btn btn-primario btn-sm" data-confirmar="${c.id}">${icono('check', 15)} Confirmar</button>${botonIcono('ojo', 'Ver', `data-cita="${c.id}"`)}</div></td></tr>`; }).join('') || `<tr><td colspan="6">${vacio('✅', 'No hay solicitudes pendientes')}</td></tr>`}</tbody></table></div></div></section>`;
    } else {
      const medicos = medicosActivos().filter((m) => trabajaEl(m, fecha) || citasDelDia(fecha, m.id).some(activa));
      const horas = horasClinica();
      const del = citasDelDia(fecha);
      ctx.vista.innerHTML = `${tabs}
        <section class="card mb"><div class="card-cuerpo herramientas" style="justify-content:space-between">
          <div class="herramientas">${botonIcono('izquierda', 'Día anterior', 'data-mover="-1"', 'borde')}<button type="button" class="btn btn-secundario btn-sm" data-hoy>Hoy</button>${botonIcono('derecha', 'Día siguiente', 'data-mover="1"', 'borde')}
            <input type="date" class="control" id="fecha" value="${fecha}" style="width:auto" /><strong>${fechaLarga(fecha)}</strong></div>
          <div class="herramientas"><span class="stat-nota">${del.filter(activa).length} citas · ${del.filter((c) => c.estado === 'Cancelada').length} canceladas</span>
          <button type="button" class="btn btn-primario btn-sm" id="nueva">${icono('mas', 16)} Nueva cita</button></div></div></section>
        <section class="card">${medicos.length ? `<div class="tabla-scroll" style="max-height:70vh;overflow:auto"><div class="agenda" style="--cols:${medicos.length}">
          <div class="agenda-fila cab"><div class="agenda-hora"></div>${medicos.map((m) => `<div class="agenda-medico">${avatar(nombreMedico(m), colorMedico(m), 'xs')}<div><strong>${escapar(nombreMedico(m))}</strong><small>${especialidad(m.especialidadId)?.icono} ${escapar(especialidad(m.especialidadId)?.nombre ?? '')}</small></div></div>`).join('')}</div>
          ${horas.map((h) => `<div class="agenda-fila"><div class="agenda-hora">${textoHora(h)}</div>${medicos.map((m) => {
            const c = citaEn(m.id, fecha, h) ?? del.find((x) => x.medicoId === m.id && x.hora === h);
            if (c) { const p = paciente(c.pacienteId); return `<div class="agenda-celda"><button type="button" class="cita-blq ${c.estado === 'Cancelada' ? 'cancelada' : ''}" style="--c:${colorMedico(m)}" data-cita="${c.id}"><strong>${escapar(nombreCorto(p))}</strong><small>${escapar(c.estado)}${c.origen === 'En línea' ? ' · 🌐' : ''}</small></button></div>`; }
            const disponible = trabajaEl(m, fecha) && horariosMedico(m).includes(h) && fecha >= hoy();
            return `<div class="agenda-celda">${disponible ? `<button type="button" class="agenda-libre" data-libre="${m.id}|${h}">+ Agendar</button>` : '<div class="agenda-cerrado"></div>'}</div>`;
          }).join('')}</div>`).join('')}
        </div></div>` : vacio('🌴', 'Ningún médico atiende este día', 'La clínica no tiene consultas programadas.')}</section>`;
      ctx.vista.querySelectorAll<HTMLElement>('[data-mover]').forEach((b) => b.addEventListener('click', () => { fecha = sumarDias(fecha, Number(b.dataset.mover)); if (diaSemana(fecha) === 6) fecha = sumarDias(fecha, Number(b.dataset.mover)); pintar(); }));
      ctx.vista.querySelector('[data-hoy]')!.addEventListener('click', () => { fecha = hoy(); pintar(); });
      ctx.vista.querySelector<HTMLInputElement>('#fecha')!.addEventListener('change', (e) => { fecha = (e.target as HTMLInputElement).value || hoy(); pintar(); });
      ctx.vista.querySelectorAll<HTMLElement>('[data-libre]').forEach((b) => b.addEventListener('click', () => {
        const [medicoId, h] = b.dataset.libre!.split('|'); modalCita({ medicoId, fecha, hora: h, alGuardar: pintar });
      }));
      ctx.vista.querySelector('#nueva')!.addEventListener('click', () => modalCita({ fecha: fecha >= hoy() ? fecha : hoy(), alGuardar: (c) => { fecha = c.fecha; pintar(); } }));
    }
    ctx.vista.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.tab!; history.replaceState(null, '', pestana === 'solicitudes' ? '?ver=solicitudes' : location.pathname); pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-cita]').forEach((b) => b.addEventListener('click', () => detalleCita(b.dataset.cita!, 'recepcion', pintar)));
    ctx.vista.querySelectorAll<HTMLElement>('[data-confirmar]').forEach((b) => b.addEventListener('click', () => { cambiarEstado(b.dataset.confirmar!, 'Confirmada'); aviso('Cita confirmada ✅'); pintar(); }));
  };
  pintar();
}

// ---------- Pacientes ----------
export function fichaRecepcion(pid: string, alCambiar: () => void) {
  const p = paciente(pid)!;
  const citas = citasDePaciente(pid).reverse();
  const cobros = cobrosDePaciente(pid);
  const pendiente = cobros.filter((c) => c.estado === 'Pendiente').reduce((s, c) => s + c.total, 0);
  const d = abrirModal({
    titulo: '🧑 Ficha del paciente', ancho: 'lg',
    cuerpo: `<div class="ficha-cab">${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'lg')}<div><h3>${escapar(nombreCompleto(p))}</h3><p class="stat-nota">${p.codigo} · ${textoEdad(p.nacimiento)} · Registrado ${fechaMedia(p.registrado)}</p></div>
        <div style="margin-left:auto" class="herramientas">${usuarioDe('paciente', p.id) ? badge('🌐 Usa el portal', 'info') : ''}${pendiente ? badge(`Saldo ${monedaCorta(pendiente)}`, 'warn') : badge('Al día', 'ok')}</div></div>
      ${p.alergias ? `<div class="alergia mb">${icono('alerta', 18)} Alergias: ${escapar(p.alergias)}</div>` : ''}
      <dl class="ficha-datos mb"><div><dt>DPI</dt><dd class="mono">${escapar(p.dpi || '—')}</dd></div><div><dt>Teléfono</dt><dd>${escapar(p.telefono)}</dd></div>
        <div><dt>Correo</dt><dd>${escapar(p.correo || '—')}</dd></div><div><dt>Seguro</dt><dd>${escapar(p.seguro || 'Particular')}</dd></div>
        <div><dt>Dirección</dt><dd>${escapar(p.direccion || '—')}</dd></div><div><dt>Emergencia</dt><dd>${escapar(p.emergenciaNombre || '—')} · ${escapar(p.emergenciaTelefono)}</dd></div></dl>
      <div class="tabs"><button type="button" class="tab activo" data-panel="citas">Citas (${citas.length})</button><button type="button" class="tab" data-panel="cobros">Cobros (${cobros.length})</button></div>
      <div data-contenido="citas"><table class="tabla"><tbody>${citas.slice(0, 12).map((c) => `<tr><td>${fechaMedia(c.fecha)} · ${textoHora(c.hora)}</td><td>${escapar(nombreMedico(medico(c.medicoId)))}</td><td>${badgeEstado(c.estado)}</td></tr>`).join('') || `<tr><td>${vacio('🗓️', 'Sin citas')}</td></tr>`}</tbody></table></div>
      <div data-contenido="cobros" hidden><table class="tabla"><tbody>${cobros.slice(0, 12).map((c) => `<tr><td>${fechaMedia(c.fecha.slice(0, 10))}</td><td>${escapar(c.detalle[0]?.concepto ?? '')}</td><td class="derecha">${moneda(c.total)}</td><td>${badge(c.estado, c.estado === 'Pagado' ? 'ok' : c.estado === 'Pendiente' ? 'warn' : 'bad')}</td></tr>`).join('') || `<tr><td>${vacio('🧾', 'Sin cobros')}</td></tr>`}</tbody></table></div>`,
    pie: `<button type="button" class="btn btn-secundario" id="editar">${icono('editar', 16)} Editar datos</button><button type="button" class="btn btn-primario" id="agendar">${icono('calendario', 16)} Agendar cita</button>`,
  });
  d.querySelectorAll<HTMLElement>('[data-panel]').forEach((t) => t.addEventListener('click', () => {
    d.querySelectorAll('[data-panel]').forEach((x) => x.classList.toggle('activo', x === t));
    d.querySelectorAll<HTMLElement>('[data-contenido]').forEach((x) => { x.hidden = x.dataset.contenido !== t.dataset.panel; });
  }));
  d.querySelector('#editar')!.addEventListener('click', () => { d.close(); formularioPaciente(p, () => alCambiar()); });
  d.querySelector('#agendar')!.addEventListener('click', () => { d.close(); modalCita({ pacienteId: p.id, elegirPaciente: false, alGuardar: alCambiar }); });
}

export function pacientesRecepcion(ctx: Contexto) {
  let busqueda = '';
  const pintar = () => {
    const todos = obtener('pacientes');
    const lista = todos.filter((p) => !busqueda || coincide(`${nombreCompleto(p)} ${p.codigo} ${p.telefono} ${p.dpi}`, busqueda)).sort((a, b) => b.codigo.localeCompare(a.codigo));
    ctx.vista.innerHTML = `
      <div class="grid g4 mb">
        ${stat({ icono: '🧑', etiqueta: 'Pacientes registrados', valor: String(todos.length) })}
        ${stat({ icono: '🆕', etiqueta: 'Nuevos este mes', valor: String(todos.filter((p) => p.registrado.slice(0, 7) === hoy().slice(0, 7)).length), tono: 'verde' })}
        ${stat({ icono: '🛡️', etiqueta: 'Con seguro médico', valor: String(todos.filter((p) => p.seguro).length), tono: 'azul' })}
        ${stat({ icono: '🌐', etiqueta: 'Usan el portal', valor: String(obtener('usuarios').filter((u) => u.rol === 'paciente').length), tono: 'morado' })}
      </div>
      <section class="card">
        <div class="card-cabecera"><div class="buscador">${icono('buscar', 18)}<input class="control" id="buscar" placeholder="Buscar por nombre, código, teléfono o DPI..." value="${escapar(busqueda)}" /></div>
          <button type="button" class="btn btn-primario btn-sm" id="nuevo">${icono('mas', 16)} Registrar paciente</button></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Paciente</th><th>Edad</th><th>Teléfono</th><th>Seguro</th><th>Próxima cita</th><th></th></tr></thead>
          <tbody>${lista.slice(0, 100).map((p) => {
            const prox = citasDePaciente(p.id).find((c) => c.fecha >= hoy() && ['Programada', 'Confirmada'].includes(c.estado));
            return `<tr><td><div class="persona">${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'sm')}<div><strong>${escapar(nombreCompleto(p))}</strong><small class="mono">${p.codigo}</small></div></div></td>
              <td>${textoEdad(p.nacimiento)}</td><td>${escapar(p.telefono)}</td><td>${p.seguro ? badge(p.seguro, 'info') : '<span class="stat-nota">Particular</span>'}</td>
              <td>${prox ? `<small>${relativa(prox.fecha)} · ${textoHora(prox.hora)}<br><span class="stat-nota">${escapar(nombreMedico(medico(prox.medicoId)))}</span></small>` : '<span class="stat-nota">—</span>'}</td>
              <td><div class="acciones">${botonIcono('calendario', 'Agendar cita', `data-agendar="${p.id}"`)}${botonIcono('ojo', 'Ver ficha', `data-ficha="${p.id}"`)}</div></td></tr>`;
          }).join('') || `<tr><td colspan="6">${vacio('🔍', 'Sin resultados', 'Prueba con otro nombre o registra al paciente.')}</td></tr>`}</tbody></table></div></div>
      </section>`;
    const b = ctx.vista.querySelector<HTMLInputElement>('#buscar')!;
    b.addEventListener('input', () => { busqueda = b.value; pintar(); const n = ctx.vista.querySelector<HTMLInputElement>('#buscar')!; n.focus(); n.setSelectionRange(busqueda.length, busqueda.length); });
    ctx.vista.querySelector('#nuevo')!.addEventListener('click', () => formularioPaciente(undefined, (p) => { busqueda = p.codigo; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-ficha]').forEach((x) => x.addEventListener('click', () => fichaRecepcion(x.dataset.ficha!, pintar)));
    ctx.vista.querySelectorAll<HTMLElement>('[data-agendar]').forEach((x) => x.addEventListener('click', () => modalCita({ pacienteId: x.dataset.agendar!, elegirPaciente: false, alGuardar: pintar })));
  };
  pintar();
}

// ---------- Caja ----------
export function cajaRecepcion(ctx: Contexto) {
  const pintar = () => {
    const pend = cobrosPendientes();
    const deHoy = obtener('cobros').filter((c) => c.estado !== 'Pendiente' && (c.fechaPago ?? c.fecha).slice(0, 10) === hoy()).sort((a, b) => (b.fechaPago ?? '').localeCompare(a.fechaPago ?? ''));
    const pagadosHoy = deHoy.filter((c) => c.estado === 'Pagado');
    const metodos = ['Efectivo', 'Tarjeta', 'Transferencia', 'Seguro'] as const;
    const porMetodo = metodos.map((m) => ({ m, total: pagadosHoy.filter((c) => c.metodo === m).reduce((s, c) => s + c.total, 0) }));
    ctx.vista.innerHTML = `
      <div class="grid g4 mb">
        ${stat({ icono: '💰', etiqueta: 'Cobrado hoy', valor: monedaCorta(totalCobrado(pagadosHoy)), nota: `${pagadosHoy.length} pagos`, tono: 'verde' })}
        ${stat({ icono: '⏳', etiqueta: 'Pendiente de cobro', valor: monedaCorta(pend.reduce((s, c) => s + c.total, 0)), nota: `${pend.length} pacientes`, tono: 'ambar' })}
        ${stat({ icono: '💵', etiqueta: 'Efectivo en caja', valor: monedaCorta(porMetodo[0].total), nota: 'Para el corte del día' })}
        ${stat({ icono: '💳', etiqueta: 'Tarjeta y transferencia', valor: monedaCorta(porMetodo[1].total + porMetodo[2].total), nota: `Seguros: ${monedaCorta(porMetodo[3].total)}`, tono: 'azul' })}
      </div>
      <section class="card mb"><div class="card-cabecera"><h2>${icono('caja')} Pendientes de cobro</h2><span class="stat-nota">Se generan al terminar cada consulta</span></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Paciente</th><th>Atendido por</th><th>Detalle</th><th>Desde</th><th class="derecha">Total</th><th></th></tr></thead>
        <tbody>${pend.map((c) => { const p = paciente(c.pacienteId); return `<tr>
          <td><div class="persona">${avatar(nombreCompleto(p), usuarioDe('paciente', c.pacienteId)?.color, 'sm')}<div><strong>${escapar(nombreCompleto(p))}</strong><small>${escapar(p?.seguro || 'Particular')}</small></div></div></td>
          <td>${escapar(nombreMedico(medico(c.medicoId)))}</td><td><small>${c.detalle.map((d) => escapar(d.concepto)).join(' · ')}</small></td>
          <td><small>${c.fecha.slice(0, 10) === hoy() ? `Hoy ${hora12(c.fecha)}` : relativa(c.fecha.slice(0, 10))}</small></td>
          <td class="derecha"><strong>${moneda(c.total)}</strong></td>
          <td class="derecha"><button type="button" class="btn btn-exito btn-sm" data-cobrar="${c.id}">${icono('check', 15)} Cobrar</button></td></tr>`; }).join('') || `<tr><td colspan="6">${vacio('🎉', 'No hay cobros pendientes')}</td></tr>`}</tbody></table></div></div></section>
      <section class="card"><div class="card-cabecera"><h2>${icono('recibo')} Movimientos de hoy</h2>
        <div class="herramientas"><button type="button" class="btn btn-secundario btn-sm" id="csv">${icono('descargar', 16)} CSV</button><button type="button" class="btn btn-primario btn-sm" id="corte">${icono('imprimir', 16)} Corte de caja</button></div></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Recibo</th><th>Hora</th><th>Paciente</th><th>Forma de pago</th><th class="derecha">Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>${deHoy.map((c) => `<tr><td class="mono">${escapar(c.recibo || '—')}</td><td>${c.fechaPago ? hora12(c.fechaPago) : '—'}</td><td>${escapar(nombreCompleto(paciente(c.pacienteId)))}</td>
          <td>${escapar(c.metodo || '—')}</td><td class="derecha">${moneda(c.total)}</td><td>${badge(c.estado, c.estado === 'Pagado' ? 'ok' : 'bad')}</td>
          <td><div class="acciones">${botonIcono('recibo', 'Ver recibo', `data-recibo="${c.id}"`)}${c.estado === 'Pagado' ? botonIcono('cerrar', 'Anular', `data-anular="${c.id}"`, 'peligro') : ''}</div></td></tr>`).join('') || `<tr><td colspan="7">${vacio('🧾', 'Todavía no hay pagos hoy')}</td></tr>`}</tbody></table></div></div></section>`;

    ctx.vista.querySelectorAll<HTMLElement>('[data-cobrar]').forEach((b) => b.addEventListener('click', () => cobrar(b.dataset.cobrar!, ctx.usuario.id, pintar)));
    ctx.vista.querySelectorAll<HTMLElement>('[data-recibo]').forEach((b) => b.addEventListener('click', () => verRecibo(b.dataset.recibo!)));
    ctx.vista.querySelectorAll<HTMLElement>('[data-anular]').forEach((b) => b.addEventListener('click', async () => {
      const c = porId('cobros', b.dataset.anular)!;
      if (await confirmar('¿Anular este pago?', `Recibo ${c.recibo} por ${moneda(c.total)}. El cobro volverá a quedar pendiente.`, 'Anular pago')) {
        guardarItem('cobros', { ...c, estado: 'Pendiente', metodo: '', fechaPago: null, recibo: '', cajeroId: null }); aviso('Pago anulado; el cobro quedó pendiente', 'info'); pintar();
      }
    }));
    ctx.vista.querySelector('#csv')!.addEventListener('click', () => descargar(`caja-${hoy()}.csv`, aCSV([['Recibo', 'Hora', 'Paciente', 'Forma de pago', 'Total', 'Estado'],
      ...deHoy.map((c) => [c.recibo, c.fechaPago ? hora12(c.fechaPago) : '', nombreCompleto(paciente(c.pacienteId)), c.metodo, c.total, c.estado])]), 'text/csv'));
    ctx.vista.querySelector('#corte')!.addEventListener('click', () => {
      const cfg = config();
      const d = abrirModal({
        titulo: '🧮 Corte de caja', ancho: 'sm',
        cuerpo: `<div class="documento"><div class="doc-cab"><div><h4>🏥 ${escapar(cfg.clinica)}</h4><p>Corte de caja · ${fechaLarga(hoy())}</p><p>Cajero: ${escapar(ctx.usuario.nombre)}</p></div></div>
          <table class="tabla"><tbody>${porMetodo.map((x) => `<tr><td>${x.m}</td><td class="derecha">${moneda(x.total)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td><strong>Total cobrado</strong></td><td class="derecha"><strong>${moneda(totalCobrado(pagadosHoy))}</strong></td></tr><tr><td>Pagos registrados</td><td class="derecha">${pagadosHoy.length}</td></tr><tr><td>Pendiente de cobro</td><td class="derecha">${moneda(pend.reduce((s, c) => s + c.total, 0))}</td></tr></tfoot></table>
          <div class="doc-firma"><div>Firma del cajero</div></div></div>`,
        pie: `<button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button><button type="button" class="btn btn-primario" data-imprimir>${icono('imprimir', 16)} Imprimir</button>`,
      });
      d.classList.add('imprimible');
      d.querySelector('[data-imprimir]')!.addEventListener('click', () => window.print());
    });
  };
  pintar();
}

