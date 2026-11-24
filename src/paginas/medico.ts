// ============================================================
//  PORTAL MÉDICO
//  mi día · agenda · consulta · pacientes · expediente · recetas
// ============================================================
import type { Contexto } from '../lib/app';
import { parametro } from '../lib/app';
import type { Consulta, Medicamento, Receta } from '../lib/tipos';
import { obtener, porId, guardarItem } from '../lib/datos';
import {
  citasDelDia, paciente, nombreCompleto, nombreCorto, tituloDe, textoEdad, textoHora, horaFin, minutosEspera, consultasDePaciente,
  horariosMedico, trabajaEl, pacientesDeMedico, proximaCita, crearCobro, especialidad, usuarioDe, imc, DIAS_CORTOS, diaSemana,
} from '../lib/clinica';
import { avatar, badgeEstado, stat, tarjeta, vacio, barrasH, botonIcono, badge } from '../lib/vistas';
import { escapar, hoy, saludo, fechaLarga, fechaMedia, sumarDias, relativa, coincide, fechaCorta, aFecha, MESES } from '../lib/formato';
import { icono } from '../lib/iconos';
import { abrirModal, aviso, confirmar, campo } from '../lib/ui';
import { ruta } from '../lib/ruta';
import { detalleCita, expedienteHTML, enlazarExpediente, modalCita, verReceta } from './comun';

const enlaceExpediente = (pid: string) => ruta(`/medico/expediente?p=${pid}`);

