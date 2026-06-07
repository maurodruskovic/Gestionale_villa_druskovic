import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Ensure data directory and files exist
const DATA_DIR = path.join(process.cwd(), "data");
const RESERVATIONS_FILE = path.join(DATA_DIR, "reservations.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const EXPENSES_FILE = path.join(DATA_DIR, "expenses.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default settings
const DEFAULT_SETTINGS = {
  valneaPlatformCommissionPercentage: 18,
  valneaOwnerPercentage: 85,
  valneaAgentPercentage: 15,
  valneaPlatformCommissionTaxPercentage: 25,
  channels: [
    {
      id: "valnea",
      name: "Valnea",
      type: "gross",
      commissionPercentage: 18,
      commissionTaxPercentage: 25,
      ownerPercentage: 85,
      agentPercentage: 15
    },
    {
      id: "novasol",
      name: "Novasol CLS574",
      type: "net",
      commissionPercentage: 0,
      commissionTaxPercentage: 0,
      ownerPercentage: 100,
      agentPercentage: 0
    },
    {
      id: "famiglia",
      name: "Famiglia",
      type: "net",
      commissionPercentage: 0,
      commissionTaxPercentage: 0,
      ownerPercentage: 100,
      agentPercentage: 0
    }
  ]
};

// Seed/Initial reservations
const DEFAULT_RESERVATIONS: any[] = [];

// Helper to load/save JSON files
function readJSON(filePath: string, defaultValue: any) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Errore durante la lettura di ${filePath}:`, error);
    return defaultValue;
  }
}

function writeJSON(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Errore durante la scrittura di ${filePath}:`, error);
  }
}

// Seed/Initial expenses
const DEFAULT_EXPENSES: any[] = [];

// Load initial arrays
let reservations = readJSON(RESERVATIONS_FILE, DEFAULT_RESERVATIONS);
let settings = readJSON(SETTINGS_FILE, DEFAULT_SETTINGS);
if (!settings.channels || !Array.isArray(settings.channels)) {
  settings.channels = DEFAULT_SETTINGS.channels;
  writeJSON(SETTINGS_FILE, settings);
}
let expenses = readJSON(EXPENSES_FILE, DEFAULT_EXPENSES);

// Helper function to check overlap between reservation date ranges
function checkOverlap(
  checkIn: string, 
  checkOut: string, 
  excludeResId?: string
): { hasOverlap: boolean; overlappingRes?: any } {
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  for (const res of reservations) {
    if (res.id === excludeResId) continue;
    if (res.status === "cancelled") continue;

    const resStart = new Date(res.checkIn);
    const resEnd = new Date(res.checkOut);

    // Overlap formula: A_start < B_end AND B_start < A_end
    if (start < resEnd && resStart < end) {
      return { hasOverlap: true, overlappingRes: res };
    }
  }
  return { hasOverlap: false };
}

// Lazy Gemini client getter
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      console.warn("WARNING: GEMINI_API_KEY non è configurata o è il valore di template.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// ==========================================
// REST API ROUTES
// ==========================================

// Expose Supabase settings dynamically to the frontend
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
  });
});

// Get all reservations
app.get("/api/reservations", (req, res) => {
  res.json(reservations);
});

// Create new reservation
app.post("/api/reservations", (req, res) => {
  const {
    guestName,
    guestSurname,
    guestPhone,
    guestEmail,
    guestNationality,
    bookingRef,
    bookingDate,
    adults,
    children,
    source,
    checkIn,
    checkOut,
    totalPrice,
    notes,
    extras,
    checkInStatus,
    status,
    valneaSubChannel,
    valneaPlatformCommissionPercentage,
    valneaPlatformCommissionTaxPercentage,
    valneaOwnerPercentage,
    valneaAgentPercentage
  } = req.body;

  // Validation
  if (!guestName || !guestSurname || !source || !checkIn || !checkOut || totalPrice === undefined) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Campi obbligatori mancanti." });
  }

  // Overlap check
  const { hasOverlap, overlappingRes } = checkOverlap(checkIn, checkOut);
  if (hasOverlap) {
    const overlapName = `${overlappingRes.guestName} ${overlappingRes.guestSurname}`;
    return res.status(409).json({
      error: "OVERLAP_ERROR",
      message: `Le date selezionate si sovrappongono con la prenotazione di ${overlapName} (${overlappingRes.checkIn} → ${overlappingRes.checkOut}).`
    });
  }

  // Calculate nights
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "La data di check-out deve essere successiva al check-in." });
  }

  const newReservation = {
    id: `res-${Date.now()}`,
    guestName,
    guestSurname,
    guestPhone: guestPhone || "",
    guestEmail: guestEmail || "",
    guestNationality: guestNationality || "",
    bookingRef: bookingRef || "",
    bookingDate: bookingDate || "",
    adults: (adults !== undefined && adults !== null) ? Number(adults) : undefined,
    children: (children !== undefined && children !== null) ? Number(children) : undefined,
    source,
    checkIn,
    checkOut,
    nights,
    totalPrice: Number(totalPrice),
    notes: notes || "",
    extras: extras || [],
    checkInStatus: checkInStatus || {
      documentsUploaded: false,
      touristTaxPaid: false,
      alloggiatiReported: false,
      keysDelivered: false,
      depositPaid: false
    },
    status: status || "confirmed",
    valneaSubChannel: valneaSubChannel || "",
    // Store split overrides if provided
    ...(valneaOwnerPercentage !== undefined ? {
      valneaPlatformCommissionPercentage,
      valneaPlatformCommissionTaxPercentage,
      valneaOwnerPercentage,
      valneaAgentPercentage
    } : {})
  };

  reservations.push(newReservation);
  writeJSON(RESERVATIONS_FILE, reservations);

  res.status(201).json(newReservation);
});

