// ============================================================
//  PORTAL ADMINISTRATIVO
//  panel · médicos · especialidades y precios · reportes · usuarios · configuración
// ============================================================
import type { Contexto } from '../lib/app';
import type { Cita, Cobro, Especialidad, Medico, Rol, Servicio, Usuario } from '../lib/tipos';
import {
  obtener, porId, guardarItem, eliminarItem, nuevoId, config, guardarConfig, exportarTodo, importarTodo, restablecerDatos, espacioUsado,
} from '../lib/datos';
import {
  ROLES, especialidad, medico, paciente, nombreCompleto, nombreMedico, nombreMedicoCompleto, colorMedico, textoHora, horariosMedico,
  trabajaEl, citasDelDia, activa, totalCobrado, cobrosPendientes, DIAS_SEMANA, DIAS_CORTOS, usuarioDe, tituloDe,
} from '../lib/clinica';
import { stat, tarjeta, vacio, badge, avatar, graficaBarras, barrasH, dona, botonIcono, chipEsp } from '../lib/vistas';
import { escapar, coincide, fechaMedia, moneda, monedaCorta, haceTiempo, hoy, fechaLarga, sumarDias, fechaCorta, sinAcentos } from '../lib/formato';
import { icono } from '../lib/iconos';
import { aviso, confirmar, modalFormulario, campo, opciones, descargar, aCSV } from '../lib/ui';
import { verRecibo } from './comun';

const fechaCobro = (c: Cobro) => (c.fechaPago ?? c.fecha).slice(0, 10);
const enRango = (f: string, desde: string, hasta: string) => f >= desde && f <= hasta;