// ---------- Mi día ----------
export function inicioMedico(ctx: Contexto) {
  const m = ctx.medico!;
  const citas = citasDelDia(hoy(), m.id).filter((c) => c.estado !== 'Cancelada');
  const atendidas = citas.filter((c) => c.estado === 'Atendida');
  const espera = citas.filter((c) => c.estado === 'En espera').sort((a, b) => (a.llegada ?? '').localeCompare(b.llegada ?? ''));
  const enConsulta = citas.find((c) => c.estado === 'En consulta');
  const siguiente = enConsulta ?? espera[0] ?? citas.find((c) => c.estado === 'Confirmada' || c.estado === 'Programada');
  const trabaja = trabajaEl(m, hoy());

  // Controles de seguimiento de los próximos 7 días
  const controles = obtener('consultas').filter((c) => c.medicoId === m.id && c.seguimiento && c.seguimiento >= hoy() && c.seguimiento <= sumarDias(hoy(), 7))
    .sort((a, b) => a.seguimiento!.localeCompare(b.seguimiento!)).slice(0, 5);
  // Diagnósticos del último mes
  const mes = obtener('consultas').filter((c) => c.medicoId === m.id && c.fecha.slice(0, 10) >= sumarDias(hoy(), -30));
  const conteo = new Map<string, number>(); mes.forEach((c) => conteo.set(c.diagnostico, (conteo.get(c.diagnostico) ?? 0) + 1));
  const top = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const color = especialidad(m.especialidadId)?.color ?? 'var(--rol)';

  const proximoHTML = siguiente ? (() => {
    const p = paciente(siguiente.pacienteId)!;
    const ultima = consultasDePaciente(p.id).find((x) => x.fecha.slice(0, 10) < hoy());
    return `<div class="ahora" style="--c:${color}">
      ${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'lg')}
      <div style="flex:1;min-width:0"><small>${siguiente.estado === 'En consulta' ? 'En consulta ahora' : siguiente.estado === 'En espera' ? `En sala de espera · ${minutosEspera(siguiente)} min` : 'Próxima cita'}</small>
        <strong>${escapar(nombreCompleto(p))}</strong><span>${textoEdad(p.nacimiento)} · ${textoHora(siguiente.hora)} · ${escapar(siguiente.motivo)}</span>
        ${p.alergias ? `<div style="margin-top:.4rem">${badge(`⚠️ Alergia: ${p.alergias}`, 'bad')}</div>` : ''}
        ${ultima ? `<span style="display:block;margin-top:.3rem" class="stat-nota">Última consulta: ${escapar(ultima.diagnostico)} · ${relativa(ultima.fecha.slice(0, 10)).toLowerCase()}</span>` : '<span style="display:block;margin-top:.3rem" class="stat-nota">Primera consulta con la clínica</span>'}
      </div>
      <div class="herramientas"><a class="btn btn-secundario btn-sm" href="${enlaceExpediente(p.id)}">${icono('expediente', 16)} Expediente</a>
        <a class="btn btn-primario" href="${ruta(`/medico/consulta?c=${siguiente.id}`)}">${icono('estetoscopio', 18)} ${siguiente.estado === 'En consulta' ? 'Continuar' : 'Atender'}</a></div></div>`;
  })() : vacio('☕', trabaja ? 'No hay más pacientes por ahora' : 'Hoy no tienes consulta', trabaja ? 'Buen trabajo. Revisa tu agenda de los próximos días.' : `Atiendes ${m.dias.map((d) => DIAS_CORTOS[d]).join(', ')}.`);

  ctx.vista.innerHTML = `
    <div class="hero">
      ${avatar(ctx.usuario.nombre, ctx.usuario.color, 'lg')}
      <div><h2>${saludo()}, ${tituloDe(m)} ${escapar(m.apellidos.split(' ')[0])} 👋</h2>
        <p>${trabaja ? `Hoy tienes ${citas.length} pacientes en agenda · ${textoHora(m.horaInicio)} a ${textoHora(m.horaFin)}` : 'Hoy no tienes horario de consulta.'}</p>
        <div class="hero-chips"><span>${especialidad(m.especialidadId)?.icono} ${escapar(especialidad(m.especialidadId)?.nombre ?? '')}</span><span>🚪 ${escapar(m.consultorio)}</span><span>🪪 Col. ${escapar(m.colegiado)}</span></div></div>
    </div>
    <div class="grid g4 mb">
      ${stat({ icono: '🗓️', etiqueta: 'Pacientes de hoy', valor: String(citas.length), nota: `${citas.filter((c) => c.estado === 'Programada' || c.estado === 'Confirmada').length} por llegar` })}
      ${stat({ icono: '🪑', etiqueta: 'En sala de espera', valor: String(espera.length), nota: espera.length ? `El primero espera ${minutosEspera(espera[0])} min` : 'Nadie esperando', tono: 'ambar' })}
      ${stat({ icono: '✅', etiqueta: 'Atendidos hoy', valor: String(atendidas.length), nota: citas.length ? `${Math.round((atendidas.length / citas.length) * 100)}% de la agenda` : '', tono: 'verde' })}
      ${stat({ icono: '📋', etiqueta: 'Consultas del mes', valor: String(mes.length), nota: `${pacientesDeMedico(m.id).length} pacientes en total`, tono: 'azul' })}
    </div>
    <section class="card mb"><div class="card-cabecera"><h2>${icono('estetoscopio')} ${enConsulta ? 'Paciente en consulta' : 'Siguiente paciente'}</h2></div><div class="card-cuerpo">${proximoHTML}</div></section>
    <div class="grid g-2-1">
      ${tarjeta(`${icono('reloj')} Agenda de hoy`, citas.length ? `<div class="timeline">${citas.map((c) => {
        const p = paciente(c.pacienteId);
        return `<div class="tl-item ${c.estado === 'Atendida' ? 'pasada' : ''} ${c.estado === 'En consulta' || c.estado === 'En espera' ? 'activa' : ''}" style="--c:${color}">
          <div class="tl-hora">${textoHora(c.hora).replace(' ', '<small>')}</small></div>
          ${avatar(nombreCompleto(p), usuarioDe('paciente', c.pacienteId)?.color, 'sm')}
          <div style="flex:1;min-width:0"><strong style="display:block;font-size:.9rem">${escapar(nombreCompleto(p))}</strong><small class="stat-nota">${escapar(c.motivo)}${p?.alergias ? ' · ⚠️ alergia' : ''}</small></div>
          ${badgeEstado(c.estado)}${botonIcono('ojo', 'Ver cita', `data-cita="${c.id}"`)}</div>`;
      }).join('')}</div>` : vacio('📭', 'Sin citas para hoy'), `<a class="enlace" href="${ruta('/medico/agenda')}">Agenda completa ${icono('derecha', 14)}</a>`)}
      <div class="pila">
        ${tarjeta(`${icono('calendario')} Controles próximos`, controles.length ? `<div class="lista">${controles.map((c) => `<a class="lista-item" href="${enlaceExpediente(c.pacienteId)}">
          ${avatar(nombreCompleto(paciente(c.pacienteId)), usuarioDe('paciente', c.pacienteId)?.color, 'sm')}<div class="crece"><strong>${escapar(nombreCorto(paciente(c.pacienteId)))}</strong><small>${escapar(c.diagnostico)}</small></div>
          <span class="badge info">${relativa(c.seguimiento!)}</span></a>`).join('')}</div>` : vacio('👍', 'Sin controles esta semana'))}
        ${tarjeta(`${icono('grafica')} Diagnósticos del mes`, top.length ? barrasH(top.map(([d, n]) => ({ etiqueta: d, valor: n, color, texto: String(n) }))) : vacio('📊', 'Aún sin datos'))}
      </div>
    </div>`;
  ctx.vista.querySelectorAll<HTMLElement>('[data-cita]').forEach((b) => b.addEventListener('click', () => detalleCita(b.dataset.cita!, 'medico', ctx.refrescar)));
}