// Update reservation
app.put("/api/reservations/:id", (req, res) => {
  const { id } = req.params;
  const index = reservations.findIndex((r : any) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Prenotazione non trovata." });
  }

  const {
    guestName,
    guestSurname,
    guestPhone,
    guestEmail,
    guestNationality,
    bookingRef,
    bookingDate,
    adults,
    children,
    source,
    checkIn,
    checkOut,
    totalPrice,
    notes,
    extras,
    checkInStatus,
    status,
    valneaSubChannel,
    valneaPlatformCommissionPercentage,
    valneaPlatformCommissionTaxPercentage,
    valneaOwnerPercentage,
    valneaAgentPercentage
  } = req.body;

  // Validation
  if (!guestName || !guestSurname || !source || !checkIn || !checkOut || totalPrice === undefined) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Campi obbligatori mancanti." });
  }

  // Overlap check excluding current ID
  const { hasOverlap, overlappingRes } = checkOverlap(checkIn, checkOut, id);
  if (hasOverlap) {
    const overlapName = `${overlappingRes.guestName} ${overlappingRes.guestSurname}`;
    return res.status(409).json({
      error: "OVERLAP_ERROR",
      message: `Le date selezionate si sovrappongono con la prenotazione di ${overlapName} (${overlappingRes.checkIn} → ${overlappingRes.checkOut}).`
    });
  }

  // Calculate nights
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "La data di check-out deve essere successiva al check-in." });
  }

  reservations[index] = {
    ...reservations[index],
    guestName,
    guestSurname,
    guestPhone: guestPhone || "",
    guestEmail: guestEmail || "",
    guestNationality: guestNationality || "",
    bookingRef: bookingRef || "",
    bookingDate: bookingDate || "",
    adults: (adults !== undefined && adults !== null) ? Number(adults) : undefined,
    children: (children !== undefined && children !== null) ? Number(children) : undefined,
    source,
    checkIn,
    checkOut,
    nights,
    totalPrice: Number(totalPrice),
    notes: notes || "",
    extras: extras || [],
    checkInStatus: checkInStatus || reservations[index].checkInStatus,
    status: status || reservations[index].status,
    valneaSubChannel: valneaSubChannel || "",
    // Store split overrides if provided, otherwise clean up
    ...(valneaOwnerPercentage !== undefined ? {
      valneaPlatformCommissionPercentage,
      valneaPlatformCommissionTaxPercentage,
      valneaOwnerPercentage,
      valneaAgentPercentage
    } : {
      valneaPlatformCommissionPercentage: undefined,
      valneaPlatformCommissionTaxPercentage: undefined,
      valneaOwnerPercentage: undefined,
      valneaAgentPercentage: undefined
    })
  };

  writeJSON(RESERVATIONS_FILE, reservations);
  res.json(reservations[index]);
});

// Delete reservation
app.delete("/api/reservations/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = reservations.length;
  reservations = reservations.filter((r : any) => r.id !== id);

  if (reservations.length === initialLength) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Prenotazione non trovata." });
  }

  writeJSON(RESERVATIONS_FILE, reservations);
  res.json({ success: true, message: "Prenotazione eliminata con successo." });
});

// Get current settings
app.get("/api/settings", (req, res) => {
  res.json(settings);
});

// Save settings
app.post("/api/settings", (req, res) => {
  const {
    valneaPlatformCommissionPercentage,
    valneaOwnerPercentage,
    valneaAgentPercentage,
    valneaPlatformCommissionTaxPercentage,
    channels
  } = req.body;

  settings = {
    valneaPlatformCommissionPercentage: Number(valneaPlatformCommissionPercentage) ?? DEFAULT_SETTINGS.valneaPlatformCommissionPercentage,
    valneaOwnerPercentage: Number(valneaOwnerPercentage) ?? DEFAULT_SETTINGS.valneaOwnerPercentage,
    valneaAgentPercentage: Number(valneaAgentPercentage) ?? DEFAULT_SETTINGS.valneaAgentPercentage,
    valneaPlatformCommissionTaxPercentage: Number(valneaPlatformCommissionTaxPercentage) ?? DEFAULT_SETTINGS.valneaPlatformCommissionTaxPercentage,
    channels: Array.isArray(channels) ? channels : (settings.channels || DEFAULT_SETTINGS.channels)
  };

  writeJSON(SETTINGS_FILE, settings);
  res.json(settings);
});

