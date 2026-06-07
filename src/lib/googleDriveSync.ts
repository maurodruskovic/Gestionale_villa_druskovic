import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { Reservation, Expense, Settings } from "../types";

// Initialize Firebase App and Auth (shared instance)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive Scope to manage files created by this app
provider.addScope("https://www.googleapis.com/auth/drive.file");

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getAccessToken();
      if (token) {
        onAuthSuccess(user, token);
      } else {
        // If logged in but token is not in cache/session (e.g., page reload without active token),
        // we'll ask the user to trigger signInWithPopup again
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

// Google Sign-In
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Impossibile recuperare il token di accesso di Google Drive.");
    }
    cachedAccessToken = credential.accessToken;
    // Store temporarily in localStorage safely to preserve across refresh
    localStorage.setItem("gdrive_access_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Errore durante il login Google:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve cached access token
export const getAccessToken = (): string | null => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("gdrive_access_token");
  }
  return cachedAccessToken;
};

// Google Sign-Out
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("gdrive_access_token");
};

// --- GOOGLE DRIVE FILE SYSTEM API INTEGRATION ---

// Helper: Common fetch requests to Google Drive API
async function driveFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Non autenticato con Google Drive. Effettua il login per sincronizzare.");
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`https://www.googleapis.com/${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Errore GDrive (${endpoint}):`, errorBody, "Status:", response.status);
    
    if (response.status === 401) {
      // Clear token to force session reconnection in UI
      cachedAccessToken = null;
      localStorage.removeItem("gdrive_access_token");
      throw new Error("SESSION_EXPIRED");
    }
    
    throw new Error(`Google Drive API errore: ${response.status} ${response.statusText}`);
  }

  return response;
}