// ---------- Agenda ----------
export function agendaMedico(ctx: Contexto) {
  const m = ctx.medico!;
  let fecha = hoy();
  const color = especialidad(m.especialidadId)?.color ?? 'var(--rol)';
  const pintar = () => {
    const lunes = sumarDias(fecha, -diaSemana(fecha));
    const semana = Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));
    const citas = citasDelDia(fecha, m.id);
    const horas = horariosMedico(m);
    const extra = citas.filter((c) => !horas.includes(c.hora)).map((c) => c.hora);
    const filas = [...new Set([...horas, ...extra])].sort();
    ctx.vista.innerHTML = `
      <section class="card mb"><div class="card-cuerpo">
        <div class="herramientas" style="justify-content:space-between;margin-bottom:1rem">
          <div class="herramientas">${botonIcono('izquierda', 'Semana anterior', 'data-mover="-7"', 'borde')}<button type="button" class="btn btn-secundario btn-sm" data-hoy>Hoy</button>${botonIcono('derecha', 'Semana siguiente', 'data-mover="7"', 'borde')}</div>
          <strong>${MESES[aFecha(fecha).getMonth()]} ${aFecha(fecha).getFullYear()}</strong>
          <button type="button" class="btn btn-primario btn-sm" id="nueva">${icono('mas', 16)} Agendar control</button>
        </div>
        <div class="dias-sel">${semana.map((f) => {
          const n = citasDelDia(f, m.id).filter((c) => c.estado !== 'Cancelada').length;
          return `<button type="button" class="dia-sel ${f === fecha ? 'activo' : ''}" data-fecha="${f}" ${trabajaEl(m, f) ? '' : 'style="opacity:.5"'}><small>${DIAS_CORTOS[diaSemana(f)]}</small><b>${Number(f.slice(8))}</b><small>${trabajaEl(m, f) ? `${n} citas` : 'Libre'}</small></button>`;
        }).join('')}</div>
      </div></section>
      ${tarjeta(`${icono('calendario')} ${fechaLarga(fecha)}`, !trabajaEl(m, fecha) && !citas.length ? vacio('🌴', 'No tienes consulta este día') : `<div class="timeline">${filas.map((h) => {
        const c = citas.find((x) => x.hora === h && x.estado !== 'Cancelada') ?? citas.find((x) => x.hora === h);
        if (!c) return `<div class="tl-item" style="border-style:dashed"><div class="tl-hora">${textoHora(h).replace(' ', '<small>')}</small></div><span class="stat-nota" style="flex:1">Horario libre</span></div>`;
        const p = paciente(c.pacienteId);
        return `<div class="tl-item ${c.estado === 'Cancelada' ? 'pasada' : ''} ${c.estado === 'En espera' ? 'activa' : ''}" style="--c:${color}"><div class="tl-hora">${textoHora(h).replace(' ', '<small>')}</small></div>
          ${avatar(nombreCompleto(p), usuarioDe('paciente', c.pacienteId)?.color, 'sm')}<div style="flex:1;min-width:0"><strong style="display:block;font-size:.9rem">${escapar(nombreCompleto(p))}</strong><small class="stat-nota">${escapar(c.motivo)} · ${c.origen === 'En línea' ? '🌐 en línea' : 'recepción'}</small></div>
          ${badgeEstado(c.estado)}${botonIcono('ojo', 'Ver cita', `data-cita="${c.id}"`)}</div>`;
      }).join('')}</div>`, `<span class="stat-nota">${citas.filter((c) => c.estado !== 'Cancelada').length} citas · ${textoHora(m.horaInicio)} – ${textoHora(m.horaFin)}</span>`)}`;

    ctx.vista.querySelectorAll<HTMLElement>('[data-fecha]').forEach((b) => b.addEventListener('click', () => { fecha = b.dataset.fecha!; pintar(); }));
    ctx.vista.querySelectorAll<HTMLElement>('[data-mover]').forEach((b) => b.addEventListener('click', () => { fecha = sumarDias(fecha, Number(b.dataset.mover)); pintar(); }));
    ctx.vista.querySelector('[data-hoy]')!.addEventListener('click', () => { fecha = hoy(); pintar(); });
    ctx.vista.querySelectorAll<HTMLElement>('[data-cita]').forEach((b) => b.addEventListener('click', () => detalleCita(b.dataset.cita!, 'medico', pintar)));
    ctx.vista.querySelector('#nueva')!.addEventListener('click', () => modalCita({ medicoId: m.id, fecha: fecha >= hoy() ? fecha : hoy(), alGuardar: (c) => { fecha = c.fecha; pintar(); } }));
  };
  pintar();
}