// Bulk sync/restore all data from backup (Google Drive sync recovery)
app.post("/api/sync/restore", (req, res) => {
  const { restoredReservations, restoredExpenses, restoredSettings } = req.body;

  if (restoredReservations && Array.isArray(restoredReservations)) {
    reservations = restoredReservations;
    writeJSON(RESERVATIONS_FILE, reservations);
  }

  if (restoredExpenses && Array.isArray(restoredExpenses)) {
    expenses = restoredExpenses;
    writeJSON(EXPENSES_FILE, expenses);
  }

  if (restoredSettings) {
    settings = {
      valneaPlatformCommissionPercentage: Number(restoredSettings.valneaPlatformCommissionPercentage) ?? DEFAULT_SETTINGS.valneaPlatformCommissionPercentage,
      valneaOwnerPercentage: Number(restoredSettings.valneaOwnerPercentage) ?? DEFAULT_SETTINGS.valneaOwnerPercentage,
      valneaAgentPercentage: Number(restoredSettings.valneaAgentPercentage) ?? DEFAULT_SETTINGS.valneaAgentPercentage,
      valneaPlatformCommissionTaxPercentage: Number(restoredSettings.valneaPlatformCommissionTaxPercentage) ?? DEFAULT_SETTINGS.valneaPlatformCommissionTaxPercentage,
      channels: Array.isArray(restoredSettings.channels) ? restoredSettings.channels : (settings.channels || DEFAULT_SETTINGS.channels)
    };
    writeJSON(SETTINGS_FILE, settings);
  }

  res.json({ success: true, message: "Sincronizzazione di ripristino completata sul server." });
});

// ==========================================
// EXPENSES API ROUTES
// ==========================================

// Get all expenses
app.get("/api/expenses", (req, res) => {
  res.json(expenses);
});

// Create new expense
app.post("/api/expenses", (req, res) => {
  const { category, customCategoryName, amount, date, notes } = req.body;

  if (!category || amount === undefined || !date) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Campi obbligatori mancanti: categoria, importo e data." });
  }

  const newExpense = {
    id: `exp-${Date.now()}`,
    category,
    customCategoryName: category === "extra" ? (customCategoryName || "Extra") : undefined,
    amount: Number(amount),
    date,
    notes: notes || ""
  };

  expenses.push(newExpense);
  writeJSON(EXPENSES_FILE, expenses);

  res.status(201).json(newExpense);
});

// Delete expense by id
app.delete("/api/expenses/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = expenses.length;
  expenses = expenses.filter((e: any) => e.id !== id);

  if (expenses.length === initialLength) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Spesa non trovata." });
  }

  writeJSON(EXPENSES_FILE, expenses);
  res.json({ success: true, message: "Spesa eliminata con successo." });
});

// Guest communication translator using Gemini
app.post("/api/communicate/translate", async (req, res) => {
  const { text, language, tone } = req.body;

  if (!text || !language) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Il testo e la lingua di destinazione sono obbligatori." });
  }

  const ai = getGeminiClient();

  if (!ai) {
    // If Gemini is not set up, we return a warning message and a backup machine-like notification
    return res.json({
      success: false,
      warning: "GEMINI_API_KEY_MISSING",
      text: `[TRADUZIONE DI CORTESIA (Chiave API non configurata in Impostazioni > Secrets)]\nLingua: ${language}\nTono: ${tone}\n\n${text}`
    });
  }

  try {
    const prompt = `Traduci il seguente messaggio di ospitalità per i turisti che soggiornano nella nostra villa vacanze in Italia.
Messaggio originale: "${text}"
Lingua di destinazione: "${language}"
Tono desiderato: "${tone}"

Linee guida:
- Mantieni la formattazione e la spaziatura.
- Se ci sono segnaposto come [Nome], [Check-in], [Check-out], [Prezzo], o indirizzi, mantienili intatti e cerchiati.
- Rendi il messaggio naturale nella lingua di arrivo, ideale per essere inviato su WhatsApp o Email.
- Non includere traduzioni alternative, spiegazioni o note di accompagnamento. Restituisci esclusivamente il testo finale tradotto.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const translatedText = response.text || "";
    res.json({ success: true, text: translatedText.trim() });
  } catch (error: any) {
    console.error("Errore chiamando Gemini API:", error);
    res.status(500).json({
      error: "GEMINI_ERROR",
      message: "Si è verificatato un errore nell'elaborazione della traduzione AI.",
      details: error.message
    });
  }
});

// ==========================================
// CLIENT BUILD AND STATIC FILES HANDLERS
// ==========================================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built files from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
});
