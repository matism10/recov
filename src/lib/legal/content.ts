// Textos legales públicos (/privacidad y /terminos). Borrador pendiente de revisión legal.
// Al cambiar un texto, subir LEGAL_VERSION: las cuentas con otra versión aceptada vuelven
// a ver /aceptar-terminos.
export const LEGAL_VERSION = "2026-11-09";
export const LEGAL_UPDATED = "Última actualización: 9 de noviembre de 2026.";
export const LEGAL_DRAFT_NOTE = "Borrador pendiente de revisión legal.";
export const LEGAL_CONTACT = "contacto@recov.cl";

// Texto de las casillas (aceptación y declaración del plantel).
export const GUARDIAN_DECLARATION =
  "Declaro que el club cuenta con la autorización de los apoderados de los jugadores menores de 16 años y con las autorizaciones necesarias para registrar los datos de sus jugadores en Recov.";

export type LegalSection = {
  title: string;
  // Párrafos de texto; `items` es una lista opcional que va después.
  paragraphs?: string[];
  items?: string[];
};

export type LegalDoc = {
  slug: "privacidad" | "terminos";
  title: string;
  sections: LegalSection[];
};

export const PRIVACY: LegalDoc = {
  slug: "privacidad",
  title: "Política de privacidad",
  sections: [
    {
      title: "Quiénes somos",
      paragraphs: [
        "Recov es una plataforma web de seguimiento de lesiones para clubes deportivos amateur, operada por Equipo Recov (contacto@recov.cl). Para los datos de los jugadores de cada plantel, el responsable es el club y Recov actúa como encargado: los trata solo para prestar el servicio. Para los datos del formulario de solicitud de acceso en recov.cl, Recov es el responsable.",
      ],
    },
    {
      title: "Datos que tratamos",
      items: [
        "Cuenta: nombre, correo, foto de perfil (opcional), teléfono (opcional), rol y posición en el plantel.",
        "Salud (datos sensibles): lesiones, zona del cuerpo, gravedad, fases de recuperación, disponibilidad y documentos médicos adjuntos (opcionales).",
        "Carga y rendimiento: asistencia, minutos de partido, esfuerzo percibido por sesión, check de bienestar, sesiones de gimnasio y evaluaciones físicas.",
        "Solicitudes de acceso: los datos que escribes en el formulario de recov.cl.",
      ],
    },
    {
      title: "Para qué los usamos",
      paragraphs: [
        "Para gestionar lesiones, disponibilidad, calendario, nóminas y carga del plantel; para enviar avisos de la cuenta, como la aprobación de un registro; y para dar soporte. No vendemos tus datos ni los usamos para publicidad.",
      ],
    },
    {
      title: "Quién ve qué",
      paragraphs: [
        "Los datos de lesiones y los documentos médicos solo los ve el staff con permiso en tu plantel. Cada jugador ve únicamente lo suyo y no accede a lesiones ni documentos de otros jugadores. El head coach define los permisos del staff.",
      ],
    },
    {
      title: "Seguridad",
      paragraphs: [
        "Cada plantel está aislado de los demás y los permisos se aplican en la base de datos, no solo en la interfaz.",
      ],
    },
    {
      title: "Proveedores y transferencia internacional",
      paragraphs: [
        "Usamos Supabase (base de datos y archivos), Vercel (alojamiento de la aplicación) y Google (envío de correos). Estos proveedores pueden procesar datos fuera de Chile y los usamos solo para operar Recov.",
      ],
    },
    {
      title: "Conservación",
      paragraphs: [
        "Conservamos los datos mientras la cuenta o el plantel estén activos. Si el plantel deja Recov, el head coach puede pedir el borrado de todos sus datos. Los documentos médicos se eliminan junto con la cuenta o el plantel.",
      ],
    },
    {
      title: "Tus derechos",
      paragraphs: [
        "Puedes pedir acceso, rectificación, eliminación u oposición escribiendo a contacto@recov.cl. Respondemos en un máximo de 30 días.",
      ],
    },
    {
      title: "Menores de edad",
      paragraphs: [
        "Los datos de menores de 16 años se tratan con la autorización de sus apoderados, que el club declara tener al crear su plantel.",
      ],
    },
    {
      title: "Cambios",
      paragraphs: [
        "Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha.",
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: "terminos",
  title: "Términos de uso",
  sections: [
    {
      title: "El servicio",
      paragraphs: [
        "Recov permite a un club deportivo amateur registrar lesiones, disponibilidad, calendario, nóminas, carga de entrenamiento y evaluaciones físicas de su plantel. Al registrarte o usar Recov aceptas estos términos y la política de privacidad.",
      ],
    },
    {
      title: "Cuentas y roles",
      paragraphs: [
        "Te registras por el enlace de tu plantel y tu cuenta queda pendiente hasta que la dirección del plantel la apruebe. Cada persona tiene un rol (jugador, head coach, manager, kinesiólogo y otros) con permisos distintos. Eres responsable de la veracidad de tus datos y de mantener tu contraseña en reserva.",
      ],
    },
    {
      title: "Club y Recov",
      paragraphs: [
        "El club es el responsable de los datos de sus jugadores y Recov actúa como su encargado: los trata solo para prestar el servicio, con las medidas de seguridad descritas en la política de privacidad. Al crear el plantel, el head coach u otro responsable del club declara que el club cuenta con la autorización de los apoderados de los jugadores menores de 16 años y con las autorizaciones necesarias para registrar sus datos en Recov.",
      ],
    },
    {
      title: "Uso aceptable",
      paragraphs: [
        "No puedes usar Recov para acceder a datos de otros planteles, intentar vulnerar su seguridad, subir contenido ilegal o ajeno a la gestión deportiva, ni registrar datos de personas sin su autorización o la de su apoderado.",
      ],
    },
    {
      title: "Recov no es consejo médico",
      paragraphs: [
        "La información de Recov apoya la gestión del plantel y no reemplaza el diagnóstico, tratamiento ni indicación de un profesional de la salud. Los avisos como «Carga alta» o «Bajo lo habitual» son orientativos y no predicen lesiones.",
      ],
    },
    {
      title: "Disponibilidad y responsabilidad",
      paragraphs: [
        "Recov se entrega tal como está y puede tener interrupciones o cambios. En la medida que la ley lo permita, Equipo Recov no responde por decisiones deportivas o médicas tomadas a partir de los datos de la plataforma, ni por pérdidas indirectas.",
      ],
    },
    {
      title: "Suspensión y baja",
      paragraphs: [
        "Podemos suspender cuentas que incumplan estos términos. Puedes pedir la eliminación de tu cuenta o de tu plantel escribiendo a contacto@recov.cl, según lo indicado en la política de privacidad.",
      ],
    },
    {
      title: "Cambios",
      paragraphs: [
        "Podemos actualizar estos términos. La versión vigente estará siempre en esta página con su fecha, y el uso continuado de Recov implica su aceptación.",
      ],
    },
    {
      title: "Contacto",
      paragraphs: ["Equipo Recov, contacto@recov.cl. La ley aplicable es la chilena."],
    },
  ],
};
