import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { 
  googleSignIn, 
  googleSignOut, 
  initAuth, 
  syncAllDataToDrive, 
  restoreAllDataFromDrive, 
  getAccessToken,
  getFileRevisions,
  downloadFileRevision,
  FileRevision
} from "../lib/googleDriveSync";
import { Reservation, Expense, Settings } from "../types";
import { 
  Cloud, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  LogOut, 
  FileSpreadsheet, 
  FolderOpen,
  ArrowUpFromLine,
  ArrowDownToLine,
  ExternalLink,
  Loader2,
  History
} from "lucide-react";

interface DriveBackupWidgetProps {
  reservations: Reservation[];
  expenses: Expense[];
  settings: Settings;
  parentLoading: boolean;
  onRestore: (data: {
    reservations: Reservation[];
    expenses: Expense[];
    settings: Settings;
  }) => void;
  onAuthStatusChange?: (user: User | null, token: string | null) => void;
}

export default function DriveBackupWidget({
  reservations,
  expenses,
  settings,
  parentLoading,
  onRestore,
  onAuthStatusChange
}: DriveBackupWidgetProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"sync" | "restore" | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");

  // Version revision recovery state
  const [revisions, setRevisions] = useState<FileRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isHistoryFromMaster, setIsHistoryFromMaster] = useState(true);
  const [hasCheckedAutoRestore, setHasCheckedAutoRestore] = useState(false);
  const [revisionRestoreLoading, setRevisionRestoreLoading] = useState<string | null>(null);

  useEffect(() => {
    // Re-check and restore session on mount if token is saved in localStorage
    const currentToken = getAccessToken();
    if (currentToken) {
      setToken(currentToken);
    }

    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        // Load initial sync timestamp if any saved locally
        const savedTime = localStorage.getItem("gdrive_last_sync_time");
        if (savedTime) setLastSyncTime(savedTime);
        if (onAuthStatusChange) onAuthStatusChange(currentUser, accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        if (onAuthStatusChange) onAuthStatusChange(null, null);
      }
    );

    return () => unsubscribe();
  }, []);

  // Safe Auto-Restore on startup if user is authenticated but UI is completely empty
  useEffect(() => {
    const activeToken = token || getAccessToken();
    if (!parentLoading && !needsAuth && activeToken && !hasCheckedAutoRestore) {
      setHasCheckedAutoRestore(true);
      const isLocalEmpty = reservations.length === 0 && expenses.length === 0;
      if (isLocalEmpty) {
        console.log("Rilevato database locale vuoto all'avvio. Avvio recupero automatico sicuro dal cloud Google Drive...");
        restoreAllDataFromDrive()
          .then((restored) => {
            if (restored && (restored.reservations || restored.expenses || restored.settings)) {
              const recoveredReservations = restored.reservations || [];
              const recoveredExpenses = restored.expenses || [];
              const recoveredSettings = restored.settings || settings;

              onRestore({
                reservations: recoveredReservations,
                expenses: recoveredExpenses,
                settings: recoveredSettings
              });

              setSyncStatus("success");
              setSyncMessage(`Sincronizzazione completata! I tuoi dati erano vuoti ed abbiamo importato automaticamente ${recoveredReservations.length} prenotazioni dal backup Google.`);
            }
          })
          .catch((err) => {
            console.error("Auto restore failed on startup:", err);
          });
      }
    }
  }, [parentLoading, reservations, expenses, needsAuth, token, hasCheckedAutoRestore, onRestore, settings]);

  const handleLogin = async () => {
    setLoading(true);
    setSyncStatus("idle");
    setSyncMessage("");
    setShowRevisions(false);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        setSyncStatus("success");
        setSyncMessage("Connesso correttamente con Google Drive!");
        if (onAuthStatusChange) onAuthStatusChange(result.user, result.accessToken);
        
        // Safety lock: if the screen is currently empty, try to import from Drive, NEVER overwrite with [] empty array.
        const isLocalEmpty = reservations.length === 0 && expenses.length === 0;
        if (isLocalEmpty) {
          setActionLoading("restore");
          setSyncMessage("Connesso! Verifica file di backup su Google Drive...");
          const restored = await restoreAllDataFromDrive().catch(() => null);
          if (restored && (restored.reservations || restored.expenses)) {
            const recoveredReservations = restored.reservations || [];
            const recoveredExpenses = restored.expenses || [];
            const recoveredSettings = restored.settings || settings;

            onRestore({
              reservations: recoveredReservations,
              expenses: recoveredExpenses,
              settings: recoveredSettings
            });

            // Update localStorage representation
            localStorage.setItem("backup_reservations", JSON.stringify(recoveredReservations));
            localStorage.setItem("backup_expenses", JSON.stringify(recoveredExpenses));
            localStorage.setItem("backup_settings", JSON.stringify(recoveredSettings));

            setSyncStatus("success");
            setSyncMessage(`Connesso! Rilevato file di salvataggio: importate automaticamente ${recoveredReservations.length} prenotazioni.`);
          } else {
            setSyncStatus("success");
            setSyncMessage("Connesso correttamente con Google Drive! Nessun backup preventivo trovato nella cartella.");
          }
          setActionLoading(null);
        } else {
          setSyncStatus("success");
          setSyncMessage("Connesso correttamente! Pronto per eseguire o caricare backup.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus("error");
      setSyncMessage("Connessione fallita. Assicurati di accettare i permessi in Google AI Studio.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Sei sicuro di voler scollegare Google Drive? Il salvataggio automatico non sarà più attivo.")) {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setSyncStatus("idle");
      setSyncMessage("");
      setShowRevisions(false);
      setRevisions([]);
      setHasCheckedAutoRestore(false);
      if (onAuthStatusChange) onAuthStatusChange(null, null);
    }
  };

  const handleSync = async (forceToken?: string) => {
    const activeToken = forceToken || token || getAccessToken();
    if (!activeToken) {
      setSyncStatus("error");
      setSyncMessage("La sessione Google Drive è scaduta o non valida. Effettua nuovamente l'accesso cliccando sul tasto login.");
      setNeedsAuth(true);
      return;
    }

    setActionLoading("sync");
    setSyncStatus("idle");
    try {
      const stats = await syncAllDataToDrive(reservations, expenses, settings);
      const timestamp = stats.lastUpdated;
      setLastSyncTime(timestamp);
      localStorage.setItem("gdrive_last_sync_time", timestamp);
      setSyncStatus("success");
      setSyncMessage(`Backup completato! Caricate ${stats.reservationsCount} prenotazioni e ${stats.expensesCount} spese.`);
    } catch (err: any) {
      console.error(err);
      if (err.message === "SESSION_EXPIRED") {
        setSyncStatus("error");
        setSyncMessage("Sessione Google Drive scaduta per sicurezza. Clicca su 'Scollega' (in alto a destra) e poi accedi di nuovo per sbloccare!");
        setNeedsAuth(true);
        if (onAuthStatusChange) onAuthStatusChange(null, null);
      } else {
        setSyncStatus("error");
        setSyncMessage("Errore durante il caricamento del backup. Google Drive non risponde.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async () => {
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      setSyncStatus("error");
      setSyncMessage("Token non valido o scaduto. Effettua nuovamente il Login.");
      setNeedsAuth(true);
      return;
    }

    const confirmRestore = window.confirm(
      "Sei sicuro? Questo ripristinerà TUTTE le prenotazioni, spese e configurazioni salvate su questo Google Drive. I tuoi dati attuali locali in cache verranno sostituiti."
    );
    if (!confirmRestore) return;

    setActionLoading("restore");
    setSyncStatus("idle");
    try {
      const restored = await restoreAllDataFromDrive();
      if (!restored) {
        setSyncStatus("error");
        setSyncMessage("Nessun frammento di backup trovato su Google Drive per questa applicazione.");
        return;
      }

      const recoveredReservations = restored.reservations || [];
      const recoveredExpenses = restored.expenses || [];
      const recoveredSettings = restored.settings || settings;

      onRestore({
        reservations: recoveredReservations,
        expenses: recoveredExpenses,
        settings: recoveredSettings
      });

      setSyncStatus("success");
      setSyncMessage(`Dati ripristinati con successo! Caricate ${recoveredReservations.length} prenotazioni e ${recoveredExpenses.length} spese.`);
      
      // Update local storage representation
      localStorage.setItem("backup_reservations", JSON.stringify(recoveredReservations));
      localStorage.setItem("backup_expenses", JSON.stringify(recoveredExpenses));
      localStorage.setItem("backup_settings", JSON.stringify(recoveredSettings));

    } catch (err: any) {
      console.error(err);
      if (err.message === "SESSION_EXPIRED") {
        setSyncStatus("error");
        setSyncMessage("La tua sessione di Google Drive è scaduta per sicurezza. Clicca su 'Scollega' (in alto a destra) e poi accedi di nuovo!");
        setNeedsAuth(true);
        if (onAuthStatusChange) onAuthStatusChange(null, null);
      } else {
        setSyncStatus("error");
        setSyncMessage("Impossibile recuperare il backup salvato su Google Drive.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Fetch revisions from the Google cloud version pool
  const fetchRevisionsHistory = async () => {
    setRevisionsLoading(true);
    setSyncStatus("idle");
    setSyncMessage("");
    setShowRevisions(false);
    try {
      // 1. First probe unified master_backup.json revisions (represents 100% complete synchronizations)
      console.log("Downloading revision logs for master_backup.json...");
      let historyList = await getFileRevisions("master_backup.json").catch(() => []);
      let activeSourceIsMaster = true;

      // 2. If no master backup, look up individual reservations fallback
      if (historyList.length === 0) {
        console.log("Downloading fallback revision logs for reservations.json...");
        historyList = await getFileRevisions("reservations.json").catch(() => []);
        activeSourceIsMaster = false;
      }

      setIsHistoryFromMaster(activeSourceIsMaster);
      setRevisions(historyList.slice(0, 10)); // keep up to last 10 revisions
      setShowRevisions(true);

      if (historyList.length === 0) {
        setSyncStatus("error");
        setSyncMessage("Nessuna versione precedente del backup registrata in questa cartella Google Drive.");
      } else {
        setSyncStatus("success");
        setSyncMessage(activeSourceIsMaster 
          ? "Caricata la cronologia storica degli Snapshot Unificati (master_backup.json)" 
          : "Caricata la cronologia storica classica (reservations.json)"
        );
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "SESSION_EXPIRED") {
        setSyncStatus("error");
        setSyncMessage("Scollega ed effettua nuovamente l'accesso con Google per sfogliare la cronologia storica.");
        setNeedsAuth(true);
      } else {
        setSyncStatus("error");
        setSyncMessage("Impossibile caricare il log storico delle versioni.");
      }
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleRestoreRevision = async (revisionId: string, modifiedTime: string) => {
    const formattedDate = new Date(modifiedTime).toLocaleString("it-IT");
    const confirmMessage = `Vuoi davvero recuperare il backup storico del ${formattedDate}?\n\nTutte le prenotazioni e spese correnti verranno sostituite con questa versione storica recuperata dai server Google.`;
    
    if (!window.confirm(confirmMessage)) return;

    setRevisionRestoreLoading(revisionId);
    setSyncStatus("idle");
    setSyncMessage("");
    try {
      let recoveredReservations: Reservation[] = [];
      let recoveredExpenses: Expense[] = [];
      let recoveredSettings: Settings = settings;

      if (isHistoryFromMaster) {
        // Atomic direct download: entire system state at physical modified moment (reservations AND expenses fully synced)
        console.log("Downloading atomic revision from master_backup.json direct media stream...");
        const masterRaw = await downloadFileRevision("master_backup.json", revisionId);
        const parsed = JSON.parse(masterRaw);
        recoveredReservations = parsed.reservations || [];
        recoveredExpenses = parsed.expenses || [];
        recoveredSettings = parsed.settings || settings;
      } else {
        // Old separate files fallback representation
        console.log("Downloading single reservation file revision...");
        const resRaw = await downloadFileRevision("reservations.json", revisionId);
        recoveredReservations = JSON.parse(resRaw) as Reservation[];
        recoveredExpenses = expenses; // maintain current fallback
        recoveredSettings = settings;
      }

      // 3. Save states
      onRestore({
        reservations: recoveredReservations,
        expenses: recoveredExpenses,
        settings: recoveredSettings
      });

      setSyncStatus("success");
      setSyncMessage(`Ripristino storico completato! Recuperata con successo la versione del ${formattedDate} con ${recoveredReservations.length} prenotazioni.`);
      
      // Update local storage representation
      localStorage.setItem("backup_reservations", JSON.stringify(recoveredReservations));
      localStorage.setItem("backup_expenses", JSON.stringify(recoveredExpenses));
      localStorage.setItem("backup_settings", JSON.stringify(recoveredSettings));

    } catch (err: any) {
      console.error(err);
      if (err.message === "SESSION_EXPIRED") {
        setSyncStatus("error");
        setSyncMessage("Scollega ed effettua nuovamente l'accesso con Google per scaricare questo backup.");
        setNeedsAuth(true);
      } else {
        setSyncStatus("error");
        setSyncMessage("Errore critico nel download della copia storica selezionata.");
      }
    } finally {
      setRevisionRestoreLoading(null);
    }
  };

  return (
    <div id="drive-backup" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 font-sans text-slate-800">
      
      {/* Widget Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
          <Cloud className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight leading-none">
            Backup Google Drive & Excel
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">
            Salvataggio cloud della Famiglia Druskovic
          </p>
        </div>
      </div>

      {/* Ephemeral resets Warning Box */}
      <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-[11px] leading-relaxed text-slate-500 font-medium">
          <span className="font-bold text-slate-700">Come ripristinare i dati storici? </span>
          L'applicazione salva automaticamente i backup su Drive. Se hai sovrascitto i dati o trovi tutto vuoto, puoi <span className="text-indigo-600 font-bold">navigare e recuperare ogni singola versione oraria passata</span> direttamente con il tasto di cronologia qui sotto, ripescando i tuoi vecchi inserimenti all'istante!
        </div>
      </div>

      {/* Widget Content (Depends on state) */}
      {needsAuth ? (
        <div className="pt-2 text-center space-y-3.5">
          <p className="text-xs text-slate-500 leading-normal font-medium px-2">
            Collega il tuo account Google Drive per archiviare, scaricare l'Excel o ripristinare prenotazioni perse.
          </p>
          
          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full max-w-xs mx-auto flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-2.5 px-4 border border-slate-250 rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 select-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span>Connessione in corso...</span>
              </>
            ) : (
              <>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span>Accedi e Connetti Google Drive</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          
          {/* User Account Details */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-150 p-3 rounded-xl">
            <div className="flex items-center gap-2.5">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Avatar" 
                  className="w-7 h-7 rounded-full border border-slate-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 bg-emerald-100 text-emerald-700 font-bold rounded-full flex items-center justify-center text-xs shrink-0">
                  {user?.displayName ? user.displayName.charAt(0) : "G"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-800 truncate leading-tight">
                  {user?.displayName || "Utente Google"}
                </p>
                <p className="text-[9px] text-slate-400 font-medium truncate leading-none mt-0.5">
                  {user?.email || "Email non disponibile"}
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer shrink-0 animate-pulse"
              title="Scollega Account Google"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Sync Operations buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            
            <button
              onClick={() => handleSync()}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-250 hover:bg-slate-50 bg-white font-bold text-[11px] rounded-lg cursor-pointer transition-all text-slate-700 shadow-3xs disabled:opacity-50 select-none"
            >
              {actionLoading === "sync" ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
              ) : (
                <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span>Salva Backup Ora</span>
            </button>

            <button
              onClick={handleRestore}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-indigo-100 hover:bg-indigo-50 bg-indigo-50/50 font-bold text-[11px] rounded-lg cursor-pointer transition-all text-indigo-700 shadow-3xs disabled:opacity-50 select-none hover:border-indigo-200"
            >
              {actionLoading === "restore" ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
              ) : (
                <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              )}
              <span>Sincronizza Ultimo</span>
            </button>

          </div>

          {/* Historical versions toggle button */}
          <button
            onClick={fetchRevisionsHistory}
            disabled={revisionsLoading}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 border border-slate-950 text-white font-bold text-xs rounded-xl cursor-pointer hover:bg-slate-850 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {revisionsLoading ? (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
            ) : (
              <History className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>Mostra Cronologia Versioni (Recupero Dati)</span>
          </button>

          {/* REVISIONS DROP DOWN LIST */}
          {showRevisions && revisions.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 max-h-52 overflow-y-auto space-y-2 mt-2 animate-fade-in">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-1">
                Copie di Backup Disponibili su Google Cloud (newest first):
              </span>
              <div className="space-y-1.5">
                {revisions.map((rev, index) => {
                  const formattedDate = new Date(rev.modifiedTime).toLocaleString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  });
                  return (
                    <div key={rev.id} className="flex items-center justify-between text-[11px] p-2 bg-white rounded-lg border border-slate-150 shadow-4xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">
                          {index === 0 ? "🔄 Ultima Copia (Potrebbe essere vuota)" : `💾 Snapshot Storico #${index}`}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                          Aggiornato il: {formattedDate}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRestoreRevision(rev.id, rev.modifiedTime)}
                        disabled={revisionRestoreLoading !== null}
                        className="py-1 px-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-md hover:bg-emerald-150 border border-emerald-100 transition-colors cursor-pointer select-none disabled:opacity-50"
                      >
                        {revisionRestoreLoading === rev.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        ) : (
                          "Ripristina"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Excel / Folders Informative section */}
          <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl space-y-1.5 text-[11px]">
            <p className="font-bold text-emerald-800 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Sincronizzazione Attiva (Drive Cloud)
            </p>
            <p className="text-slate-500 font-semibold leading-relaxed">
              La cartella <strong className="text-slate-700">"Backup Villa Druskovic"</strong> nel tuo Google Drive contiene i file json sempre salvati e una copia aggiornata in formato <strong className="text-emerald-700 flex items-center gap-0.5 inline-flex"><FileSpreadsheet className="w-3 h-3 text-emerald-650 inline" /> Excel (Backup_Villa_Druskovic_Excel.csv)</strong> con formule per aperture repentine!
            </p>
          </div>

          {/* Dynamic Sync Status Label */}
          {lastSyncTime && (
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium font-mono border-t border-slate-100 pt-3 px-1">
              <span>ULTIMO AGGIORNAMENTO:</span>
              <span className="font-bold text-slate-500">{lastSyncTime}</span>
            </div>
          )}

        </div>
      )}

      {/* Operation logs feedback banner */}
      {syncStatus !== "idle" && (
        <div className={`text-[10px] p-2.5 rounded-lg font-bold flex items-start gap-1.5 ${
          syncStatus === "success" 
            ? "bg-emerald-50 border border-emerald-100 text-emerald-900" 
            : "bg-rose-50 border border-rose-100 text-rose-900"
        }`}>
          {syncStatus === "success" ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-snug">{syncMessage}</span>
        </div>
      )}

    </div>
  );
}
