// ============================================================
//  PORTAL DEL PACIENTE
//  inicio · agendar cita · mis citas · recetas · historial · pagos
// ============================================================
import type { Contexto } from '../lib/app';
import { parametro } from '../lib/app';
import type { Cita } from '../lib/tipos';
import { obtener, guardarItem, nuevoId, config } from '../lib/datos';
import {
  medico, especialidad, nombreMedico, nombreMedicoCompleto, textoHora, horaFin, proximaCita, citasDePaciente, consultasDePaciente,
  recetasDePaciente, cobrosDePaciente, medicosActivos, proximosDias, horariosDisponibles, DIAS_CORTOS, diaSemana,
  pendienteDeAtender, colorMedico, imc,
} from '../lib/clinica';
import { avatar, badgeEstado, stat, tarjeta, vacio, chipEsp, badge, botonIcono } from '../lib/vistas';
import { escapar, hoy, saludo, fechaLarga, fechaMedia, relativa, moneda, monedaCorta, diasEntre, aFecha, MESES } from '../lib/formato';
import { icono } from '../lib/iconos';
import { aviso } from '../lib/ui';
import { ruta } from '../lib/ruta';
import { detalleCita, expedienteHTML, enlazarExpediente, verReceta, verRecibo } from './comun';

function tarjetaCita(c: Cita, grande = false) {
  const m = medico(c.medicoId); const e = especialidad(m?.especialidadId); const f = aFecha(c.fecha);
  return `<div class="ahora" style="--c:${e?.color ?? 'var(--rol)'}${grande ? '' : ';padding:.85rem 1rem'}">
    <div class="fecha-caja" style="background:#fff;color:${e?.color};width:${grande ? 64 : 54}px"><b style="font-size:${grande ? 1.5 : 1.15}rem">${f.getDate()}</b><span>${MESES[f.getMonth()].slice(0, 3)}</span></div>
    <div style="flex:1;min-width:0"><small>${relativa(c.fecha)} · ${textoHora(c.hora)}</small><strong>${escapar(nombreMedicoCompleto(m))}</strong>
      <span>${e?.icono} ${escapar(e?.nombre ?? '')} · ${escapar(m?.consultorio ?? '')} · ${escapar(c.motivo)}</span></div>
    ${badgeEstado(c.estado)}${botonIcono('ojo', 'Ver detalle', `data-cita="${c.id}"`)}</div>`;
}