// ---------- Consulta ----------
const ALERGENOS: Record<string, string[]> = {
  penicilina: ['penicilina', 'amoxicilina', 'ampicilina', 'dicloxacilina'],
  sulfas: ['sulfa', 'trimetoprim'],
  'ácido acetilsalicílico': ['aspirina', 'acetilsalicílico'],
};
function choqueAlergia(alergias: string, medicamento: string) {
  const a = alergias.toLowerCase(); const med = medicamento.toLowerCase();
  if (!a || !med) return '';
  for (const [alergeno, palabras] of Object.entries(ALERGENOS)) if (a.includes(alergeno) && palabras.some((p) => med.includes(p))) return alergeno;
  return a.split(/[,;]/).map((x) => x.trim()).find((x) => x.length > 3 && med.includes(x)) ?? '';
}

export function consultaMedico(ctx: Contexto) {
  const m = ctx.medico!;
  const cita = porId('citas', parametro('c'));
  if (!cita || cita.medicoId !== m.id) { ctx.vista.innerHTML = vacio('🔍', 'No encontramos esta cita', `<a class="enlace" href="${ruta('/medico/')}">Volver a mi día</a>`); return; }
  const p = paciente(cita.pacienteId)!;
  const existente = obtener('consultas').find((c) => c.citaId === cita.id);
  if (existente) {
    const rx = obtener('recetas').find((r) => r.consultaId === existente.id);
    ctx.vista.innerHTML = `<div class="alerta verde mb">${icono('check', 18)}<span>Esta consulta ya fue atendida el ${fechaLarga(existente.fecha.slice(0, 10))}.</span></div>
      ${tarjeta(`${icono('expediente')} ${escapar(nombreCompleto(p))}`, `<dl class="ficha-datos"><div><dt>Motivo</dt><dd>${escapar(existente.motivo)}</dd></div><div><dt>Diagnóstico</dt><dd>${escapar(existente.diagnostico)}</dd></div>
        <div style="grid-column:1/-1"><dt>Indicaciones</dt><dd>${escapar(existente.plan)}</dd></div></dl>
        <div class="herramientas" style="margin-top:1rem">${rx ? `<button type="button" class="btn btn-secundario" data-receta="${rx.id}">${icono('pildora', 16)} Ver receta</button>` : ''}<a class="btn btn-primario" href="${enlaceExpediente(p.id)}">${icono('expediente', 16)} Ver expediente</a></div>`)}`;
    ctx.vista.querySelector<HTMLElement>('[data-receta]')?.addEventListener('click', (e) => verReceta((e.currentTarget as HTMLElement).dataset.receta!));
    return;
  }
  if (cita.fecha === hoy() && cita.estado !== 'En consulta') guardarItem('citas', { ...cita, estado: 'En consulta', llegada: cita.llegada ?? new Date().toISOString() });

  const previas = consultasDePaciente(p.id);
  const ultima = previas[0];
  const servicios = obtener('servicios').filter((s) => s.especialidadId === m.especialidadId || s.especialidadId === null);
  const diagnosticos = [...new Set(obtener('consultas').filter((c) => c.medicoId === m.id).map((c) => c.diagnostico))].sort();
  let meds: Medicamento[] = [];
  const s = ultima?.signos;

  ctx.vista.innerHTML = `
    <div class="herramientas mb" style="justify-content:space-between">
      <a class="enlace" href="${ruta('/medico/')}">${icono('izquierda', 14)} Volver a mi día</a>
      <span class="stat-nota">Cita de las ${textoHora(cita.hora)} – ${textoHora(horaFin(cita.hora))} · ${fechaLarga(cita.fecha)}</span>
    </div>
    <div class="grid g-1-2">
      <div class="pila">
        <section class="card"><div class="card-cuerpo">
          <div class="ficha-cab">${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'lg')}<div><h3>${escapar(nombreCompleto(p))}</h3><p class="stat-nota">${p.codigo} · ${textoEdad(p.nacimiento)} · ${p.genero === 'F' ? 'Femenino' : 'Masculino'} · ${escapar(p.sangre || 'Sangre —')}</p></div></div>
          ${p.alergias ? `<div class="alergia mb">${icono('alerta', 18)} Alergias: ${escapar(p.alergias)}</div>` : `<div class="alerta verde mb">${icono('check', 18)}<span>Sin alergias conocidas</span></div>`}
          <dl class="ficha-datos"><div style="grid-column:1/-1"><dt>Antecedentes</dt><dd>${escapar(p.antecedentes || 'Ninguno registrado')}</dd></div>
            <div><dt>Seguro</dt><dd>${escapar(p.seguro || 'Particular')}</dd></div><div><dt>Consultas previas</dt><dd>${previas.length}</dd></div></dl>
          <a class="btn btn-secundario btn-sm" style="margin-top:1rem" href="${enlaceExpediente(p.id)}" target="_blank">${icono('expediente', 16)} Abrir expediente completo</a>
        </div></section>
        ${tarjeta(`${icono('reloj')} Consultas anteriores`, previas.length ? `<div class="lista">${previas.slice(0, 4).map((c) => `<div class="lista-item"><div class="crece"><strong>${escapar(c.diagnostico)}</strong><small>${fechaMedia(c.fecha.slice(0, 10))} · ${escapar(c.signos.presion ? `PA ${c.signos.presion}` : c.motivo)}</small></div></div>`).join('')}</div>` : vacio('🆕', 'Primera consulta'))}
      </div>

      <form class="pila" id="form-consulta" novalidate>
        ${tarjeta(`${icono('actividad')} Signos vitales`, `<div class="signos">
          <label class="signo"><small>Presión</small><input name="presion" placeholder="${escapar(s?.presion || '120/80')}" pattern="\\d{2,3}/\\d{2,3}" /><span>mmHg</span></label>
          <label class="signo"><small>Pulso</small><input name="pulso" type="number" min="30" max="220" placeholder="${s?.pulso ?? 75}" /><span>lpm</span></label>
          <label class="signo"><small>Temperatura</small><input name="temperatura" type="number" step="0.1" min="34" max="43" placeholder="${s?.temperatura ?? 36.5}" /><span>°C</span></label>
          <label class="signo"><small>Peso</small><input name="peso" type="number" step="0.1" min="1" max="300" placeholder="${s?.peso ?? ''}" /><span>kg</span></label>
          <label class="signo"><small>Talla</small><input name="talla" type="number" min="30" max="230" placeholder="${s?.talla ?? ''}" /><span>cm</span></label>
          <label class="signo"><small>Saturación</small><input name="saturacion" type="number" min="50" max="100" placeholder="${s?.saturacion ?? 98}" /><span>% SpO₂</span></label>
        </div><p class="stat-nota" style="margin-top:.5rem" id="imc-texto">Los campos en gris muestran el valor de la consulta anterior.</p>`)}
        ${tarjeta(`${icono('estetoscopio')} Evaluación`, `<div class="form-modal">
          ${campo('Motivo de consulta *', `<input name="motivo" required value="${escapar(cita.motivo)}" />`, 'completo')}
          ${campo('Síntomas / historia', '<textarea name="sintomas" rows="2" placeholder="¿Qué le pasa, desde cuándo...?"></textarea>', 'completo')}
          ${campo('Examen físico', '<textarea name="examen" rows="2" placeholder="Hallazgos de la exploración"></textarea>', 'completo')}
          ${campo('Diagnóstico *', `<input name="diagnostico" required list="lista-dx" placeholder="Escribe o elige un diagnóstico" /><datalist id="lista-dx">${diagnosticos.map((d) => `<option value="${escapar(d)}"></option>`).join('')}</datalist>`, 'completo')}
          ${campo('Plan e indicaciones *', '<textarea name="plan" rows="3" required placeholder="Recomendaciones para el paciente"></textarea>', 'completo')}
        </div>`)}
        <section class="card"><div class="card-cabecera"><h2>${icono('pildora')} Receta</h2><button type="button" class="btn btn-suave btn-sm" id="agregar-med">${icono('mas', 16)} Agregar medicamento</button></div>
          <div class="card-cuerpo"><div id="meds"></div><div id="alerta-alergia"></div></div></section>
        ${tarjeta(`${icono('cruz')} Servicios adicionales y control`, `<div class="opciones-grid">${servicios.map((x) => `<label class="opcion"><input type="checkbox" name="servicio" value="${x.id}" /><div><strong>${escapar(x.nombre)}</strong><small>${x.tipo} · Q ${x.precio}</small></div></label>`).join('')}</div>
          <div class="form-modal" style="margin-top:1rem">${campo('Próximo control (opcional)', `<input name="seguimiento" type="date" min="${sumarDias(hoy(), 1)}" />`)}
          <div class="campo"><span>Accesos rápidos</span><div class="chips">${[7, 15, 30, 90].map((d) => `<button type="button" class="chip" data-control="${d}">${d < 30 ? `${d} días` : `${d / 30} ${d === 30 ? 'mes' : 'meses'}`}</button>`).join('')}</div></div></div>`)}
        <div class="barra-guardar"><span>Al finalizar se genera la receta y el cobro pasa a caja.</span>
          <button type="button" class="btn btn-secundario" id="cancelar-consulta" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.3)">Dejar pendiente</button>
          <button type="submit" class="btn btn-exito">${icono('check', 18)} Finalizar consulta</button></div>
      </form>
    </div>`;

  const form = ctx.vista.querySelector<HTMLFormElement>('#form-consulta')!;
  const cajaMeds = ctx.vista.querySelector<HTMLElement>('#meds')!;
  const pintarMeds = () => {
    cajaMeds.innerHTML = meds.length ? meds.map((x, i) => `<div class="med-fila" data-i="${i}">
      <input class="control" data-campo="nombre" placeholder="Medicamento y concentración" value="${escapar(x.nombre)}" list="lista-meds" />
      <input class="control" data-campo="dosis" placeholder="Dosis" value="${escapar(x.dosis)}" />
      <input class="control" data-campo="frecuencia" placeholder="Frecuencia" value="${escapar(x.frecuencia)}" list="lista-frec" />
      <input class="control" data-campo="duracion" placeholder="Duración" value="${escapar(x.duracion)}" />
      ${botonIcono('borrar', 'Quitar', `data-quitar="${i}"`, 'peligro')}</div>`).join('')
      + `<datalist id="lista-meds">${[...new Set(obtener('recetas').flatMap((r) => r.medicamentos.map((z) => z.nombre)))].sort().map((n) => `<option value="${escapar(n)}"></option>`).join('')}</datalist>
         <datalist id="lista-frec">${['Cada 6 horas', 'Cada 8 horas', 'Cada 12 horas', 'Cada 24 horas', 'Por la noche', 'Si hay dolor'].map((n) => `<option value="${n}"></option>`).join('')}</datalist>`
      : `<p class="stat-nota">Sin medicamentos. Si no necesita receta, déjalo así.</p>`;
    revisarAlergias();
  };
  const revisarAlergias = () => {
    const choques = meds.map((x) => ({ x, a: choqueAlergia(p.alergias, x.nombre) })).filter((z) => z.a);
    ctx.vista.querySelector('#alerta-alergia')!.innerHTML = choques.length ? `<div class="alergia" style="margin-top:.8rem">${icono('alerta', 18)} Cuidado: ${choques.map((z) => `${escapar(z.x.nombre)} (alergia a ${escapar(z.a)})`).join(', ')}</div>` : '';
  };
  cajaMeds.addEventListener('input', (e) => {
    const inp = e.target as HTMLInputElement; const fila = inp.closest<HTMLElement>('[data-i]'); if (!fila) return;
    meds[Number(fila.dataset.i)][inp.dataset.campo as keyof Medicamento] = inp.value;
    if (inp.dataset.campo === 'nombre') revisarAlergias();
  });
  cajaMeds.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-quitar]'); if (!b) return;
    meds.splice(Number(b.dataset.quitar), 1); pintarMeds();
  });
  ctx.vista.querySelector('#agregar-med')!.addEventListener('click', () => {
    meds.push({ nombre: '', dosis: '1 tableta', frecuencia: 'Cada 8 horas', duracion: '5 días' }); pintarMeds();
    cajaMeds.querySelector<HTMLInputElement>(`[data-i="${meds.length - 1}"] input`)?.focus();
  });
  ctx.vista.querySelectorAll<HTMLElement>('[data-control]').forEach((b) => b.addEventListener('click', () => {
    form.querySelector<HTMLInputElement>('[name="seguimiento"]')!.value = sumarDias(hoy(), Number(b.dataset.control));
  }));
  const calcIMC = () => {
    const peso = Number(form.peso.value || form.peso.placeholder); const talla = Number(form.talla.value || form.talla.placeholder);
    const r = imc(peso || null, talla || null);
    ctx.vista.querySelector('#imc-texto')!.textContent = r ? `IMC: ${r.valor} · ${r.texto}` : 'Los campos en gris muestran el valor de la consulta anterior.';
  };
  ['peso', 'talla'].forEach((n) => form.querySelector(`[name="${n}"]`)!.addEventListener('input', calcIMC));
  calcIMC(); pintarMeds();
  ctx.vista.querySelector('#cancelar-consulta')!.addEventListener('click', () => {
    guardarItem('citas', { ...porId('citas', cita.id)!, estado: 'En espera' }); location.href = ruta('/medico/');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const validos = meds.filter((x) => x.nombre.trim());
    if (validos.some((x) => choqueAlergia(p.alergias, x.nombre)) && !(await confirmar('Posible alergia', 'Uno de los medicamentos coincide con una alergia registrada del paciente. ¿Deseas emitir la receta de todas formas?', 'Emitir de todas formas'))) return;
    const f = new FormData(form);
    const num = (n: string) => { const v = String(f.get(n) ?? '').trim(); return v ? Number(v) : null; };
    const cons: Consulta = {
      id: `cs-${cita.id}`, citaId: cita.id, pacienteId: p.id, medicoId: m.id, fecha: new Date().toISOString(),
      motivo: String(f.get('motivo')).trim(), sintomas: String(f.get('sintomas')).trim(), examen: String(f.get('examen')).trim(),
      diagnostico: String(f.get('diagnostico')).trim(), plan: String(f.get('plan')).trim(),
      signos: { presion: String(f.get('presion') ?? '').trim(), pulso: num('pulso'), temperatura: num('temperatura'), peso: num('peso'), talla: num('talla'), saturacion: num('saturacion') },
      servicios: f.getAll('servicio').map(String), seguimiento: String(f.get('seguimiento') || '') || null,
    };
    guardarItem('consultas', cons);
    let receta: Receta | undefined;
    if (validos.length) { receta = { id: `rx-${cita.id}`, consultaId: cons.id, pacienteId: p.id, medicoId: m.id, fecha: cons.fecha, medicamentos: validos, indicaciones: cons.plan }; guardarItem('recetas', receta); }
    const cobro = crearCobro(cons);
    guardarItem('citas', { ...porId('citas', cita.id)!, estado: 'Atendida' });
    const sig = citasDelDia(hoy(), m.id).find((c) => c.estado === 'En espera');
    const d = abrirModal({
      titulo: '✅ Consulta finalizada', ancho: 'sm',
      cuerpo: `<p>La consulta de <strong>${escapar(nombreCompleto(p))}</strong> quedó guardada en su expediente.</p>
        <ul style="margin:1rem 0 0 1.2rem;display:grid;gap:.3rem">${receta ? `<li>Receta con ${receta.medicamentos.length} medicamento(s)</li>` : ''}<li>Cobro de Q ${cobro.total} enviado a caja</li>${cons.seguimiento ? `<li>Próximo control: ${fechaMedia(cons.seguimiento)}</li>` : ''}</ul>`,
      pie: `${receta ? `<button type="button" class="btn btn-secundario" id="ver-rx">${icono('imprimir', 16)} Imprimir receta</button>` : ''}<a class="btn btn-primario" href="${sig ? ruta(`/medico/consulta?c=${sig.id}`) : ruta('/medico/')}">${sig ? `Siguiente: ${escapar(nombreCorto(paciente(sig.pacienteId)))}` : 'Volver a mi día'}</a>`,
      alCerrar: () => { location.href = ruta('/medico/'); },
    });
    d.querySelector('#ver-rx')?.addEventListener('click', () => verReceta(receta!.id));
    aviso('Consulta guardada ✅');
  });
}

