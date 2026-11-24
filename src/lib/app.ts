// ============================================================
//  ARRANQUE DE CADA PÁGINA DEL PORTAL
// ============================================================
import type { Medico, Paciente, Rol, Usuario } from './tipos';
import { usuarioActual } from './sesion';
import { medicoDeUsuario, pacienteDeUsuario } from './clinica';
import { vacio } from './vistas';

export interface Contexto {
  usuario: Usuario;
  rol: Rol;
  vista: HTMLElement;
  medico?: Medico;        // si el usuario es médico
  paciente?: Paciente;    // si el usuario es paciente
  refrescar: () => void;
}

export const parametro = (nombre: string) => new URLSearchParams(location.search).get(nombre);

export function iniciar(render: (ctx: Contexto) => void) {
  let vista = document.getElementById('vista') as HTMLElement;
  const ejecutar = () => {
    const usuario = usuarioActual();
    if (!usuario) return;
    // Se reemplaza el contenedor para limpiar los eventos anteriores
    const nueva = vista.cloneNode(false) as HTMLElement;
    vista.replaceWith(nueva);
    vista = nueva;
    try {
      render({ usuario, rol: usuario.rol, vista, medico: medicoDeUsuario(usuario), paciente: pacienteDeUsuario(usuario), refrescar: ejecutar });
    } catch (e) {
      console.error(e);
      vista.innerHTML = vacio('⚠️', 'No se pudo cargar esta sección', 'Intenta recargar la página.');
    }
  };
  ejecutar();
}
