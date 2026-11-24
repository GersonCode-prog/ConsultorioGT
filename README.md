# 🩺 ConsultorioGT — Sistema para clínicas con Astro

Sistema completo para una clínica médica con **4 portales**: Paciente, Médico, Recepción y Administrador. Cada portal tiene su inicio de sesión, su menú y su color. Funciona **sin base de datos**: usa datos ficticios que se guardan en el navegador.

🔗 **Demo en vivo:** https://gersoncode-prog.github.io/ConsultorioGT/

---

## 🔑 Usuarios de prueba

En el inicio de sesión primero eliges tu perfil y luego escribes tu usuario. La contraseña de todos es **`12345`**.

| Portal | Usuario | Quién es |
| --- | --- | --- |
| 🧑 Paciente | `paciente` | Luis Fernando Hernández · alérgico a la penicilina, en control de presión |
| 🩺 Médico | `medico` | Dra. Andrea Morales · Medicina General |
| 🗂️ Recepción | `recepcion` | Karla Pérez · recepción y caja |
| ⚙️ Administrador | `admin` | Mónica Herrera · administración |

Los demás médicos y varios pacientes también tienen usuario (formato `nombre.apellido`) con la misma contraseña. Puedes verlos en **Administrador → Usuarios**.

---

## ✨ Qué hace cada portal

| Portal | Funciones |
| --- | --- |
| **Paciente** | Agenda su cita en línea (especialidad → médico → día y hora), ve y cancela sus citas, imprime sus recetas, consulta su historial con signos vitales y gráfica de presión, y revisa pagos y recibos. |
| **Médico** | “Mi día” con el siguiente paciente y la sala de espera, agenda semanal, consulta completa (signos vitales, IMC, diagnóstico, receta con **alerta de alergias**, servicios extra y próximo control), expediente clínico y recetas emitidas. |
| **Recepción** | Sala de espera en tiempo real (por llegar → en espera → en consulta → atendidos), agenda por médico y hora, citas pedidas en línea para confirmar, registro de pacientes, caja con cambio, recibos, anulaciones y corte del día. |
| **Administrador** | Panel con ingresos, ocupación e inasistencia; médicos con horarios y precios; especialidades y servicios; reportes descargables en CSV; usuarios y configuración de la clínica con respaldo. |

Además hay un **sitio público** con especialidades, médicos, cómo funciona y los portales.

### Recorrido sugerido

1. Entra como **paciente** y agenda una cita en línea.
2. Entra como **recepción**: confírmala en “Pedidas en línea” y marca la llegada de un paciente en la **Sala de espera**.
3. Entra como **médico**: pulsa **Atender**, llena la consulta y emite la receta. Si el paciente tiene una alergia registrada y recetas algo que choca con ella (por ejemplo, amoxicilina con alergia a la penicilina), el sistema te avisa.
4. Vuelve a **recepción**: el cobro aparece en **Caja**; cóbralo e imprime el recibo.
5. Entra como **admin** y revisa el panel y los reportes.

---

## 🛠️ Cómo correrlo en tu computadora

Necesitas [Node.js](https://nodejs.org) 22.23 o más reciente.

```bash
npm install
npm run dev
```

Luego abre **http://localhost:4321/ConsultorioGT/**

> En Windows, si PowerShell bloquea `npm`, usa `npm.cmd install` y `npm.cmd run dev`, o abre una ventana de CMD.

---

## 🗂️ Estructura del proyecto

```text
src/
├── pages/                 # Rutas del sitio
│   ├── index.astro        # Sitio público de la clínica
│   ├── login.astro        # Inicio de sesión por perfil
│   └── paciente/ medico/ recepcion/ admin/   # Una carpeta por portal
├── layouts/               # Portal (menú y protección por rol) y páginas públicas
├── paginas/               # Pantallas de cada portal (TypeScript)
│   └── comun.ts           # Citas, recetas, recibos, expediente y perfil compartidos
├── lib/
│   ├── datos.ts           # "Base de datos" en localStorage
│   ├── semilla.ts         # Genera los datos ficticios
│   ├── clinica.ts         # Reglas: horarios disponibles, estados de cita, cobros…
│   ├── sesion.ts          # Inicio de sesión y roles
│   └── portal.ts          # Menú, insignias y notificaciones
└── styles/global.css      # Sistema de diseño (cada rol tiene su color)
```

---

## 💾 Sobre los datos

- No hay servidor ni base de datos: todo se guarda en el **localStorage** del navegador, así que cada persona que abre la demo tiene su propia copia.
- Los datos se generan con fechas relativas al día de hoy (y la sala de espera según la hora), para que la demo siempre se vea viva.
- Los pacientes, médicos, diagnósticos y recetas son **ficticios**; no es un sistema médico real ni da indicaciones de salud.
- Para empezar de cero: **Administrador → Configuración → Restablecer datos**.
- ⚠️ **Las contraseñas se guardan sin cifrar en el navegador.** Es solo para demostración. Un sistema real necesita servidor, base de datos, contraseñas cifradas y protección de los datos clínicos.

Todo el acceso a los datos está en `src/lib/datos.ts`; ese es el archivo a cambiar para conectarlo a una API real.

---

## 🚀 Publicación

Cada `push` a `main` compila y publica el sitio en GitHub Pages con GitHub Actions (`.github/workflows/deploy.yml`).
En el repositorio: **Settings → Pages → Source: GitHub Actions**.

---

Hecho con [Astro](https://astro.build) por [Gerson Batún](https://github.com/GersonCode-prog).
