// ============================================================
//  COMPORTAMIENTO DEL PORTAL: usuario, insignias, notificaciones,
//  menú móvil y cierre de sesión
// ============================================================
import { usuarioActual, cerrarSesion } from './sesion';
import { obtener } from './datos';
import {
  ROLES, citasDelDia, cobrosPendientes, solicitudesEnLinea, minutosEspera, paciente, medico, nombreCorto, nombreMedico, especialidad,
  proximaCita, cobrosDePaciente, recetasDePaciente, textoHora,
} from './clinica';
import { avatar } from './vistas';
import { icono } from './iconos';
import { confirmar } from './ui';
import { escapar, haceTiempo, relativa, hoy, monedaCorta, diasEntre } from './formato';
import { ruta } from './ruta';
import type { Usuario } from './tipos';

interface Notificacion { icono: string; titulo: string; texto: string; url: string; fecha?: string; tono: string; }

export function notificacionesDe(u: Usuario): Notificacion[] {
  const lista: Notificacion[] = [];
  const base = `/${u.rol}`;
  if (u.rol === 'medico') {
    const del = citasDelDia(hoy(), u.refId!);
    del.filter((c) => c.estado === 'En espera').forEach((c) => {
      lista.push({ icono: 'sala', titulo: `${nombreCorto(paciente(c.pacienteId))} está en sala de espera`, texto: `Cita de las ${textoHora(c.hora)} · espera ${minutosEspera(c)} min`, url: ruta(`${base}/consulta?c=${c.id}`), fecha: c.llegada ?? undefined, tono: 'ambar' });
    });
    const faltan = del.filter((c) => c.estado === 'Programada' || c.estado === 'Confirmada').length;
    if (faltan) lista.push({ icono: 'calendario', titulo: `${faltan} pacientes más por atender hoy`, texto: 'Revisa tu agenda del día', url: ruta(`${base}/`), tono: 'verde' });
  }
  if (u.rol === 'recepcion' || u.rol === 'admin') {
    const pend = cobrosPendientes();
    if (pend.length) lista.push({ icono: 'caja', titulo: `${pend.length} cobros pendientes en caja`, texto: `Total ${monedaCorta(pend.reduce((s, c) => s + c.total, 0))}`, url: ruta(u.rol === 'admin' ? `${base}/reportes` : `${base}/caja`), tono: 'ambar' });
  }
  if (u.rol === 'recepcion') {
    const sol = solicitudesEnLinea();
    if (sol.length) lista.push({ icono: 'calendario', titulo: `${sol.length} citas pedidas en línea`, texto: 'Confírmalas con el paciente', url: ruta(`${base}/citas?ver=solicitudes`), tono: 'azul', fecha: sol[0].creada });
    citasDelDia(hoy()).filter((c) => c.estado === 'En espera' && minutosEspera(c) >= 20).forEach((c) => {
      lista.push({ icono: 'reloj', titulo: `${nombreCorto(paciente(c.pacienteId))} lleva ${minutosEspera(c)} min esperando`, texto: `Con ${nombreMedico(medico(c.medicoId))}`, url: ruta(`${base}/`), tono: 'rojo' });
    });
  }
  if (u.rol === 'paciente') {
    const prox = proximaCita(u.refId!);
    if (prox && diasEntre(hoy(), prox.fecha) <= 3) {
      const m = medico(prox.medicoId);
      lista.push({ icono: 'calendario', titulo: `Tu cita es ${relativa(prox.fecha).toLowerCase()} a las ${textoHora(prox.hora)}`, texto: `${nombreMedico(m)} · ${especialidad(m?.especialidadId)?.nombre ?? ''}`, url: ruta(`${base}/citas`), tono: 'morado' });
    }
    const pend = cobrosDePaciente(u.refId!).filter((c) => c.estado === 'Pendiente');
    if (pend.length) lista.push({ icono: 'pagos', titulo: 'Tienes un saldo pendiente', texto: `${monedaCorta(pend.reduce((s, c) => s + c.total, 0))} · puedes pagar en caja`, url: ruta(`${base}/pagos`), tono: 'ambar' });
    recetasDePaciente(u.refId!).filter((r) => diasEntre(r.fecha.slice(0, 10), hoy()) <= 7).forEach((r) => {
      lista.push({ icono: 'pildora', titulo: 'Nueva receta disponible', texto: r.medicamentos.map((m) => m.nombre).join(', '), url: ruta(`${base}/recetas`), fecha: r.fecha, tono: 'verde' });
    });
  }
  if (u.rol === 'admin') {
    const canceladas = citasDelDia(hoy()).filter((c) => c.estado === 'Cancelada').length;
    if (canceladas) lista.push({ icono: 'alerta', titulo: `${canceladas} citas canceladas hoy`, texto: 'Revisa la ocupación en reportes', url: ruta(`${base}/reportes`), tono: 'rojo' });
  }
  return lista;
}