// ---------- Panel ----------
export function inicioAdmin(ctx: Contexto) {
  const cfg = config();
  const cobros = obtener('cobros').filter((c) => c.estado === 'Pagado');
  const mes = hoy().slice(0, 7);
  const ingresosMes = cobros.filter((c) => fechaCobro(c).startsWith(mes)).reduce((s, c) => s + c.total, 0);
  const citasMes = obtener('citas').filter((c) => c.fecha.startsWith(mes));
  const pasadas = obtener('citas').filter((c) => c.fecha < hoy() && c.fecha >= sumarDias(hoy(), -30));
  const faltas = pasadas.filter((c) => c.estado === 'No asistió' || c.estado === 'Cancelada').length;
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy(), i - 13));
  const porDia = dias.map((f) => cobros.filter((c) => fechaCobro(c) === f).reduce((s, c) => s + c.total, 0));
  const ult30 = cobros.filter((c) => fechaCobro(c) >= sumarDias(hoy(), -30));
  const porMedico = obtener('medicos').map((m) => ({ m, v: ult30.filter((c) => c.medicoId === m.id).reduce((s, c) => s + c.total, 0) })).sort((a, b) => b.v - a.v);
  const porEsp = obtener('especialidades').map((e) => ({ e, n: citasMes.filter((c) => activa(c) && medico(c.medicoId)?.especialidadId === e.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const hoyCitas = citasDelDia(hoy()).filter(activa);
  const ocupacion = obtener('medicos').filter((m) => trabajaEl(m, hoy())).map((m) => {
    const cupos = horariosMedico(m).length; const n = hoyCitas.filter((c) => c.medicoId === m.id).length;
    return { m, pct: cupos ? Math.round((n / cupos) * 100) : 0, n, cupos };
  }).sort((a, b) => b.pct - a.pct);
  const pend = cobrosPendientes();
  const pacientesNuevos = obtener('pacientes').filter((p) => p.registrado.startsWith(mes)).length;

  ctx.vista.innerHTML = `
    <div class="hero">
      <div><h2>Panel de ${escapar(cfg.clinica)} 🏥</h2><p>${fechaLarga(hoy())}</p>
        <div class="hero-chips"><span>🩺 ${obtener('medicos').filter((m) => m.activo).length} médicos</span><span>🧑 ${obtener('pacientes').length} pacientes</span><span>📅 ${hoyCitas.length} citas hoy</span></div></div>
    </div>
    <div class="grid g4 mb">
      ${stat({ icono: '💰', etiqueta: 'Ingresos del mes', valor: monedaCorta(ingresosMes), nota: `Hoy: ${monedaCorta(porDia[13])}`, tono: 'verde' })}
      ${stat({ icono: '📅', etiqueta: 'Citas del mes', valor: String(citasMes.filter(activa).length), nota: `${citasMes.filter((c) => c.origen === 'En línea').length} pedidas en línea`, tono: 'azul' })}
      ${stat({ icono: '⏳', etiqueta: 'Por cobrar', valor: monedaCorta(pend.reduce((s, c) => s + c.total, 0)), nota: `${pend.length} cobros pendientes`, tono: 'ambar' })}
      ${stat({ icono: '🚫', etiqueta: 'Inasistencia (30 días)', valor: `${pasadas.length ? Math.round((faltas / pasadas.length) * 100) : 0}%`, nota: `${faltas} canceladas o ausentes · ${pacientesNuevos} pacientes nuevos`, tono: 'rojo' })}
    </div>
    <div class="grid g-2-1 mb">
      ${tarjeta(`${icono('grafica')} Ingresos de los últimos 14 días`, graficaBarras(dias.map((f, i) => ({ etiqueta: `${DIAS_CORTOS[(new Date(f + 'T12:00:00').getDay() + 6) % 7]} ${Number(f.slice(8))}`, valor: porDia[i], texto: porDia[i] ? `Q${(porDia[i] / 1000).toFixed(1)}k` : '—', color: f === hoy() ? 'var(--rol)' : 'var(--rol-2)' })), Math.max(...porDia, 1)))}
      ${tarjeta(`${icono('estetoscopio')} Citas del mes por especialidad`, porEsp.length ? dona(porEsp.map((x) => ({ etiqueta: `${x.e.icono} ${x.e.nombre}`, valor: x.n, color: x.e.color })), String(porEsp.reduce((s, x) => s + x.n, 0)), 'citas') : vacio('📊', 'Sin datos'))}
    </div>
    <div class="grid g2">
      ${tarjeta(`${icono('pagos')} Ingresos por médico · 30 días`, barrasH(porMedico.map(({ m, v }) => ({ etiqueta: nombreMedico(m), valor: v, color: colorMedico(m), texto: monedaCorta(v), icono: especialidad(m.especialidadId)?.icono }))))}
      ${tarjeta(`${icono('calendario')} Ocupación de hoy`, ocupacion.length ? barrasH(ocupacion.map(({ m, pct, n, cupos }) => ({ etiqueta: nombreMedico(m), valor: pct, max: 100, color: pct >= 80 ? '#dc2626' : pct >= 50 ? '#d97706' : '#16a34a', texto: `${n}/${cupos} · ${pct}%`, icono: especialidad(m.especialidadId)?.icono }))) : vacio('🌴', 'Hoy no hay consulta'))}
    </div>`;
}

// ---------- Médicos ----------
function formularioMedico(m: Medico | undefined, alGuardar: () => void) {
  const esps = obtener('especialidades');
  modalFormulario({
    titulo: m ? `✏️ ${escapar(nombreMedicoCompleto(m))}` : '🩺 Nuevo médico', ancho: 'lg', textoGuardar: m ? 'Guardar cambios' : 'Agregar médico',
    campos: `
      ${campo('Nombres *', `<input name="nombres" required value="${escapar(m?.nombres ?? '')}" />`)}${campo('Apellidos *', `<input name="apellidos" required value="${escapar(m?.apellidos ?? '')}" />`)}
      ${campo('Sexo', `<select name="genero">${opciones([{ valor: 'F', texto: 'Femenino (Dra.)' }, { valor: 'M', texto: 'Masculino (Dr.)' }], m?.genero)}</select>`)}
      ${campo('Especialidad *', `<select name="especialidadId" required>${opciones(esps.map((e) => ({ valor: e.id, texto: `${e.icono} ${e.nombre}` })), m?.especialidadId)}</select>`)}
      ${campo('No. de colegiado *', `<input name="colegiado" required value="${escapar(m?.colegiado ?? '')}" />`)}${campo('Consultorio', `<input name="consultorio" value="${escapar(m?.consultorio ?? '')}" placeholder="Consultorio 1" />`)}
      <div class="campo completo"><span>Días de consulta *</span><div class="chips">${DIAS_SEMANA.slice(0, 6).map((d, i) => `<label class="chip"><input type="checkbox" name="dia" value="${i}" ${m?.dias.includes(i) ?? i < 5 ? 'checked' : ''} style="accent-color:var(--rol)" /> ${d}</label>`).join('')}</div></div>
      ${campo('Hora de inicio *', `<input name="horaInicio" type="time" required step="900" value="${m?.horaInicio ?? '08:00'}" />`)}${campo('Hora de fin *', `<input name="horaFin" type="time" required step="900" value="${m?.horaFin ?? '13:00'}" />`)}
      ${campo('Precio de consulta (Q) *', `<input name="precio" type="number" min="0" required value="${m?.precio ?? 250}" />`)}${campo('Teléfono', `<input name="telefono" value="${escapar(m?.telefono ?? '')}" />`)}
      ${campo('Correo', `<input name="correo" type="email" value="${escapar(m?.correo ?? '')}" />`, 'completo')}
      ${campo('Presentación (se muestra a los pacientes)', `<textarea name="bio" rows="2">${escapar(m?.bio ?? '')}</textarea>`, 'completo')}
      ${!m ? '<div class="ayuda">Se creará su usuario de acceso con la contraseña inicial 12345.</div>' : ''}`,
    alGuardar: (d, form) => {
      const dias = [...form.querySelectorAll<HTMLInputElement>('[name="dia"]:checked')].map((x) => Number(x.value));
      if (!dias.length) { aviso('Elige al menos un día de consulta', 'error'); return false; }
      if (d.horaFin <= d.horaInicio) { aviso('La hora de fin debe ser después de la hora de inicio', 'error'); return false; }
      const nuevo: Medico = {
        id: m?.id ?? nuevoId('m'), activo: m?.activo ?? true, nombres: d.nombres.trim(), apellidos: d.apellidos.trim(), genero: d.genero as 'F' | 'M',
        especialidadId: d.especialidadId, colegiado: d.colegiado.trim(), consultorio: d.consultorio.trim(), dias, horaInicio: d.horaInicio, horaFin: d.horaFin,
        precio: Number(d.precio), telefono: d.telefono.trim(), correo: d.correo.trim(), bio: d.bio.trim(),
      };
      guardarItem('medicos', nuevo);
      const u = usuarioDe('medico', nuevo.id);
      const nombre = `${tituloDe(nuevo)} ${nombreCompleto(nuevo)}`;
      if (u) guardarItem('usuarios', { ...u, nombre, cargo: especialidad(nuevo.especialidadId)?.nombre ?? '' });
      else {
        let base = `${sinAcentos(nuevo.nombres.split(' ')[0]).toLowerCase()}.${sinAcentos(nuevo.apellidos.split(' ')[0]).toLowerCase()}`; let usuario = base; let n = 2;
        while (obtener('usuarios').some((x) => x.usuario === usuario)) usuario = `${base}${n++}`;
        guardarItem('usuarios', { id: `u-${nuevo.id}`, usuario, clave: '12345', rol: 'medico', refId: nuevo.id, nombre, cargo: especialidad(nuevo.especialidadId)?.nombre ?? '', activo: true, color: especialidad(nuevo.especialidadId)?.color ?? '#0d9488', ultimoAcceso: null, vistoAvisos: null });
        aviso(`Usuario creado: @${usuario} (clave 12345)`);
      }
      aviso(m ? 'Médico actualizado' : 'Médico agregado ✅'); alGuardar();
    },
  });
}

export function medicosAdmin(ctx: Contexto) {
  let busqueda = '';
  const pintar = () => {
    const mes = hoy().slice(0, 7);
    const lista = obtener('medicos').filter((m) => !busqueda || coincide(`${nombreCompleto(m)} ${especialidad(m.especialidadId)?.nombre}`, busqueda))
      .sort((a, b) => Number(b.activo) - Number(a.activo) || (especialidad(a.especialidadId)?.nombre ?? '').localeCompare(especialidad(b.especialidadId)?.nombre ?? ''));
    ctx.vista.innerHTML = `
      <div class="herramientas mb"><div class="buscador">${icono('buscar', 18)}<input class="control" id="buscar" placeholder="Buscar médico o especialidad..." value="${escapar(busqueda)}" /></div>
        <button type="button" class="btn btn-primario" id="nuevo">${icono('mas', 18)} Agregar médico</button></div>
      <div class="grid g-auto">${lista.map((m) => {
        const citas = obtener('citas').filter((c) => c.medicoId === m.id && c.fecha.startsWith(mes) && activa(c)).length;
        const ingresos = obtener('cobros').filter((c) => c.medicoId === m.id && c.estado === 'Pagado' && fechaCobro(c).startsWith(mes)).reduce((s, c) => s + c.total, 0);
        const u = usuarioDe('medico', m.id);
        return `<div class="mini-card" style="--c:${colorMedico(m)};${m.activo ? '' : 'opacity:.6'}">
          <div class="mini-card-cab">${avatar(nombreMedico(m), colorMedico(m), 'md')}<div style="flex:1;min-width:0"><strong>${escapar(nombreMedicoCompleto(m))}</strong><small>${chipEsp(m.especialidadId)}</small></div>${m.activo ? '' : badge('Inactivo', 'bad')}</div>
          <dl class="ficha-datos" style="font-size:.84rem"><div><dt>Horario</dt><dd>${m.dias.map((d) => DIAS_CORTOS[d]).join(', ')}<br><small class="stat-nota">${textoHora(m.horaInicio)} – ${textoHora(m.horaFin)}</small></dd></div>
            <div><dt>Consulta</dt><dd>${moneda(m.precio)}<br><small class="stat-nota">${escapar(m.consultorio)}</small></dd></div>
            <div><dt>Citas del mes</dt><dd>${citas}</dd></div><div><dt>Ingresos del mes</dt><dd>${monedaCorta(ingresos)}</dd></div></dl>
          <div class="mini-card-pie"><span class="stat-nota mono">${u ? `@${escapar(u.usuario)}` : 'Sin usuario'} · Col. ${escapar(m.colegiado)}</span>
            <div class="acciones">${botonIcono('editar', 'Editar', `data-editar="${m.id}"`)}${botonIcono(m.activo ? 'cerrar' : 'check', m.activo ? 'Desactivar' : 'Activar', `data-activo="${m.id}"`, m.activo ? 'peligro' : '')}</div></div></div>`;
      }).join('') || vacio('🔍', 'Sin resultados')}</div>`;
    const b = ctx.vista.querySelector<HTMLInputElement>('#buscar')!;
    b.addEventListener('input', () => { busqueda = b.value; pintar(); const n = ctx.vista.querySelector<HTMLInputElement>('#buscar')!; n.focus(); n.setSelectionRange(busqueda.length, busqueda.length); });
    ctx.vista.querySelector('#nuevo')!.addEventListener('click', () => formularioMedico(undefined, pintar));
    ctx.vista.querySelectorAll<HTMLElement>('[data-editar]').forEach((x) => x.addEventListener('click', () => formularioMedico(medico(x.dataset.editar), pintar)));
    ctx.vista.querySelectorAll<HTMLElement>('[data-activo]').forEach((x) => x.addEventListener('click', async () => {
      const m = medico(x.dataset.activo)!;
      const futuras = obtener('citas').filter((c) => c.medicoId === m.id && c.fecha >= hoy() && ['Programada', 'Confirmada'].includes(c.estado)).length;
      if (m.activo && !(await confirmar(`¿Desactivar a ${nombreMedico(m)}?`, futuras ? `Tiene ${futuras} citas próximas que deberás reprogramar. Ya no aparecerá para agendar.` : 'Ya no aparecerá para agendar citas.', 'Desactivar'))) return;
      guardarItem('medicos', { ...m, activo: !m.activo });
      const u = usuarioDe('medico', m.id); if (u) guardarItem('usuarios', { ...u, activo: !m.activo });
      aviso(m.activo ? 'Médico desactivado' : 'Médico activado', m.activo ? 'info' : 'exito'); pintar();
    }));
  };
  pintar();
}

// ---------- Especialidades y servicios ----------
export function serviciosAdmin(ctx: Contexto) {
  const pintar = () => {
    const esps = obtener('especialidades');
    const servs = [...obtener('servicios')].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre));
    ctx.vista.innerHTML = `
      <section class="card mb"><div class="card-cabecera"><h2>${icono('estetoscopio')} Especialidades</h2><button type="button" class="btn btn-primario btn-sm" id="nueva-esp">${icono('mas', 16)} Nueva especialidad</button></div>
        <div class="card-cuerpo"><div class="grid g-auto">${esps.map((e) => {
          const ms = obtener('medicos').filter((m) => m.especialidadId === e.id && m.activo);
          return `<div class="mini-card" style="--c:${e.color}"><div class="mini-card-cab"><span class="icono-caja" style="--c:${e.color}">${e.icono}</span><div style="flex:1"><strong>${escapar(e.nombre)}</strong><small>${ms.length} médico(s) · ${ms.length ? `desde ${monedaCorta(Math.min(...ms.map((m) => m.precio)))}` : 'sin médicos'}</small></div>${botonIcono('editar', 'Editar', `data-esp="${e.id}"`)}</div>
            <p class="stat-nota">${escapar(e.descripcion)}</p></div>`;
        }).join('')}</div></div></section>
      <section class="card"><div class="card-cabecera"><h2>${icono('recibo')} Servicios y precios</h2><button type="button" class="btn btn-primario btn-sm" id="nuevo-serv">${icono('mas', 16)} Nuevo servicio</button></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Servicio</th><th>Tipo</th><th>Especialidad</th><th class="derecha">Precio</th><th class="centro">Usado (30 días)</th><th></th></tr></thead>
        <tbody>${servs.map((s) => {
          const usos = obtener('consultas').filter((c) => c.servicios.includes(s.id) && c.fecha.slice(0, 10) >= sumarDias(hoy(), -30)).length;
          return `<tr><td><strong>${escapar(s.nombre)}</strong></td><td>${badge(s.tipo, s.tipo === 'Laboratorio' ? 'info' : s.tipo === 'Imagen' ? 'morado' : 'neutral')}</td>
            <td>${s.especialidadId ? chipEsp(s.especialidadId) : '<span class="stat-nota">Todas</span>'}</td><td class="derecha"><strong>${moneda(s.precio)}</strong></td><td class="centro">${usos}</td>
            <td><div class="acciones">${botonIcono('editar', 'Editar', `data-serv="${s.id}"`)}${botonIcono('borrar', 'Eliminar', `data-borrar="${s.id}"`, 'peligro')}</div></td></tr>`;
        }).join('')}</tbody></table></div></div>
        <div class="card-cuerpo"><p class="stat-nota">💡 El precio de la consulta se configura en cada médico. Los servicios los agrega el médico al terminar la consulta y se cobran en caja.</p></div></section>`;

    const formEsp = (e?: Especialidad) => modalFormulario({
      titulo: e ? '✏️ Especialidad' : '🩺 Nueva especialidad', ancho: 'md',
      campos: `${campo('Nombre *', `<input name="nombre" required value="${escapar(e?.nombre ?? '')}" />`)}${campo('Emoji', `<input name="icono" maxlength="4" value="${escapar(e?.icono ?? '🩺')}" />`)}
        ${campo('Color', `<input name="color" type="color" value="${e?.color ?? '#0d9488'}" style="height:44px" />`)}
        ${campo('Descripción', `<textarea name="descripcion" rows="2">${escapar(e?.descripcion ?? '')}</textarea>`, 'completo')}`,
      alGuardar: (d) => { guardarItem('especialidades', { id: e?.id ?? nuevoId('e'), nombre: d.nombre.trim(), icono: d.icono.trim() || '🩺', color: d.color, descripcion: d.descripcion.trim() }); aviso('Especialidad guardada'); pintar(); },
    });
    const formServ = (s?: Servicio) => modalFormulario({
      titulo: s ? '✏️ Servicio' : '➕ Nuevo servicio', ancho: 'md',
      campos: `${campo('Nombre *', `<input name="nombre" required value="${escapar(s?.nombre ?? '')}" />`, 'completo')}
        ${campo('Tipo', `<select name="tipo">${opciones(['Procedimiento', 'Laboratorio', 'Imagen', 'Consulta'].map((x) => ({ valor: x, texto: x })), s?.tipo)}</select>`)}
        ${campo('Precio (Q) *', `<input name="precio" type="number" min="0" required value="${s?.precio ?? ''}" />`)}
        ${campo('Especialidad', `<select name="especialidadId"><option value="">Todas las especialidades</option>${opciones(obtener('especialidades').map((e) => ({ valor: e.id, texto: `${e.icono} ${e.nombre}` })), s?.especialidadId ?? '')}</select>`, 'completo')}`,
      alGuardar: (d) => { guardarItem('servicios', { id: s?.id ?? nuevoId('s-'), nombre: d.nombre.trim(), tipo: d.tipo as Servicio['tipo'], precio: Number(d.precio), especialidadId: d.especialidadId || null }); aviso('Servicio guardado'); pintar(); },
    });
    ctx.vista.querySelector('#nueva-esp')!.addEventListener('click', () => formEsp());
    ctx.vista.querySelector('#nuevo-serv')!.addEventListener('click', () => formServ());
    ctx.vista.querySelectorAll<HTMLElement>('[data-esp]').forEach((x) => x.addEventListener('click', () => formEsp(especialidad(x.dataset.esp))));
    ctx.vista.querySelectorAll<HTMLElement>('[data-serv]').forEach((x) => x.addEventListener('click', () => formServ(porId('servicios', x.dataset.serv))));
    ctx.vista.querySelectorAll<HTMLElement>('[data-borrar]').forEach((x) => x.addEventListener('click', async () => {
      if (await confirmar('¿Eliminar servicio?', 'Los cobros anteriores no cambian.')) { eliminarItem('servicios', x.dataset.borrar!); aviso('Servicio eliminado'); pintar(); }
    }));
  };
  pintar();
}

// ---------- Reportes ----------
export function reportesAdmin(ctx: Contexto) {
  let periodo = '30'; let pestana = 'ingresos';
  const pintar = () => {
    const hasta = hoy(); const desde = periodo === 'hoy' ? hoy() : sumarDias(hoy(), -(Number(periodo) - 1));
    const cobros = obtener('cobros').filter((c) => c.estado === 'Pagado' && enRango(fechaCobro(c), desde, hasta));
    const citas = obtener('citas').filter((c) => enRango(c.fecha, desde, hasta));
    const consultas = obtener('consultas').filter((c) => enRango(c.fecha.slice(0, 10), desde, hasta));
    const total = totalCobrado(cobros);
    let contenido = ''; let filasCSV: (string | number)[][] = [];

    if (pestana === 'ingresos') {
      const porMedico = obtener('medicos').map((m) => { const cs = cobros.filter((c) => c.medicoId === m.id); return { m, n: cs.length, v: cs.reduce((s, c) => s + c.total, 0) }; }).filter((x) => x.n).sort((a, b) => b.v - a.v);
      const metodos = ['Efectivo', 'Tarjeta', 'Transferencia', 'Seguro'].map((m) => ({ m, v: cobros.filter((c) => c.metodo === m).reduce((s, c) => s + c.total, 0) }));
      const conceptos = new Map<string, number>(); cobros.forEach((c) => c.detalle.forEach((d) => { const k = d.concepto.startsWith('Consulta') ? d.concepto : d.concepto; conceptos.set(k, (conceptos.get(k) ?? 0) + d.monto); }));
      const topConceptos = [...conceptos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      contenido = `<div class="grid g-2-1 mb">
        <section class="card"><div class="card-cabecera"><h2>${icono('estetoscopio')} Ingresos por médico</h2></div><div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Médico</th><th class="centro">Pagos</th><th class="derecha">Ingresos</th><th class="derecha">Promedio</th><th class="derecha">%</th></tr></thead>
          <tbody>${porMedico.map(({ m, n, v }) => `<tr><td><div class="persona">${avatar(nombreMedico(m), colorMedico(m), 'xs')}<div><strong>${escapar(nombreMedico(m))}</strong><small>${escapar(especialidad(m.especialidadId)?.nombre ?? '')}</small></div></div></td>
            <td class="centro">${n}</td><td class="derecha"><strong>${moneda(v)}</strong></td><td class="derecha">${moneda(v / n)}</td><td class="derecha">${total ? Math.round((v / total) * 100) : 0}%</td></tr>`).join('') || `<tr><td colspan="5">${vacio('📊', 'Sin ingresos en este periodo')}</td></tr>`}</tbody>
          <tfoot><tr><td><strong>Total</strong></td><td class="centro">${cobros.length}</td><td class="derecha"><strong>${moneda(total)}</strong></td><td class="derecha">${cobros.length ? moneda(total / cobros.length) : '—'}</td><td></td></tr></tfoot></table></div></div></section>
        ${tarjeta(`${icono('caja')} Por forma de pago`, dona(metodos.filter((x) => x.v).map((x, i) => ({ etiqueta: x.m, valor: Math.round(x.v), color: ['#16a34a', '#2563eb', '#7c3aed', '#ea580c'][i] })), monedaCorta(total).replace('Q ', 'Q'), 'cobrado'))}
      </div>
      ${tarjeta(`${icono('recibo')} Lo que más se cobra`, barrasH(topConceptos.map(([k, v]) => ({ etiqueta: k, valor: v, texto: monedaCorta(v) }))))}`;
      filasCSV = [['Recibo', 'Fecha de pago', 'Paciente', 'Médico', 'Conceptos', 'Forma de pago', 'Descuento', 'Total'],
        ...cobros.map((c) => [c.recibo, fechaCobro(c), nombreCompleto(paciente(c.pacienteId)), nombreMedico(medico(c.medicoId)), c.detalle.map((d) => d.concepto).join(' + '), c.metodo, c.descuento, c.total])];
    } else if (pestana === 'citas') {
      const estados = (['Atendida', 'Programada', 'Confirmada', 'En espera', 'En consulta', 'Cancelada', 'No asistió'] as Cita['estado'][]).map((e) => ({ e, n: citas.filter((c) => c.estado === e).length })).filter((x) => x.n);
      const porEsp = obtener('especialidades').map((e) => ({ e, n: citas.filter((c) => activa(c) && medico(c.medicoId)?.especialidadId === e.id).length })).sort((a, b) => b.n - a.n);
      const dx = new Map<string, number>(); consultas.forEach((c) => dx.set(c.diagnostico, (dx.get(c.diagnostico) ?? 0) + 1));
      const enLinea = citas.filter((c) => c.origen === 'En línea').length;
      contenido = `<div class="grid g3 mb">
        ${stat({ icono: '📅', etiqueta: 'Citas en el periodo', valor: String(citas.length), nota: `${citas.filter(activa).length} válidas` })}
        ${stat({ icono: '🌐', etiqueta: 'Agendadas en línea', valor: `${citas.length ? Math.round((enLinea / citas.length) * 100) : 0}%`, nota: `${enLinea} citas`, tono: 'morado' })}
        ${stat({ icono: '👥', etiqueta: 'Pacientes atendidos', valor: String(new Set(consultas.map((c) => c.pacienteId)).size), nota: `${consultas.length} consultas`, tono: 'verde' })}
      </div><div class="grid g2 mb">
        ${tarjeta('📌 Por estado', dona(estados.map((x) => ({ etiqueta: x.e, valor: x.n, color: { Atendida: '#16a34a', Programada: '#2563eb', Confirmada: '#0d9488', 'En espera': '#d97706', 'En consulta': '#7c3aed', Cancelada: '#dc2626', 'No asistió': '#64748b' }[x.e] })), String(citas.length), 'citas'))}
        ${tarjeta(`${icono('estetoscopio')} Por especialidad`, barrasH(porEsp.filter((x) => x.n).map((x) => ({ etiqueta: x.e.nombre, valor: x.n, color: x.e.color, icono: x.e.icono }))))}
      </div>
      ${tarjeta('🩻 Diagnósticos más frecuentes', barrasH([...dx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ etiqueta: k, valor: n }))))}`;
      filasCSV = [['Fecha', 'Hora', 'Paciente', 'Médico', 'Especialidad', 'Motivo', 'Estado', 'Origen'],
        ...citas.map((c) => [c.fecha, c.hora, nombreCompleto(paciente(c.pacienteId)), nombreMedico(medico(c.medicoId)), especialidad(medico(c.medicoId)?.especialidadId)?.nombre ?? '', c.motivo, c.estado, c.origen])];
    } else {
      const pend = cobrosPendientes();
      contenido = `<section class="card"><div class="card-cabecera"><h2>${icono('reloj')} Cobros pendientes</h2><strong>${moneda(pend.reduce((s, c) => s + c.total, 0))}</strong></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Desde</th><th>Paciente</th><th>Médico</th><th class="derecha">Total</th><th></th></tr></thead>
        <tbody>${pend.map((c) => `<tr><td>${fechaMedia(c.fecha.slice(0, 10))}</td><td>${escapar(nombreCompleto(paciente(c.pacienteId)))}<br><small class="stat-nota">📞 ${escapar(paciente(c.pacienteId)?.telefono ?? '')}</small></td><td>${escapar(nombreMedico(medico(c.medicoId)))}</td>
          <td class="derecha"><strong>${moneda(c.total)}</strong></td><td class="derecha">${botonIcono('recibo', 'Ver detalle', `data-recibo="${c.id}"`)}</td></tr>`).join('') || `<tr><td colspan="5">${vacio('🎉', 'No hay cobros pendientes')}</td></tr>`}</tbody></table></div></div></section>`;
      filasCSV = [['Fecha', 'Paciente', 'Teléfono', 'Médico', 'Total'], ...pend.map((c) => [c.fecha.slice(0, 10), nombreCompleto(paciente(c.pacienteId)), paciente(c.pacienteId)?.telefono ?? '', nombreMedico(medico(c.medicoId)), c.total])];
    }

    ctx.vista.innerHTML = `
      <div class="herramientas mb" style="justify-content:space-between">
        <div class="segmentado">${[['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(([v, t]) => `<button type="button" class="${periodo === v ? 'activo' : ''}" data-periodo="${v}">${t}</button>`).join('')}</div>
        <div class="herramientas"><span class="stat-nota">${desde === hasta ? fechaMedia(desde) : `${fechaCorta(desde)} – ${fechaCorta(hasta)}`} · Cobrado ${moneda(total)}</span>
        <button type="button" class="btn btn-secundario btn-sm" id="csv">${icono('descargar', 16)} Descargar CSV</button></div></div>
      <div class="tabs">${[['ingresos', '💰 Ingresos'], ['citas', '📅 Citas y diagnósticos'], ['pendientes', `⏳ Pendientes de cobro (${cobrosPendientes().length})`]].map(([v, t]) => `<button type="button" class="tab ${pestana === v ? 'activo' : ''}" data-tab="${v}">${t}</button>`).join('')}</div>
      ${contenido}`;
    ctx.vista.querySelectorAll<HTMLElement>('[data-periodo]').forEach((b) => b.addEventListener('click', () => { periodo = b.dataset.periodo!; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.tab!; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-recibo]').forEach((b) => b.addEventListener('click', () => verRecibo(b.dataset.recibo!)));
    ctx.vista.querySelector('#csv')!.addEventListener('click', () => descargar(`reporte-${pestana}-${hoy()}.csv`, aCSV(filasCSV), 'text/csv'));
  };
  pintar();
}

// ---------- Usuarios ----------
export function usuariosAdmin(ctx: Contexto) {
  let busqueda = ''; let rolF: Rol | '' = '';
  const pintar = () => {
    const todos = obtener('usuarios');
    const orden = Object.keys(ROLES);
    const lista = todos.filter((u) => (!rolF || u.rol === rolF) && (!busqueda || coincide(`${u.nombre} ${u.usuario}`, busqueda)))
      .sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol) || a.nombre.localeCompare(b.nombre));
    ctx.vista.innerHTML = `
      <div class="grid g4 mb">${(Object.keys(ROLES) as Rol[]).map((r) => `
        <button type="button" class="card stat" data-rol="${r}" style="cursor:pointer;text-align:left;font:inherit;${rolF === r ? `box-shadow:0 0 0 2px ${ROLES[r].color}` : ''}">
          <span class="stat-icono" style="background:color-mix(in srgb, ${ROLES[r].color} 12%, white);color:${ROLES[r].color}">${ROLES[r].emoji}</span>
          <div><p class="stat-etiqueta">${ROLES[r].nombre}</p><p class="stat-valor">${todos.filter((u) => u.rol === r).length}</p></div></button>`).join('')}</div>
      <section class="card">
        <div class="card-cabecera"><div class="herramientas" style="flex:1"><div class="buscador">${icono('buscar', 18)}<input class="control" id="buscar" placeholder="Buscar por nombre o usuario..." value="${escapar(busqueda)}" /></div>
          ${rolF ? `<button type="button" class="chip activo" id="quitar-rol">${ROLES[rolF].nombre} ✕</button>` : ''}</div>
          <button type="button" class="btn btn-primario btn-sm" id="nuevo">${icono('mas', 16)} Nuevo usuario</button></div>
        <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Detalle</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
          <tbody>${lista.map((u) => `<tr><td><div class="persona">${avatar(u.nombre, u.color, 'sm')}<div><strong>${escapar(u.nombre)}</strong><small class="mono">@${escapar(u.usuario)}</small></div></div></td>
            <td><span class="badge" style="background:color-mix(in srgb, ${ROLES[u.rol].color} 12%, white);color:${ROLES[u.rol].color}">${ROLES[u.rol].emoji} ${ROLES[u.rol].nombre}</span></td>
            <td><small>${escapar(u.rol === 'paciente' ? paciente(u.refId)?.codigo ?? '' : u.cargo || '—')}</small></td><td><small>${u.ultimoAcceso ? haceTiempo(u.ultimoAcceso) : 'Nunca'}</small></td>
            <td>${u.id === ctx.usuario.id ? badge('Tú', 'rol') : `<label class="check"><input type="checkbox" data-activo="${u.id}" ${u.activo ? 'checked' : ''} /> ${u.activo ? 'Activo' : 'Inactivo'}</label>`}</td>
            <td><div class="acciones">${botonIcono('llave', 'Restablecer contraseña', `data-clave="${u.id}"`)}${u.id !== ctx.usuario.id && u.rol !== 'medico' ? botonIcono('borrar', 'Quitar acceso', `data-borrar="${u.id}"`, 'peligro') : ''}</div></td></tr>`).join('')}</tbody></table></div></div>
        <div class="card-cuerpo"><span class="stat-nota">${lista.length} usuarios · Contraseña de demostración: 12345</span></div>
      </section>`;

    const b = ctx.vista.querySelector<HTMLInputElement>('#buscar')!;
    b.addEventListener('input', () => { busqueda = b.value; pintar(); const n = ctx.vista.querySelector<HTMLInputElement>('#buscar')!; n.focus(); n.setSelectionRange(busqueda.length, busqueda.length); });
    ctx.vista.querySelectorAll<HTMLElement>('[data-rol]').forEach((x) => x.addEventListener('click', () => { rolF = rolF === x.dataset.rol ? '' : x.dataset.rol as Rol; pintar(); }));
    ctx.vista.querySelector('#quitar-rol')?.addEventListener('click', () => { rolF = ''; pintar(); });
    ctx.vista.querySelectorAll<HTMLInputElement>('[data-activo]').forEach((x) => x.addEventListener('change', () => {
      const u = porId('usuarios', x.dataset.activo)!; guardarItem('usuarios', { ...u, activo: x.checked });
      aviso(x.checked ? `${u.nombre} puede ingresar` : `${u.nombre} ya no podrá ingresar`, x.checked ? 'exito' : 'info'); pintar();
    }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-clave]').forEach((x) => x.addEventListener('click', () => {
      const u = porId('usuarios', x.dataset.clave)!;
      modalFormulario({
        titulo: `🔑 Contraseña de @${escapar(u.usuario)}`, textoGuardar: 'Restablecer', ancho: 'sm',
        campos: campo('Nueva contraseña *', '<input name="clave" required minlength="5" value="12345" />', 'completo') + '<div class="ayuda">Comunica la nueva contraseña a la persona por un medio seguro.</div>',
        alGuardar: (d) => { guardarItem('usuarios', { ...u, clave: d.clave }); aviso('Contraseña restablecida'); },
      });
    }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-borrar]').forEach((x) => x.addEventListener('click', async () => {
      if (await confirmar('¿Quitar el acceso?', 'La persona ya no podrá ingresar. Sus datos y su historial se conservan.', 'Quitar acceso')) { eliminarItem('usuarios', x.dataset.borrar!); aviso('Acceso eliminado'); pintar(); }
    }));
    ctx.vista.querySelector('#nuevo')!.addEventListener('click', () => {
      const sinCuenta = obtener('pacientes').filter((p) => !usuarioDe('paciente', p.id)).sort((a, b) => a.nombres.localeCompare(b.nombres));
      modalFormulario({
        titulo: '👤 Nuevo usuario', textoGuardar: 'Crear usuario',
        campos: `<div class="ayuda">Los médicos reciben su usuario al agregarlos en “Médicos”. Aquí puedes crear accesos para recepción, administración o pacientes.</div>
          ${campo('Rol *', `<select name="rol" id="sel-rol">${opciones([{ valor: 'recepcion', texto: '🗂️ Recepción' }, { valor: 'admin', texto: '⚙️ Administrador' }, { valor: 'paciente', texto: '🧑 Paciente (portal)' }])}</select>`, 'completo')}
          <div class="campo completo" id="caja-paciente" hidden><span>Paciente *</span><select name="pacienteId">${sinCuenta.map((p) => `<option value="${p.id}">${escapar(nombreCompleto(p))} · ${p.codigo}</option>`).join('')}</select></div>
          <div class="campo completo" id="caja-nombre"><span>Nombre completo *</span><input name="nombre" /></div>
          ${campo('Cargo', '<input name="cargo" placeholder="Ej. Recepción · fin de semana" />', 'completo')}
          ${campo('Usuario *', '<input name="usuario" required pattern="[a-z0-9._]{3,30}" title="Minúsculas, números, punto o guion bajo" />')}
          ${campo('Contraseña *', '<input name="clave" required minlength="5" value="12345" />')}`,
        alAbrir: (form) => {
          const sel = form.querySelector<HTMLSelectElement>('#sel-rol')!;
          const sync = () => { const p = sel.value === 'paciente'; form.querySelector<HTMLElement>('#caja-paciente')!.hidden = !p; form.querySelector<HTMLElement>('#caja-nombre')!.hidden = p; };
          sel.addEventListener('change', sync); sync();
        },
        alGuardar: (d) => {
          const usuario = d.usuario.trim().toLowerCase();
          if (obtener('usuarios').some((u) => u.usuario === usuario)) { aviso('Ese nombre de usuario ya existe', 'error'); return false; }
          const rol = d.rol as Rol;
          const p = rol === 'paciente' ? paciente(d.pacienteId) : undefined;
          if (rol === 'paciente' && !p) { aviso('Elige un paciente', 'error'); return false; }
          if (rol !== 'paciente' && !d.nombre.trim()) { aviso('Escribe el nombre', 'error'); return false; }
          const u: Usuario = { id: p ? `u-${p.id}` : nuevoId('u-'), usuario, clave: d.clave, rol, refId: p?.id ?? null, nombre: p ? nombreCompleto(p) : d.nombre.trim(), cargo: d.cargo.trim(), activo: true, color: ROLES[rol].color, ultimoAcceso: null, vistoAvisos: null };
          guardarItem('usuarios', u); aviso(`Usuario @${u.usuario} creado`); pintar();
        },
      });
    });
  };
  pintar();
}