// ---------- Mis pacientes ----------
export function pacientesMedico(ctx: Contexto) {
  const m = ctx.medico!;
  let busqueda = '';
  const todos = pacientesDeMedico(m.id).map((p) => {
    const cs = consultasDePaciente(p.id).filter((c) => c.medicoId === m.id);
    return { p, ultima: cs[0], total: cs.length, prox: proximaCita(p.id) };
  }).sort((a, b) => (b.ultima?.fecha ?? '').localeCompare(a.ultima?.fecha ?? ''));
  const pintar = () => {
    const lista = todos.filter(({ p }) => !busqueda || coincide(`${nombreCompleto(p)} ${p.codigo} ${p.telefono}`, busqueda));
    ctx.vista.innerHTML = `<section class="card">
      <div class="card-cabecera"><div class="buscador">${icono('buscar', 18)}<input class="control" id="buscar" placeholder="Buscar por nombre, código o teléfono..." value="${escapar(busqueda)}" /></div><span class="stat-nota">${lista.length} pacientes</span></div>
      <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla">
        <thead><tr><th>Paciente</th><th>Edad</th><th>Última consulta</th><th class="centro">Consultas</th><th>Próxima cita</th><th></th></tr></thead>
        <tbody>${lista.map(({ p, ultima, total, prox }) => `<tr>
          <td><div class="persona">${avatar(nombreCompleto(p), usuarioDe('paciente', p.id)?.color, 'sm')}<div><strong>${escapar(nombreCompleto(p))}</strong><small>${p.codigo}${p.alergias ? ` · <span style="color:var(--rojo);font-weight:700">⚠️ ${escapar(p.alergias)}</span>` : ''}</small></div></div></td>
          <td>${textoEdad(p.nacimiento)}</td>
          <td>${ultima ? `<strong style="font-size:.86rem;display:block">${escapar(ultima.diagnostico)}</strong><small class="stat-nota">${fechaMedia(ultima.fecha.slice(0, 10))}</small>` : '<span class="stat-nota">Aún no atendido</span>'}</td>
          <td class="centro">${total}</td>
          <td>${prox ? `<small>${relativa(prox.fecha)} · ${textoHora(prox.hora)}</small>` : '<span class="stat-nota">—</span>'}</td>
          <td class="derecha"><a class="btn btn-suave btn-sm" href="${enlaceExpediente(p.id)}">${icono('expediente', 15)} Expediente</a></td></tr>`).join('') || `<tr><td colspan="6">${vacio('🔍', 'Sin resultados')}</td></tr>`}</tbody></table></div></div></section>`;
    const b = ctx.vista.querySelector<HTMLInputElement>('#buscar')!;
    b.addEventListener('input', () => { busqueda = b.value; pintar(); const n = ctx.vista.querySelector<HTMLInputElement>('#buscar')!; n.focus(); n.setSelectionRange(busqueda.length, busqueda.length); });
  };
  pintar();
}