// 1. Find or Create App Backup Folder on Google Drive
export async function getOrCreateBackupFolder(): Promise<string> {
  // Query to find if the folder "Backup Villa Druskovic" already exists
  const folderName = "Backup Villa Druskovic";
  const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const response = await driveFetch(`drive/v3/files?q=${query}`);
  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder if not exists
  const createResponse = await driveFetch("drive/v3/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folderData = await createResponse.json();
  return folderData.id;
}

// 2. Upload file (create if doesn't exist, PATCH media content if exists)
export async function saveFileToFolder(
  folderId: string, 
  fileName: string, 
  content: string, 
  mimeType: string = "application/json"
): Promise<string> {
  // Check if file already exists in folder
  const query = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
  const response = await driveFetch(`drive/v3/files?q=${query}`);
  const data = await response.json();

  let fileId = "";

  if (data.files && data.files.length > 0) {
    fileId = data.files[0].id;
  } else {
    // Create new empty file entry
    const createResponse = await driveFetch("drive/v3/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    });
    const createdData = await createResponse.json();
    fileId = createdData.id;
  }

  // PATCH file contents using standard ?uploadType=media
  await driveFetch(`upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      "Content-Type": mimeType,
    },
    body: content,
  });

  return fileId;
}

// 3. Download file contents from Google Drive
export async function downloadFileFromFolder(folderId: string, fileName: string): Promise<string | null> {
  const query = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
  const response = await driveFetch(`drive/v3/files?q=${query}`);
  const data = await response.json();

  if (!data.files || data.files.length === 0) {
    return null;
  }

  const fileId = data.files[0].id;
  const downloadResponse = await driveFetch(`drive/v3/files/${fileId}?alt=media`);
  const fileContent = await downloadResponse.text();
  return fileContent;
}

// --- FULL DATA SYNC CONTROLLER ---

export interface SyncStats {
  reservationsCount: number;
  expensesCount: number;
  lastUpdated: string;
}

// Helper to generate elegant Excel CSV
export function generateExcelCSV(reservations: Reservation[], expenses: Expense[]): string {
  let csvContent = "sep=;\n"; // Force Excel to recognize semicolon separation natively
  
  // Section 1: RESOCONTO GENERALE
  csvContent += "=== RENDICONTO GENERALE VILLA DRUSKOVIC ===\n";
  csvContent += `Data Generazione Backup;${new Date().toLocaleString("it-IT")}\n`;
  csvContent += `Totale Prenotazioni;${reservations.length}\n`;
  csvContent += `Totale Spese Gestione;${expenses.length}\n\n`;

  // Section 2: PRENOTAZIONI
  csvContent += "=== LISTA PRENOTAZIONI ===\n";
  csvContent += "Id;Ospite;Nazionalità;Canale;Data Prenotazione;Check-In;Check-Out;Notti;Prezzo Lordo;commissione;commissione tasse;lordo proprietario;netto famiglia;Note\n";
  
  reservations.forEach(r => {
    // Calculate values corresponding to Stats/Net logic
    const srcLower = r.source.toLowerCase();
    const isGross = srcLower === "valnea";
    const gross = r.totalPrice;
    const commPct = r.valneaPlatformCommissionPercentage ?? 15;
    const taxPct = r.valneaPlatformCommissionTaxPercentage ?? 25;
    const ownerPct = r.valneaOwnerPercentage ?? 85;

    let commissionAmount = 0;
    let taxAmount = 0;
    let netAmount = 0;

    if (isGross) {
      commissionAmount = gross * (commPct / 100);
      const remaining = gross - commissionAmount;
      taxAmount = commissionAmount * (taxPct / 100);
      netAmount = (remaining * (ownerPct / 100)) - taxAmount;
    } else {
      netAmount = gross * (ownerPct / 100);
    }

    const cleanNotes = (r.notes || "").replace(/[\r\n;]/g, " ");

    csvContent += `${r.id};${r.guestName} ${r.guestSurname};${r.guestNationality || "N.D."};${r.source};${r.bookingDate || "N.D."};${r.checkIn};${r.checkOut};${r.nights};${gross.toFixed(2)};${commissionAmount.toFixed(2)};${taxAmount.toFixed(2)};${(gross - commissionAmount).toFixed(2)};${netAmount.toFixed(2)};"${cleanNotes}"\n`;
  });

  csvContent += "\n";

  // Section 3: SPESE GESTIONE
  csvContent += "=== LISTA SPESE CASA ===\n";
  csvContent += "Id;Categoria;Dettaglio Note;Data Spesa;Importo Speso\n";

  expenses.forEach(e => {
    const catName = e.category + (e.customCategoryName ? ` (${e.customCategoryName})` : "");
    const cleanNotes = (e.notes || "").replace(/[\r\n;]/g, " ");
    csvContent += `${e.id};${catName};"${cleanNotes}";${e.date};${e.amount.toFixed(2)}\n`;
  });

  return csvContent;
}

// Main sync: Upload all data to Google Drive
export async function syncAllDataToDrive(
  reservations: Reservation[], 
  expenses: Expense[], 
  settings: Settings
): Promise<SyncStats> {
  const folderId = await getOrCreateBackupFolder();

  // Create Master Backup state representation (unified atomic snapshot)
  const masterBackup = {
    reservations,
    expenses,
    settings,
    timestamp: new Date().toISOString()
  };

  // 1. Save unified atomic master backup
  await saveFileToFolder(folderId, "master_backup.json", JSON.stringify(masterBackup, null, 2));

  // 2. Clear individual files for separation and backward compatibility inspection
  await saveFileToFolder(folderId, "reservations.json", JSON.stringify(reservations, null, 2));
  await saveFileToFolder(folderId, "expenses.json", JSON.stringify(expenses, null, 2));
  await saveFileToFolder(folderId, "settings.json", JSON.stringify(settings, null, 2));

  // 3. Save the Excel-compatible file
  const excelCsv = generateExcelCSV(reservations, expenses);
  await saveFileToFolder(folderId, "Backup_Villa_Druskovic_Excel.csv", excelCsv, "text/csv");

  return {
    reservationsCount: reservations.length,
    expensesCount: expenses.length,
    lastUpdated: new Date().toLocaleString("it-IT"),
  };
}

// Fetch all data from Google Drive (if available) to restore
export async function restoreAllDataFromDrive(): Promise<{
  reservations: Reservation[] | null;
  expenses: Expense[] | null;
  settings: Settings | null;
} | null> {
  const folderId = await getOrCreateBackupFolder();

  // 1. Try master_backup.json first (preferred atomic standard)
  const masterDataStr = await downloadFileFromFolder(folderId, "master_backup.json").catch(() => null);
  if (masterDataStr) {
    try {
      const master = JSON.parse(masterDataStr);
      if (master && (master.reservations || master.expenses)) {
        console.log("Master backup loaded successfully from Google Drive:", master.timestamp);
        return {
          reservations: master.reservations || [],
          expenses: master.expenses || [],
          settings: master.settings || null
        };
      }
    } catch (e) {
      console.warn("Could not parse master_backup.json, falling back to individual files", e);
    }
  }

  // 2. Fallback to individual files
  const rDataStr = await downloadFileFromFolder(folderId, "reservations.json").catch(() => null);
  const eDataStr = await downloadFileFromFolder(folderId, "expenses.json").catch(() => null);
  const sDataStr = await downloadFileFromFolder(folderId, "settings.json").catch(() => null);

  if (!rDataStr && !eDataStr && !sDataStr) {
    return null;
  }

  return {
    reservations: rDataStr ? JSON.parse(rDataStr) : null,
    expenses: eDataStr ? JSON.parse(eDataStr) : null,
    settings: sDataStr ? JSON.parse(sDataStr) : null,
  };
}

// --- VERSION REVISION HISTORY RECOVERY API ---

export interface FileRevision {
  id: string;
  mimeType: string;
  modifiedTime: string;
  keepForever?: boolean;
}

// Retrieve revision history of a specific file in the backup folder
export async function getFileRevisions(fileName: string): Promise<FileRevision[]> {
  const folderId = await getOrCreateBackupFolder();
  const query = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
  const response = await driveFetch(`drive/v3/files?q=${query}`);
  const data = await response.json();

  if (!data.files || data.files.length === 0) {
    return [];
  }

  const fileId = data.files[0].id;
  
  // Use Google Drive revisions resource API
  const revResponse = await driveFetch(`drive/v3/files/${fileId}/revisions?fields=revisions(id,mimeType,modifiedTime,keepForever)`);
  const revData = await revResponse.json();
  
  const list = (revData.revisions || []) as FileRevision[];
  // Sort descending by date (newest first)
  return list.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
}

// Download context of a specific revision of a backup file
export async function downloadFileRevision(fileName: string, revisionId: string): Promise<string> {
  const folderId = await getOrCreateBackupFolder();
  const query = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
  const response = await driveFetch(`drive/v3/files?q=${query}`);
  const data = await response.json();

  if (!data.files || data.files.length === 0) {
    throw new Error(`File ${fileName} non trovato su Drive.`);
  }

  const fileId = data.files[0].id;
  // Fetch revision media
  const downloadResponse = await driveFetch(`drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`);
  const fileContent = await downloadResponse.text();
  return fileContent;
}