// ---------- Inicio ----------
export function inicioPaciente(ctx: Contexto) {
  const p = ctx.paciente!;
  const prox = proximaCita(p.id);
  const futuras = citasDePaciente(p.id).filter((c) => c.fecha >= hoy() && pendienteDeAtender(c));
  const consultas = consultasDePaciente(p.id);
  const receta = recetasDePaciente(p.id)[0];
  const pendiente = cobrosDePaciente(p.id).filter((c) => c.estado === 'Pendiente').reduce((s, c) => s + c.total, 0);
  const ultima = consultas[0];
  const r = ultima ? imc(ultima.signos.peso, ultima.signos.talla) : null;
  const cfg = config();

  ctx.vista.innerHTML = `
    <div class="hero">
      ${avatar(ctx.usuario.nombre, ctx.usuario.color, 'lg')}
      <div><h2>${saludo()}, ${escapar(p.nombres.split(' ')[0])} 👋</h2><p>Bienvenido a tu portal de ${escapar(cfg.clinica)}.</p>
        <div class="hero-chips"><span>🪪 ${p.codigo}</span><span>🩸 ${escapar(p.sangre || 'Sangre —')}</span>${p.alergias ? `<span>⚠️ Alergia: ${escapar(p.alergias)}</span>` : ''}</div></div>
      <div class="hero-derecha"><a class="btn btn-secundario" href="${ruta('/paciente/agendar')}">${icono('mas', 18)} Agendar una cita</a></div>
    </div>
    <section class="card mb"><div class="card-cabecera"><h2>${icono('calendario')} Tu próxima cita</h2>${futuras.length > 1 ? `<a class="enlace" href="${ruta('/paciente/citas')}">Ver las ${futuras.length} ${icono('derecha', 14)}</a>` : ''}</div>
      <div class="card-cuerpo">${prox ? `${tarjetaCita(prox, true)}
        ${prox.estado === 'Programada' && prox.origen === 'En línea' ? `<div class="alerta azul" style="margin-top:.8rem">${icono('info', 18)}<span>Recepción te llamará para confirmar tu cita.</span></div>` : ''}
        <p class="stat-nota" style="margin-top:.8rem">📍 ${escapar(cfg.direccion)} · Llega 10 minutos antes con tu DPI.</p>`
        : vacio('🗓️', 'No tienes citas próximas', `<a class="btn btn-primario btn-sm" style="margin-top:.6rem" href="${ruta('/paciente/agendar')}">Agendar ahora</a>`)}</div></section>
    <div class="grid g4 mb">
      ${stat({ icono: '📋', etiqueta: 'Consultas', valor: String(consultas.length), nota: ultima ? `Última ${relativa(ultima.fecha.slice(0, 10)).toLowerCase()}` : 'Aún ninguna' })}
      ${stat({ icono: '❤️', etiqueta: 'Última presión', valor: escapar(ultima?.signos.presion || '—'), nota: 'mmHg', tono: 'rojo' })}
      ${stat({ icono: '⚖️', etiqueta: 'Último peso', valor: ultima?.signos.peso ? `${ultima.signos.peso} kg` : '—', nota: r ? `IMC ${r.valor} · ${r.texto}` : '', tono: 'azul' })}
      ${stat({ icono: '💳', etiqueta: 'Saldo pendiente', valor: monedaCorta(pendiente), nota: pendiente ? 'Paga en caja' : 'Estás al día', tono: pendiente ? 'ambar' : 'verde' })}
    </div>
    <div class="grid g2">
      ${tarjeta(`${icono('pildora')} Tu última receta`, receta ? `<p class="stat-nota mb">${fechaLarga(receta.fecha.slice(0, 10))} · ${escapar(nombreMedico(medico(receta.medicoId)))}</p>
        <div class="lista">${receta.medicamentos.map((x) => `<div class="lista-item"><span class="icono-caja" style="--c:var(--rol)">💊</span><div class="crece"><strong>${escapar(x.nombre)}</strong><small>${escapar(x.dosis)} · ${escapar(x.frecuencia)} · ${escapar(x.duracion)}</small></div></div>`).join('')}</div>
        <button type="button" class="btn btn-secundario btn-sm" style="margin-top:1rem" data-receta="${receta.id}">${icono('imprimir', 16)} Ver e imprimir</button>` : vacio('💊', 'Sin recetas todavía'), `<a class="enlace" href="${ruta('/paciente/recetas')}">Todas ${icono('derecha', 14)}</a>`)}
      ${tarjeta(`${icono('estetoscopio')} Nuestras especialidades`, `<div class="opciones-grid">${obtener('especialidades').map((e) => `<a class="opcion" href="${ruta(`/paciente/agendar?esp=${e.id}`)}"><span class="icono-caja" style="--c:${e.color}">${e.icono}</span><div><strong>${escapar(e.nombre)}</strong><small>Agendar ${icono('derecha', 12)}</small></div></a>`).join('')}</div>`)}
    </div>`;
  ctx.vista.querySelectorAll<HTMLElement>('[data-cita]').forEach((b) => b.addEventListener('click', () => detalleCita(b.dataset.cita!, 'paciente', ctx.refrescar)));
  ctx.vista.querySelector<HTMLElement>('[data-receta]')?.addEventListener('click', (e) => verReceta((e.currentTarget as HTMLElement).dataset.receta!));
}