// ---------- Configuración ----------
export function configuracionAdmin(ctx: Contexto) {
  const c = config();
  const esp = espacioUsado();
  const cuenta = (n: Parameters<typeof obtener>[0]) => obtener(n).length;
  ctx.vista.innerHTML = `<div class="grid g-2-1">
    <section class="card"><div class="card-cabecera"><h2>${icono('edificio')} Datos de la clínica</h2></div><div class="card-cuerpo">
      <form class="form-modal" id="form-config">
        ${campo('Nombre de la clínica *', `<input name="clinica" required value="${escapar(c.clinica)}" />`, 'completo')}
        ${campo('Lema', `<input name="lema" value="${escapar(c.lema)}" />`, 'completo')}
        ${campo('Dirección', `<input name="direccion" value="${escapar(c.direccion)}" />`, 'completo')}
        ${campo('Teléfono', `<input name="telefono" value="${escapar(c.telefono)}" />`)}${campo('WhatsApp', `<input name="whatsapp" value="${escapar(c.whatsapp)}" />`)}
        ${campo('Correo', `<input name="correo" type="email" value="${escapar(c.correo)}" />`)}${campo('NIT', `<input name="nit" value="${escapar(c.nit)}" />`)}
        ${campo('Abre a las', `<input name="horaApertura" type="time" step="1800" value="${c.horaApertura}" />`)}${campo('Cierra a las', `<input name="horaCierre" type="time" step="1800" value="${c.horaCierre}" />`)}
        ${campo('Duración de cada cita', `<select name="duracionCita">${opciones([15, 20, 30, 45, 60].map((m) => ({ valor: String(m), texto: `${m} minutos` })), String(c.duracionCita))}</select>`)}
        <div class="completo"><button type="submit" class="btn btn-primario">${icono('guardar', 18)} Guardar configuración</button></div>
      </form></div></section>
    <div class="pila">
      ${tarjeta(`${icono('capas')} Datos del sistema`, `${barrasH([{ etiqueta: 'Espacio usado del navegador', valor: esp.porcentaje, max: 100, color: esp.porcentaje > 80 ? '#dc2626' : '#16a34a', texto: `${esp.kb} KB · ${esp.porcentaje}%` }])}
        <dl class="ficha-datos" style="margin-top:1rem"><div><dt>Pacientes</dt><dd>${cuenta('pacientes')}</dd></div><div><dt>Citas</dt><dd>${cuenta('citas')}</dd></div>
        <div><dt>Consultas</dt><dd>${cuenta('consultas')}</dd></div><div><dt>Recetas</dt><dd>${cuenta('recetas')}</dd></div><div><dt>Cobros</dt><dd>${cuenta('cobros')}</dd></div><div><dt>Usuarios</dt><dd>${cuenta('usuarios')}</dd></div></dl>`)}
      ${tarjeta(`${icono('descargar')} Respaldo`, `<p class="stat-nota mb">Descarga todos los datos en un archivo o restáuralos desde un respaldo.</p>
        <div class="herramientas"><button type="button" class="btn btn-secundario" id="exportar">${icono('descargar', 16)} Descargar respaldo</button>
        <label class="btn btn-secundario" style="cursor:pointer">${icono('subir', 16)} Restaurar<input type="file" id="importar" accept="application/json" hidden /></label></div>`)}
      ${tarjeta(`${icono('reiniciar')} Datos de demostración`, `<p class="stat-nota mb">Borra todos los cambios y vuelve a cargar los datos ficticios iniciales.</p>
        <button type="button" class="btn btn-peligro" id="restablecer">${icono('reiniciar', 16)} Restablecer datos</button>`)}
    </div></div>`;

  const form = ctx.vista.querySelector<HTMLFormElement>('#form-config')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (d.horaCierre <= d.horaApertura) return aviso('La hora de cierre debe ser después de la apertura', 'error');
    guardarConfig({ ...c, clinica: d.clinica.trim(), lema: d.lema.trim(), direccion: d.direccion.trim(), telefono: d.telefono.trim(), whatsapp: d.whatsapp.trim(), correo: d.correo.trim(), nit: d.nit.trim(), horaApertura: d.horaApertura, horaCierre: d.horaCierre, duracionCita: Number(d.duracionCita) });
    aviso('Configuración guardada ✅');
  });
  ctx.vista.querySelector('#exportar')!.addEventListener('click', () => descargar(`respaldo-consultoriogt-${hoy()}.json`, JSON.stringify(exportarTodo()), 'application/json'));
  ctx.vista.querySelector<HTMLInputElement>('#importar')!.addEventListener('change', async (e) => {
    const archivo = (e.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      if (!(await confirmar('¿Restaurar respaldo?', 'Se reemplazarán todos los datos actuales por los del archivo.', 'Restaurar'))) return;
      importarTodo(datos); aviso('Respaldo restaurado'); setTimeout(() => location.reload(), 700);
    } catch (err) { aviso((err as Error).message || 'Archivo no válido', 'error'); }
  });
  ctx.vista.querySelector('#restablecer')!.addEventListener('click', async () => {
    if (await confirmar('¿Restablecer todos los datos?', 'Se perderán todos los cambios y se cargarán los datos de demostración.', 'Restablecer')) {
      restablecerDatos(); aviso('Datos restablecidos'); setTimeout(() => location.reload(), 700);
    }
  });
}