// ---------- Expediente ----------
export function expedienteMedico(ctx: Contexto) {
  const p = paciente(parametro('p'));
  if (!p) { ctx.vista.innerHTML = vacio('🔍', 'Paciente no encontrado', `<a class="enlace" href="${ruta('/medico/pacientes')}">Volver a mis pacientes</a>`); return; }
  const hoyCita = citasDelDia(hoy(), ctx.medico!.id).find((c) => c.pacienteId === p.id && ['Confirmada', 'Programada', 'En espera', 'En consulta'].includes(c.estado));
  ctx.vista.innerHTML = `<div class="herramientas mb" style="justify-content:space-between">
      <a class="enlace" href="${ruta('/medico/pacientes')}">${icono('izquierda', 14)} Mis pacientes</a>
      <div class="herramientas"><button type="button" class="btn btn-secundario btn-sm" id="control">${icono('calendario', 16)} Agendar control</button>
      ${hoyCita ? `<a class="btn btn-primario btn-sm" href="${ruta(`/medico/consulta?c=${hoyCita.id}`)}">${icono('estetoscopio', 16)} Atender ahora</a>` : ''}</div></div>
    ${expedienteHTML(p, 'medico')}`;
  enlazarExpediente(ctx.vista, p, ctx.refrescar);
  ctx.vista.querySelector('#control')!.addEventListener('click', () => modalCita({ pacienteId: p.id, medicoId: ctx.medico!.id, elegirPaciente: false, fecha: sumarDias(hoy(), 1), alGuardar: ctx.refrescar }));
}

