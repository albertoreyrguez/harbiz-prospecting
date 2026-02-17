// /lib/harbizCopy.ts

export function sdrNameFromEmail(email: string) {
  const local = (email || "").split("@")[0].trim().toLowerCase();
  if (!local) return "Equipo Harbiz";

  const tokens = local.split(/[._-]+/).filter(Boolean);
  const first = tokens[0] || local;

  return first.charAt(0).toUpperCase() + first.slice(1);
}

function norm(s: string) {
  return (s || "").toLowerCase();
}

function hasAny(text: string, keywords: string[]) {
  const t = norm(text);
  return keywords.some(k => t.includes(k));
}

function pickFirstName(displayName?: string) {
  const s = (displayName || "").trim();
  if (!s) return "";
  const first = s.split(/\s+/)[0];

  if (first.startsWith("@")) return "";
  if (first.length <= 2) return "";
  if (first.toUpperCase() === first) return ""; // suele ser marca

  return first;
}

function detectSignals(bio: string) {
  const t = norm(bio);

  const isOnline = hasAny(t, [
    "online", "en línea", "a distancia", "remoto", "zoom", "videollamada",
    "clases online", "coaching online", "programa online"
  ]);

  const isMexico = hasAny(t, [
    "méxico", "mexico", "cdmx", "ciudad de mexico", "mx", "edomex", "edo mex",
    "guadalajara", "monterrey", "puebla", "querétaro", "queretaro", "tijuana",
    "mérida", "merida", "cancún", "cancun", "roma", "condesa", "polanco",
    "del valle", "narvarte", "coyoacán", "coyoacan", "santa fe"
  ]);

  const looksIndividual = hasAny(t, [
    "coach", "entrenador", "trainer", "pt", "personal trainer",
    "nutri", "nutric", "diet", "fisio", "fisioter", "kine", "rehab",
    "asesorías", "asesorias", "programas", "clientes", "1:1", "uno a uno"
  ]);

  const looksCenter = hasAny(t, [
    "studio", "estudio", "box", "gym", "club", "centro",
    "clases", "horarios", "aforo", "equipo", "profes"
  ]);

  const leadType =
    looksCenter && !looksIndividual ? "center" :
    looksIndividual && !looksCenter ? "individual" :
    (hasAny(t, ["clases", "horarios", "aforo", "equipo"]) ? "center" : "individual");

  let roleOrService: string | null = null;

  if (hasAny(t, ["nutri", "nutric", "diet"])) roleOrService = "nutrición";
  else if (hasAny(t, ["fisio", "fisioter", "kine", "rehab"])) roleOrService = "fisioterapia";
  else if (hasAny(t, ["reformer"])) roleOrService = "pilates reformer";
  else if (hasAny(t, ["pilates"])) roleOrService = "pilates";
  else if (hasAny(t, ["funcional", "hiit", "cross"])) roleOrService = "entrenamiento funcional";
  else if (hasAny(t, ["fuerza", "strength", "powerlifting"])) roleOrService = "fuerza";
  else if (hasAny(t, ["coach", "trainer", "entrenador", "pt", "personal trainer"])) roleOrService = "entrenamiento";

  let detalleInline = "";
  if (isOnline) {
    detalleInline = leadType === "center" ? " y vi que también trabajáis online" : " y vi que trabajas online";
  } else if (roleOrService) {
    if (leadType === "center") detalleInline = ` y vi que tenéis ${roleOrService}`;
    else detalleInline = roleOrService === "entrenamiento" ? " y vi que trabajas como coach/entrenador" : ` y vi que trabajas ${roleOrService}`;
  }

  return { leadType, isOnline, isMexico, detalleInline };
}

export function generateHarbizCopy(params: {
  ownerEmail: string;
  displayName?: string;
  bio?: string;
}) {
  const SDR_NAME = sdrNameFromEmail(params.ownerEmail);
  const name = pickFirstName(params.displayName);
  const bio = params.bio || "";

  const { leadType, isOnline, isMexico, detalleInline } = detectSignals(bio);

  if (leadType === "individual") {
    return [
      `Hola${name ? ` ${name}` : ""}! Soy ${SDR_NAME}.`,
      "",
      `Le eché un vistazo a tu perfil${detalleInline}. En Harbiz ayudamos a coaches${isOnline ? " online" : ""} a ordenar planes, seguimiento y comunicación con clientes en una sola app, sin vivir entre WhatsApp, PDFs y Excel.`,
      `Hoy lo llevas más por ${isOnline ? "WhatsApp/Drive" : "WhatsApp/Excel"} o ya usas alguna app?`
    ].join("\n");
  }

  const paymentsBit = isMexico ? " y membresías/pagos" : "";

  return [
    `Hola! Soy ${SDR_NAME}.`,
    "",
    `Le eché un vistazo a vuestro perfil${detalleInline}. En Harbiz ayudamos a studios a llevar reservas/clases, clientes${paymentsBit} más ordenado en una sola plataforma, sin depender de WhatsApp y hojas sueltas.`,
    `Las reservas las gestionáis por DM/WhatsApp o ya tenéis sistema?`
  ].join("\n");
}