// ---------- Agendar cita (asistente) ----------
export function agendarPaciente(ctx: Contexto) {
  const p = ctx.paciente!;
  let espId = parametro('esp') ?? '';
  let medicoId = '';
  let fecha = '';
  let hora = '';
  const paso = () => (!espId ? 1 : !medicoId ? 2 : !fecha || !hora ? 3 : 4);

  const pintar = () => {
    const n = paso();
    const e = especialidad(espId); const m = medico(medicoId);
    const resumen = `<div class="chips mb">${e ? `<button type="button" class="chip" data-volver="1">${e.icono} ${escapar(e.nombre)} ✕</button>` : ''}${m ? `<button type="button" class="chip" data-volver="2">${escapar(nombreMedico(m))} ✕</button>` : ''}${fecha && hora ? `<button type="button" class="chip" data-volver="3">${fechaMedia(fecha)} · ${textoHora(hora)} ✕</button>` : ''}</div>`;
    let cuerpo = '';
    if (n === 1) {
      cuerpo = `<h3 class="mb">1. ¿Qué especialidad necesitas?</h3><div class="opciones-grid">${obtener('especialidades').filter((x) => medicosActivos().some((y) => y.especialidadId === x.id)).map((x) => `
        <button type="button" class="opcion" data-esp="${x.id}"><span class="icono-caja" style="--c:${x.color}">${x.icono}</span><div><strong>${escapar(x.nombre)}</strong><small>${escapar(x.descripcion)}</small></div></button>`).join('')}</div>`;
    } else if (n === 2) {
      const lista = medicosActivos().filter((x) => x.especialidadId === espId);
      cuerpo = `<h3 class="mb">2. Elige a tu médico</h3><div class="grid g-auto">${lista.map((x) => `
        <button type="button" class="mini-card" style="--c:${colorMedico(x)};text-align:left;font:inherit;cursor:pointer" data-medico="${x.id}">
          <div class="mini-card-cab">${avatar(nombreMedico(x), colorMedico(x), 'md')}<div><strong>${escapar(nombreMedicoCompleto(x))}</strong><small>${escapar(e?.nombre ?? '')} · ${escapar(x.consultorio)}</small></div></div>
          <p class="stat-nota">${escapar(x.bio)}</p>
          <div class="mini-card-pie"><span class="stat-nota">📅 ${x.dias.map((d) => DIAS_CORTOS[d]).join(', ')} · ${textoHora(x.horaInicio)} – ${textoHora(x.horaFin)}</span><strong>${moneda(x.precio)}</strong></div></button>`).join('')}</div>`;
    } else if (n === 3) {
      const dias = proximosDias(m!, 12);
      if (!fecha) fecha = dias.find((f) => horariosDisponibles(m!, f).length) ?? dias[0];
      const libres = horariosDisponibles(m!, fecha);
      cuerpo = `<h3 class="mb">3. Elige el día y la hora</h3>
        <div class="dias-sel mb">${dias.map((f) => { const libresDia = horariosDisponibles(m!, f).length; return `<button type="button" class="dia-sel ${f === fecha ? 'activo' : ''}" data-fecha="${f}" ${libresDia ? '' : 'disabled'}><small>${DIAS_CORTOS[diaSemana(f)]}</small><b>${Number(f.slice(8))}</b><small>${libresDia ? `${libresDia} libres` : 'Lleno'}</small></button>`; }).join('')}</div>
        <p class="stat-etiqueta mb">${fechaLarga(fecha)}</p>
        ${libres.length ? `<div class="slots">${libres.map((h) => `<button type="button" class="slot ${h === hora ? 'activo' : ''}" data-hora="${h}">${textoHora(h)}</button>`).join('')}</div>` : vacio('😕', 'No quedan horarios este día', 'Elige otro día.')}`;
    } else {
      cuerpo = `<h3 class="mb">4. Confirma tu cita</h3>
        <div class="ahora mb" style="--c:${colorMedico(m)}"><span class="ahora-icono">${e?.icono}</span><div style="flex:1"><small>${relativa(fecha)} · ${textoHora(hora)} – ${textoHora(horaFin(hora))}</small><strong>${escapar(nombreMedicoCompleto(m))}</strong><span>${fechaLarga(fecha)} · ${escapar(m!.consultorio)}</span></div><strong>${moneda(m!.precio)}</strong></div>
        <div class="form-modal">${`<label class="campo completo"><span>¿Cuál es el motivo de tu consulta?</span><input class="control" id="motivo" maxlength="120" placeholder="Ej. dolor de garganta, control, chequeo general..." /></label>`}</div>
        <div class="alerta azul" style="margin-top:1rem">${icono('info', 18)}<span>La consulta se paga en la clínica. Si no puedes asistir, cancélala desde “Mis citas” para liberar el horario.</span></div>
        <div class="herramientas" style="margin-top:1.2rem;justify-content:flex-end"><button type="button" class="btn btn-primario" id="confirmar">${icono('check', 18)} Confirmar cita</button></div>`;
    }
    ctx.vista.innerHTML = `<section class="card"><div class="card-cuerpo">
      <div class="pasos">${[1, 2, 3, 4].map((i) => `<span class="paso ${i <= n ? 'hecho' : ''}"></span>`).join('')}</div>
      ${resumen}${cuerpo}</div></section>
      <p class="stat-nota" style="margin-top:1rem;text-align:center">Agendando como <strong>${escapar(p.nombres)} ${escapar(p.apellidos)}</strong> · ${p.codigo}</p>`;

    ctx.vista.querySelectorAll<HTMLElement>('[data-esp]').forEach((b) => b.addEventListener('click', () => { espId = b.dataset.esp!; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-medico]').forEach((b) => b.addEventListener('click', () => { medicoId = b.dataset.medico!; fecha = ''; hora = ''; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-fecha]').forEach((b) => b.addEventListener('click', () => { fecha = b.dataset.fecha!; hora = ''; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-hora]').forEach((b) => b.addEventListener('click', () => { hora = b.dataset.hora!; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-volver]').forEach((b) => b.addEventListener('click', () => {
      const v = Number(b.dataset.volver);
      if (v <= 1) { espId = ''; medicoId = ''; } if (v <= 2) medicoId = ''; fecha = v <= 2 ? '' : fecha; hora = ''; pintar();
    }));
    ctx.vista.querySelector('#confirmar')?.addEventListener('click', () => {
      if (!horariosDisponibles(m!, fecha).includes(hora)) { aviso('Ese horario acaba de ocuparse. Elige otro.', 'error'); hora = ''; pintar(); return; }
      const cita: Cita = { id: nuevoId('c-'), pacienteId: p.id, medicoId, fecha, hora, motivo: (ctx.vista.querySelector<HTMLInputElement>('#motivo')!.value.trim() || 'Consulta'), estado: 'Programada', origen: 'En línea', llegada: null, creada: new Date().toISOString(), nota: '' };
      guardarItem('citas', cita);
      ctx.vista.innerHTML = `<section class="card"><div class="card-cuerpo" style="text-align:center;padding:2.5rem 1.5rem">
        <div style="font-size:3.2rem">🎉</div><h2 style="margin:.6rem 0 .3rem">¡Tu cita quedó agendada!</h2>
        <p class="stat-nota">${fechaLarga(fecha)} a las ${textoHora(hora)} con ${escapar(nombreMedicoCompleto(m))}</p>
        <p class="stat-nota" style="margin-top:.4rem">Recepción te llamará para confirmarla.</p>
        <div class="herramientas" style="justify-content:center;margin-top:1.4rem"><a class="btn btn-secundario" href="${ruta('/paciente/')}">Ir al inicio</a><a class="btn btn-primario" href="${ruta('/paciente/citas')}">Ver mis citas</a></div></div></section>`;
      aviso('Cita agendada ✅');
    });
  };
  pintar();
}

// ---------- Mis citas ----------
export function citasPaciente(ctx: Contexto) {
  const p = ctx.paciente!;
  let pestana: 'proximas' | 'anteriores' = 'proximas';
  const pintar = () => {
    const todas = citasDePaciente(p.id);
    const proximas = todas.filter((c) => c.fecha >= hoy() && pendienteDeAtender(c));
    const anteriores = todas.filter((c) => !proximas.includes(c)).reverse();
    const lista = pestana === 'proximas' ? proximas : anteriores;
    ctx.vista.innerHTML = `
      <div class="herramientas mb" style="justify-content:space-between">
        <div class="segmentado"><button type="button" class="${pestana === 'proximas' ? 'activo' : ''}" data-tab="proximas">Próximas (${proximas.length})</button><button type="button" class="${pestana === 'anteriores' ? 'activo' : ''}" data-tab="anteriores">Anteriores (${anteriores.length})</button></div>
        <a class="btn btn-primario" href="${ruta('/paciente/agendar')}">${icono('mas', 18)} Agendar cita</a></div>
      ${lista.length ? `<div class="pila">${lista.map((c) => tarjetaCita(c)).join('')}</div>` : `<section class="card"><div class="card-cuerpo">${vacio(pestana === 'proximas' ? '🗓️' : '📂', pestana === 'proximas' ? 'No tienes citas próximas' : 'Aún no tienes citas anteriores')}</div></section>`}`;
    ctx.vista.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.tab as typeof pestana; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-cita]').forEach((b) => b.addEventListener('click', () => detalleCita(b.dataset.cita!, 'paciente', pintar)));
  };
  pintar();
}

// ---------- Mis recetas ----------
export function recetasPaciente(ctx: Contexto) {
  const recetas = recetasDePaciente(ctx.paciente!.id);
  ctx.vista.innerHTML = recetas.length ? `<div class="grid g2">${recetas.map((r, i) => {
    const m = medico(r.medicoId); const dias = diasEntre(r.fecha.slice(0, 10), hoy());
    return `<section class="card"><div class="card-cabecera"><h2>💊 ${fechaMedia(r.fecha.slice(0, 10))}</h2>${i === 0 && dias <= 30 ? badge('Más reciente', 'ok') : `<span class="stat-nota">${relativa(r.fecha.slice(0, 10))}</span>`}</div>
      <div class="card-cuerpo"><p class="stat-nota mb">${escapar(nombreMedicoCompleto(m))} · ${chipEsp(m?.especialidadId)}</p>
        <div class="lista">${r.medicamentos.map((x) => `<div class="lista-item"><div class="crece"><strong>${escapar(x.nombre)}</strong><small>${escapar(x.dosis)} · ${escapar(x.frecuencia)} · durante ${escapar(x.duracion)}</small></div></div>`).join('')}</div>
        ${r.indicaciones ? `<p class="stat-nota" style="margin-top:.8rem"><strong>Indicaciones:</strong> ${escapar(r.indicaciones)}</p>` : ''}
        <button type="button" class="btn btn-secundario btn-sm" style="margin-top:1rem" data-receta="${r.id}">${icono('imprimir', 16)} Ver e imprimir</button></div></section>`;
  }).join('')}</div>` : `<section class="card"><div class="card-cuerpo">${vacio('💊', 'Aún no tienes recetas', 'Cuando un médico te recete algo, aparecerá aquí.')}</div></section>`;
  ctx.vista.querySelectorAll<HTMLElement>('[data-receta]').forEach((b) => b.addEventListener('click', () => verReceta(b.dataset.receta!)));
}

// ---------- Mi historial ----------
export function historialPaciente(ctx: Contexto) {
  ctx.vista.innerHTML = expedienteHTML(ctx.paciente!, 'paciente');
  enlazarExpediente(ctx.vista, ctx.paciente!, ctx.refrescar);
}

// ---------- Pagos ----------
export function pagosPaciente(ctx: Contexto) {
  const cobros = cobrosDePaciente(ctx.paciente!.id).filter((c) => c.estado !== 'Anulado');
  const pagado = cobros.filter((c) => c.estado === 'Pagado').reduce((s, c) => s + c.total, 0);
  const pend = cobros.filter((c) => c.estado === 'Pendiente');
  const cfg = config();
  ctx.vista.innerHTML = `
    <div class="grid g3 mb">
      ${stat({ icono: '⏳', etiqueta: 'Saldo pendiente', valor: monedaCorta(pend.reduce((s, c) => s + c.total, 0)), nota: pend.length ? `${pend.length} cobro(s)` : 'Estás al día 🎉', tono: pend.length ? 'ambar' : 'verde' })}
      ${stat({ icono: '✅', etiqueta: 'Total pagado', valor: monedaCorta(pagado), nota: `${cobros.length - pend.length} recibos`, tono: 'verde' })}
      ${stat({ icono: '🛡️', etiqueta: 'Seguro médico', valor: escapar(ctx.paciente!.seguro || 'Particular'), tono: 'azul' })}
    </div>
    ${pend.length ? `<div class="alerta mb">${icono('info', 18)}<span>Puedes pagar tu saldo en la caja de la clínica (efectivo o tarjeta) o por transferencia. Dudas: ${escapar(cfg.telefono)}.</span></div>` : ''}
    <section class="card"><div class="card-cabecera"><h2>${icono('recibo')} Historial de pagos</h2></div>
      <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th>Médico</th><th class="derecha">Total</th><th>Estado</th><th></th></tr></thead>
      <tbody>${cobros.map((c) => `<tr><td>${fechaMedia(c.fecha.slice(0, 10))}</td><td>${c.detalle.map((d) => escapar(d.concepto)).join('<br>')}</td><td>${escapar(nombreMedico(medico(c.medicoId)))}</td>
        <td class="derecha"><strong>${moneda(c.total)}</strong></td><td>${badge(c.estado, c.estado === 'Pagado' ? 'ok' : 'warn')}</td>
        <td class="derecha">${botonIcono('recibo', c.estado === 'Pagado' ? 'Ver recibo' : 'Ver detalle', `data-recibo="${c.id}"`)}</td></tr>`).join('') || `<tr><td colspan="6">${vacio('🧾', 'Sin pagos registrados')}</td></tr>`}</tbody></table></div></div></section>`;
  ctx.vista.querySelectorAll<HTMLElement>('[data-recibo]').forEach((b) => b.addEventListener('click', () => verRecibo(b.dataset.recibo!)));
}