// ---------- Recetas emitidas ----------
export function recetasMedico(ctx: Contexto) {
  let busqueda = '';
  const todas = obtener('recetas').filter((r) => r.medicoId === ctx.medico!.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pintar = () => {
    const lista = todas.filter((r) => !busqueda || coincide(`${nombreCompleto(paciente(r.pacienteId))} ${r.medicamentos.map((x) => x.nombre).join(' ')}`, busqueda));
    ctx.vista.innerHTML = `
      <div class="grid g3 mb">
        ${stat({ icono: '💊', etiqueta: 'Recetas emitidas', valor: String(todas.length), nota: 'Últimas semanas' })}
        ${stat({ icono: '📅', etiqueta: 'Este mes', valor: String(todas.filter((r) => r.fecha.slice(0, 7) === hoy().slice(0, 7)).length), tono: 'azul' })}
        ${stat({ icono: '🧪', etiqueta: 'Medicamento más recetado', valor: (() => { const c = new Map<string, number>(); todas.forEach((r) => r.medicamentos.forEach((x) => c.set(x.nombre, (c.get(x.nombre) ?? 0) + 1))); return escapar([...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'); })(), tono: 'verde' })}
      </div>
      <section class="card"><div class="card-cabecera"><div class="buscador">${icono('buscar', 18)}<input class="control" id="buscar" placeholder="Buscar por paciente o medicamento..." value="${escapar(busqueda)}" /></div></div>
      <div class="card-cuerpo sin-relleno"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Fecha</th><th>Paciente</th><th>Medicamentos</th><th></th></tr></thead>
      <tbody>${lista.slice(0, 80).map((r) => `<tr><td><strong style="display:block">${fechaCorta(r.fecha.slice(0, 10))}</strong><small class="stat-nota">${relativa(r.fecha.slice(0, 10))}</small></td>
        <td><div class="persona">${avatar(nombreCompleto(paciente(r.pacienteId)), usuarioDe('paciente', r.pacienteId)?.color, 'xs')}<div><strong>${escapar(nombreCompleto(paciente(r.pacienteId)))}</strong></div></div></td>
        <td>${r.medicamentos.map((x) => `<span class="badge" style="margin:.1rem">${escapar(x.nombre)}</span>`).join('')}</td>
        <td class="derecha">${botonIcono('imprimir', 'Ver e imprimir', `data-receta="${r.id}"`)}</td></tr>`).join('') || `<tr><td colspan="4">${vacio('💊', 'Sin recetas')}</td></tr>`}</tbody></table></div></div></section>`;
    const b = ctx.vista.querySelector<HTMLInputElement>('#buscar')!;
    b.addEventListener('input', () => { busqueda = b.value; pintar(); const n = ctx.vista.querySelector<HTMLInputElement>('#buscar')!; n.focus(); n.setSelectionRange(busqueda.length, busqueda.length); });
    ctx.vista.querySelectorAll<HTMLElement>('[data-receta]').forEach((x) => x.addEventListener('click', () => verReceta(x.dataset.receta!)));
  };
  pintar();
}