function detalleUsuario(u: Usuario) {
  if (u.rol === 'paciente') return `Paciente · ${paciente(u.refId)?.codigo ?? ''}`;
  return u.cargo || ROLES[u.rol].nombre;
}

// Insignias del menú y campana: se repintan cada vez que cambian los datos
function pintarIndicadores() {
  const u = usuarioActual();
  if (!u) return;
  const $ = (id: string) => document.getElementById(id);

  // Insignias del menú
  const poner = (id: string, n: number) => { const el = document.querySelector<HTMLElement>(`[data-insignia="${id}"]`); if (el) { el.hidden = n <= 0; el.textContent = n > 0 ? String(n) : ''; } };
  if (u.rol === 'medico') poner('inicio', citasDelDia(hoy(), u.refId!).filter((c) => c.estado === 'En espera').length);
  if (u.rol === 'recepcion') { poner('caja', cobrosPendientes().length); poner('citas', solicitudesEnLinea().length); poner('inicio', citasDelDia(hoy()).filter((c) => c.estado === 'En espera').length); }
  if (u.rol === 'paciente') { poner('pagos', cobrosDePaciente(u.refId!).filter((c) => c.estado === 'Pendiente').length); poner('citas', obtener('citas').filter((c) => c.pacienteId === u.refId && c.fecha >= hoy() && ['Programada', 'Confirmada'].includes(c.estado)).length); }

  // Notificaciones
  const notifs = notificacionesDe(u);
  const contador = $('notif-cuenta')!;
  contador.hidden = !notifs.length; contador.textContent = notifs.length ? String(notifs.length) : '';
  $('panel-notif')!.innerHTML = `
    <div class="notif-cabecera"><strong>Notificaciones</strong><span>${notifs.length ? `${notifs.length} nuevas` : ''}</span></div>
    ${notifs.length ? notifs.map((n) => `
      <a class="notif tono-${n.tono}" href="${n.url}">
        <span class="notif-icono">${icono(n.icono, 18)}</span>
        <span><strong>${escapar(n.titulo)}</strong><small>${escapar(n.texto.length > 80 ? n.texto.slice(0, 80) + '…' : n.texto)}</small>${n.fecha ? `<em>${haceTiempo(n.fecha)}</em>` : ''}</span>
      </a>`).join('') : `<p class="notif-vacio">🎉 Estás al día. No tienes notificaciones.</p>`}
`;
}

export function montarPortal() {
  const u = usuarioActual();
  if (!u) { cerrarSesion(); return; }
  const $ = (id: string) => document.getElementById(id);

  // Datos del usuario
  const av = avatar(u.nombre, u.color);
  $('lat-avatar')!.outerHTML = av.replace('class="avatar ', 'class="avatar md ');
  $('sup-avatar')!.outerHTML = av.replace('class="avatar ', 'class="avatar sm ');
  $('lat-nombre')!.textContent = u.nombre;
  $('lat-detalle')!.textContent = detalleUsuario(u);
  $('menu-cabecera')!.innerHTML = `<strong>${escapar(u.nombre)}</strong><span>@${escapar(u.usuario)} · ${ROLES[u.rol].nombre}</span>`;
  const sub = $('superior-sub');
  if (sub && !sub.textContent?.trim()) {
    const f = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
    sub.textContent = f.charAt(0).toUpperCase() + f.slice(1);
  }

  pintarIndicadores();
  document.addEventListener('cg:cambio', pintarIndicadores);

  // Desplegables
  const desplegables = [['btn-campana', 'panel-notif'], ['btn-perfil', 'panel-perfil']];
  desplegables.forEach(([b, p]) => {
    $(b)!.addEventListener('click', (e) => {
      e.stopPropagation();
      desplegables.forEach(([, otro]) => { if (otro !== p) $(otro)!.hidden = true; });
      $(p)!.hidden = !$(p)!.hidden;
    });
  });
  document.addEventListener('click', (e) => {
    desplegables.forEach(([, p]) => { if (!$(p)!.contains(e.target as Node)) $(p)!.hidden = true; });
  });

  // Menú móvil
  const lateral = $('lateral')!; const fondo = $('fondo-movil')!;
  const alternar = () => { lateral.classList.toggle('abierto'); fondo.classList.toggle('visible'); };
  $('btn-menu')!.addEventListener('click', alternar);
  fondo.addEventListener('click', alternar);

  // Cerrar sesión
  const salir = async () => { if (await confirmar('¿Cerrar sesión?', 'Volverás a la pantalla de inicio de sesión.', 'Cerrar sesión', false)) cerrarSesion(); };
  $('btn-salir')!.addEventListener('click', salir);
  $('btn-salir-2')!.addEventListener('click', salir);

  document.body.classList.add('listo');
}
