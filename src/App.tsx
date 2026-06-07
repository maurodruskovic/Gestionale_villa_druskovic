import { useState, useEffect } from "react";
import { Reservation, Settings, Expense } from "./types";
import CalendarView from "./components/CalendarView";
import ReservationForm from "./components/ReservationForm";
import StatsPanel from "./components/StatsPanel";
import SettingsModal from "./components/SettingsModal";
import CommunicationsTemplate from "./components/CommunicationsTemplate";
import ExpensesPanel from "./components/ExpensesPanel";
import VillaDetailsPanel from "./components/VillaDetailsPanel";
import DriveBackupWidget from "./components/DriveBackupWidget";
import { getAccessToken, syncAllDataToDrive } from "./lib/googleDriveSync";
import { 
  supabase, 
  configureSupabase, 
  getIsSupabaseConfigured,
  mapReservationToModel, 
  mapReservationToDB, 
  mapExpenseToModel, 
  mapExpenseToDB, 
  mapSettingsToModel, 
  mapSettingsToDB 
} from "./lib/supabaseClient";
import SupabaseAuthWidget from "./components/SupabaseAuthWidget";
import { 
  Calendar, 
  BarChart3, 
  Sliders, 
  User, 
  Phone, 
  Mail, 
  Clock, 
  FileText, 
  DollarSign, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Eye, 
  Key, 
  CircleAlert, 
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  MapPin,
  Map,
  Star,
  Layers,
  Sparkles,
  DollarSignIcon,
  BadgePercent,
  Cloud
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"calendar" | "stats" | "expenses" | "villa" | "settings">("calendar");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings>({
    valneaPlatformCommissionPercentage: 18,
    valneaOwnerPercentage: 85,
    valneaAgentPercentage: 15,
    valneaPlatformCommissionTaxPercentage: 25,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMutated, setHasMutated] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(getAccessToken());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [isSupabaseActive, setIsSupabaseActive] = useState(false);
  
  // Selection states
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | undefined>(undefined);
  
  // Quick prefill dates from clicking empty calendar cells
  const [calendarSelectStart, setCalendarSelectStart] = useState<string>("");
  const [calendarSelectEnd, setCalendarSelectEnd] = useState<string>("");

  // Persistent calendar currentDate state to avoid resets when switching views
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2026, 4, 1));

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Reservation list searching/filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");

  // Check if we are inside a Supabase OAuth callback popup
  useEffect(() => {
    if (typeof window !== "undefined" && window.opener && (window.location.hash.includes("access_token=") || window.location.search.includes("code="))) {
      const timer = setTimeout(() => {
        try {
          window.opener.postMessage({ type: "OAUTH_AUTH_SUCCESS" }, window.location.origin);
          window.close();
        } catch (e) {
          console.error("Errore nell'inviare il messaggio postMessage alla finestra principale:", e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load reservations, settings and expenses on mount with local-backup sync recovery and Supabase integration
  useEffect(() => {
    async function initFetch() {
      try {
        setLoading(true);
        setError(null);

        // Fetch Supabase configuration from Express backend
        let sUrl = "";
        let sKey = "";
        try {
          const configRes = await fetch("/api/config");
          if (configRes.ok) {
            const configData = await configRes.json();
            sUrl = configData.supabaseUrl;
            sKey = configData.supabasePublishableKey;
          }
        } catch (e) {
          console.error("Errore fetch config:", e);
        }

        const isConfigured = !!sUrl && !!sKey && 
                             sUrl.trim() !== "" && 
                             sKey.trim() !== "" && 
                             !sUrl.includes("placeholder") && 
                             !sUrl.includes("la-tua-url") &&
                             !sUrl.includes("YOUR_SUPABASE_URL") &&
                             (sUrl.startsWith("http://") || sUrl.startsWith("https://"));
        setIsSupabaseActive(isConfigured);

        let finalReservations: Reservation[] = [];
        let finalExpenses: Expense[] = [];
        let finalSettings: Settings = settings;

        if (isConfigured) {
          configureSupabase(sUrl, sKey);
          console.log("Supabase configurato ed attivato.");

          // 1. Fetch from Supabase
          const { data: dbReservations, error: errRes } = await supabase.from("reservations").select("*");
          const { data: dbExpenses, error: errExp } = await supabase.from("expenses").select("*");
          const { data: dbSettings, error: errSet } = await supabase.from("settings").select("*").eq("id", "default").maybeSingle();

          if (errRes) console.error("Errore lettura prenotazioni Supabase:", errRes);
          if (errExp) console.error("Errore lettura spese Supabase:", errExp);
          if (errSet) console.error("Errore lettura settings Supabase:", errSet);

          const hasDbData = (dbReservations && dbReservations.length > 0) || (dbExpenses && dbExpenses.length > 0) || dbSettings;

          if (hasDbData) {
            console.log("Dati caricati con successo da Supabase.");
            finalReservations = (dbReservations || []).map(mapReservationToModel);
            finalExpenses = (dbExpenses || []).map(mapExpenseToModel);
            finalSettings = dbSettings ? mapSettingsToModel(dbSettings) : settings;
          } else {
            console.log("Supabase è configurato ma vuoto. Avvio migrazione dei dati esistenti verso la nuvola Supabase...");
            // Migrate server/local JSON datasets to Supabase!
            const resFetch = await fetch("/api/reservations").catch(() => null);
            const settingsFetch = await fetch("/api/settings").catch(() => null);
            const expensesFetch = await fetch("/api/expenses").catch(() => null);

            let resSrv: Reservation[] = resFetch && resFetch.ok ? await resFetch.json() : [];
            let setSrv: Settings | null = settingsFetch && settingsFetch.ok ? await settingsFetch.json() : null;
            let expSrv: Expense[] = expensesFetch && expensesFetch.ok ? await expensesFetch.json() : [];

            // Offline backup storage recovery fallback
            const backupResStr = localStorage.getItem("backup_reservations");
            const backupExpStr = localStorage.getItem("backup_expenses");
            const backupSetStr = localStorage.getItem("backup_settings");

            if (resSrv.length === 0 && backupResStr) {
              try { resSrv = JSON.parse(backupResStr); } catch (e) {}
            }
            if (expSrv.length === 0 && backupExpStr) {
              try { expSrv = JSON.parse(backupExpStr); } catch (e) {}
            }
            if (!setSrv && backupSetStr) {
              try { setSrv = JSON.parse(backupSetStr); } catch (e) {}
            }

            finalReservations = resSrv;
            finalExpenses = expSrv;
            finalSettings = setSrv || settings;

            // Perform batch migration inserts on Supabase (optional map with current user)
            const currentUserId = (await supabase.auth.getUser()).data.user?.id || null;

            if (finalReservations.length > 0) {
              const dbResToInsert = finalReservations.map(r => mapReservationToDB(r, currentUserId));
              try {
                await supabase.from("reservations").insert(dbResToInsert);
              } catch (e) {
                console.error("Errore migrazione prenotazioni:", e);
              }
            }
            if (finalExpenses.length > 0) {
              const dbExpToInsert = finalExpenses.map(e => mapExpenseToDB(e, currentUserId));
              try {
                await supabase.from("expenses").insert(dbExpToInsert);
              } catch (e) {
                console.error("Errore migrazione spese:", e);
              }
            }
            if (finalSettings) {
              const dbSetToInsert = mapSettingsToDB(finalSettings, currentUserId);
              try {
                await supabase.from("settings").upsert(dbSetToInsert);
              } catch (e) {
                console.error("Errore migrazione impostazioni:", e);
              }
            }
            console.log("Migrazione completata con successo su Supabase!");
          }
        } else {
          // Standard traditional File System JSON / API operations
          console.log("Uso la persistenza API locale.");
          
          const safeFetch = async (url: string, defaultValue: any) => {
            try {
              const res = await fetch(url);
              if (res.ok) {
                return await res.json();
              }
            } catch (err) {
              console.warn(`Dispositivo offline o server non raggiungibile per la rotta ${url}:`, err);
            }
            return defaultValue;
          };

          const [srvRes, srvSets, srvExp] = await Promise.all([
            safeFetch("/api/reservations", []),
            safeFetch("/api/settings", null),
            safeFetch("/api/expenses", [])
          ]);

          // Detect local browser backups
          const backupResStr = localStorage.getItem("backup_reservations");
          const backupExpStr = localStorage.getItem("backup_expenses");
          const backupSetStr = localStorage.getItem("backup_settings");

          finalReservations = srvRes;
          finalExpenses = srvExp;
          finalSettings = srvSets || settings;

          // Auto-recover logic for API fallback
          if (backupResStr) {
            try {
              const backupRes = JSON.parse(backupResStr) as Reservation[];
              if (Array.isArray(backupRes) && backupRes.length > srvRes.length) {
                finalReservations = backupRes;
                for (const r of backupRes) {
                  if (!srvRes.some(sr => sr.id === r.id)) {
                    await fetch("/api/reservations", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(r)
                    }).catch(e => console.error("Error syncing backup res:", e));
                  }
                }
              }
            } catch (e) {}
          }

          if (backupExpStr) {
            try {
              const backupExp = JSON.parse(backupExpStr) as Expense[];
              if (Array.isArray(backupExp) && backupExp.length > srvExp.length) {
                finalExpenses = backupExp;
                for (const exp of backupExp) {
                  if (!srvExp.some(se => se.id === exp.id)) {
                    await fetch("/api/expenses", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(exp)
                    }).catch(e => console.error("Error syncing backup exp:", e));
                  }
                }
              }
            } catch (e) {}
          }

          if (backupSetStr && !srvSets) {
            try {
              const backupSet = JSON.parse(backupSetStr) as Settings;
              finalSettings = backupSet;
              await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(backupSet)
              }).catch(e => console.error("Error syncing backup settings:", e));
            } catch (e) {}
          }
        }

        // Apply state
        setReservations(finalReservations);
        setExpenses(finalExpenses);
        if (finalSettings) {
          setSettings(finalSettings);
        }

        // Force browser update of backup storage
        localStorage.setItem("backup_reservations", JSON.stringify(finalReservations));
        localStorage.setItem("backup_expenses", JSON.stringify(finalExpenses));
        if (finalSettings) {
          localStorage.setItem("backup_settings", JSON.stringify(finalSettings));
        }

      } catch (err) {
        console.error("Errore caricamento dati - attivazione backup offline locale:", err);
        setError("Errore di caricamento. Caricato backup cache locale.");
        
        const bkR = localStorage.getItem("backup_reservations");
        const bkE = localStorage.getItem("backup_expenses");
        const bkS = localStorage.getItem("backup_settings");
        if (bkR) setReservations(JSON.parse(bkR));
        if (bkE) setExpenses(JSON.parse(bkE));
        if (bkS) setSettings(JSON.parse(bkS));
      } finally {
        setLoading(false);
      }
    }
    initFetch();
  }, [supabaseUser, isSupabaseActive]);

  // Synchronous session listener for Auth state
  useEffect(() => {
    let active = true;
    const isMock = !getIsSupabaseConfigured();
    if (!isMock && active) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (active) setSupabaseUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSupabaseUser(session?.user ?? null);
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }
  }, [isSupabaseActive]);

  // Sync state mutations automatically back to local-backups
  useEffect(() => {
    if (reservations && reservations.length > 0) {
      localStorage.setItem("backup_reservations", JSON.stringify(reservations));
    }
  }, [reservations]);

  useEffect(() => {
    if (expenses && expenses.length > 0) {
      localStorage.setItem("backup_expenses", JSON.stringify(expenses));
    }
  }, [expenses]);

  useEffect(() => {
    if (settings) {
      localStorage.setItem("backup_settings", JSON.stringify(settings));
    }
  }, [settings]);

  // Debounced auto-backup sync to Google Drive in the background (runs on changes if logged in AND data has been modified in this session)
  useEffect(() => {
    if (driveToken && !loading && hasMutated) {
      setIsSyncingDrive(true);
      setDriveSyncError(null);
      const timer = setTimeout(() => {
        syncAllDataToDrive(reservations, expenses, settings)
          .then((stats) => {
            console.log("Automatic Google Drive backup updated:", stats.lastUpdated);
            localStorage.setItem("gdrive_last_sync_time", stats.lastUpdated);
            setIsSyncingDrive(false);
          })
          .catch((err) => {
            setIsSyncingDrive(false);
            if (err.message === "SESSION_EXPIRED") {
              console.warn("Automatic Google Drive backup suspended: SESSION_EXPIRED (needs Google login renew)");
              setDriveSyncError("Sessione scaduta");
              setDriveToken(null);
            } else {
              console.error("Automatic Google Drive backup failed:", err);
              setDriveSyncError("Errore salvataggio");
            }
          });
      }, 3000); // 3-second debounce on consecutive rapid typing/changes
      return () => clearTimeout(timer);
    }
  }, [reservations, expenses, settings, loading, hasMutated, driveToken]);

  // Handle Save Expense (Create)
  const handleSaveExpense = async (expData: Omit<Expense, 'id'>): Promise<boolean> => {
    try {
      if (isSupabaseActive) {
        const uId = supabaseUser?.id || null;
        const newId = `exp-${Date.now()}`;
        const newExp: Expense = { ...expData, id: newId };
        const dbRow = mapExpenseToDB(newExp, uId);
        
        const { data, error: sbError } = await supabase.from("expenses").insert(dbRow).select().single();
        if (sbError) {
          setError(`Errore Supabase: ${sbError.message}`);
          return false;
        }
        
        const model = mapExpenseToModel(data);
        setExpenses([...expenses, model]);
        setHasMutated(true);
        return true;
      } else {
        const response = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expData)
        });
        const data = await response.json();
        if (response.ok) {
          setExpenses([...expenses, data]);
          setHasMutated(true);
          return true;
        } else {
          setError(data.message || "Errore durante il salvataggio della spesa.");
          return false;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Errore di rete durante la connessione.");
      return false;
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      triggerConfirm(
        "Elimina Spesa",
        "Sei sicuro di voler eliminare questa spesa dal registro dei flussi?",
        async () => {
          try {
            if (isSupabaseActive) {
              const { error: sbError } = await supabase.from("expenses").delete().eq("id", id);
              if (sbError) {
                setError(`Errore Supabase: ${sbError.message}`);
                return;
              }
              setExpenses(expenses.filter((e) => e.id !== id));
              setHasMutated(true);
            } else {
              const response = await fetch(`/api/expenses/${id}`, {
                method: "DELETE"
              });
              if (response.ok) {
                setExpenses(expenses.filter((e) => e.id !== id));
                setHasMutated(true);
              } else {
                const data = await response.json();
                setError(data.message || "Impossibile eliminare la spesa.");
              }
            }
          } catch (err) {
            console.error(err);
            setError("Errore di rete durante l'eliminazione.");
          } finally {
            resolve();
          }
        }
      );
    });
  };

  // Handle Save Reservation (Create / Update)
  const handleSaveReservation = async (resData: any): Promise<boolean> => {
    setError(null);
    try {
      const isEdit = !!editingReservation;
      
      const start = new Date(resData.checkIn);
      const end = new Date(resData.checkOut);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (isSupabaseActive) {
        const uId = supabaseUser?.id || null;
        const targetId = isEdit ? editingReservation.id : `res-${Date.now()}`;
        const newModel: Reservation = {
          ...resData,
          id: targetId,
          nights
        };
        const dbRow = mapReservationToDB(newModel, uId);
        
        let queryResult;
        if (isEdit) {
          queryResult = await supabase.from("reservations").update(dbRow).eq("id", targetId).select().single();
        } else {
          queryResult = await supabase.from("reservations").insert(dbRow).select().single();
        }
        
        const { data, error: sbError } = queryResult;
        if (sbError) {
          setError(`Errore Supabase: ${sbError.message}`);
          return false;
        }
        
        const savedModel = mapReservationToModel(data);
        if (isEdit) {
          setReservations(reservations.map((r) => r.id === targetId ? savedModel : r));
          if (selectedReservation?.id === targetId) {
            setSelectedReservation(savedModel);
          }
        } else {
          setReservations([...reservations, savedModel]);
        }
        
        setHasMutated(true);
        setIsFormOpen(false);
        setEditingReservation(undefined);
        setCalendarSelectStart("");
        setCalendarSelectEnd("");
        return true;
      } else {
        const url = isEdit ? `/api/reservations/${editingReservation.id}` : "/api/reservations";
        const method = isEdit ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resData)
        });

        const data = await response.json();

        if (response.ok) {
          if (isEdit) {
            setReservations(reservations.map((r) => r.id === editingReservation.id ? data : r));
            if (selectedReservation?.id === editingReservation.id) {
              setSelectedReservation(data);
            }
          } else {
            setReservations([...reservations, data]);
          }
          
          setHasMutated(true);
          setIsFormOpen(false);
          setEditingReservation(undefined);
          setCalendarSelectStart("");
          setCalendarSelectEnd("");
          return true;
        } else {
          setError(data.message || "Errore durante il salvataggio della prenotazione.");
          return false;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Errore di rete o di validazione durante il salvataggio.");
      return false;
    }
  };

  // Handle Delete Reservation
  const handleDeleteReservation = (id: string) => {
    triggerConfirm(
      "Elimina Prenotazione",
      "Sei sicuro di voler eliminare definitivamente questa prenotazione? L'operazione non è reversibile e libererà le date nel calendario.",
      async () => {
        try {
          if (isSupabaseActive) {
            const { error: sbError } = await supabase.from("reservations").delete().eq("id", id);
            if (sbError) {
              setError(`Errore Supabase: ${sbError.message}`);
              return;
            }
            setReservations(reservations.filter((r) => r.id !== id));
            setSelectedReservation(null);
            setHasMutated(true);
          } else {
            const response = await fetch(`/api/reservations/${id}`, {
              method: "DELETE"
            });

            if (response.ok) {
              setReservations(reservations.filter((r) => r.id !== id));
              setSelectedReservation(null);
              setHasMutated(true);
            } else {
              const data = await response.json();
              setError(data.message || "Impossibile eliminare la prenotazione.");
            }
          }
        } catch (err) {
          console.error(err);
          setError("Errore di rete durante l'eliminazione.");
        }
      }
    );
  };

  // Handle Save split Default settings
  const handleSaveSettings = async (newSettings: Settings): Promise<boolean> => {
    try {
      if (isSupabaseActive) {
        const uId = supabaseUser?.id || null;
        const dbRow = mapSettingsToDB(newSettings, uId);
        
        const { data, error: sbError } = await supabase.from("settings").upsert(dbRow).select().single();
        if (sbError) {
          setError(`Errore Supabase: ${sbError.message}`);
          return false;
        }
        
        setSettings(mapSettingsToModel(data));
        setHasMutated(true);
        return true;
      } else {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSettings)
        });

        if (response.ok) {
          const data = await response.json();
          setSettings(data);
          setHasMutated(true);
          return true;
        }
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Helper to calculate pricing breakdown for selected booking to show in details
  const getSelectedBreakdown = () => {
    if (!selectedReservation) return null;
    const res = selectedReservation;
    const extrasTotal = res.extras?.reduce((sum, ext) => sum + ext.price, 0) || 0;

    const matchedChannel = (settings.channels || []).find(
      c => c.name.toLowerCase() === res.source.toLowerCase() || c.id.toLowerCase() === res.source.toLowerCase()
    );

    const isGross = matchedChannel ? matchedChannel.type === "gross" : (res.source === "Valnea");

    if (!isGross) {
      return {
        extrasTotal,
        platformCommission: 0,
        taxValue: 0,
        familyShare: res.totalPrice,
        agentShare: 0,
        netIncome: res.totalPrice + extrasTotal,
        platformCommPct: 0,
        platformTaxPct: 0,
        ownerPct: 100,
        agentPct: 0
      };
    } else {
      // Platform/Agencies deductions
      const platformCommPct = res.valneaPlatformCommissionPercentage ?? (matchedChannel ? matchedChannel.commissionPercentage : settings.valneaPlatformCommissionPercentage);
      const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? (matchedChannel ? matchedChannel.commissionTaxPercentage : settings.valneaPlatformCommissionTaxPercentage);
      const ownerPct = res.valneaOwnerPercentage ?? (matchedChannel ? matchedChannel.ownerPercentage : settings.valneaOwnerPercentage);
      const agentPct = res.valneaAgentPercentage ?? (matchedChannel ? matchedChannel.agentPercentage : settings.valneaAgentPercentage);

      const gross = res.totalPrice;
      const platformCommission = gross * (platformCommPct / 100);
      const remaining = gross - platformCommission;
      
      const agentShare = remaining * (agentPct / 100);
      const familyShare = remaining * (ownerPct / 100);
      const taxValue = platformCommission * (platformTaxPct / 100);
      
      const netIncome = (familyShare - taxValue) + extrasTotal;

      return {
        extrasTotal,
        platformCommission,
        taxValue,
        familyShare,
        agentShare,
        netIncome,
        platformCommPct,
        platformTaxPct,
        ownerPct,
        agentPct
      };
    }
  };

  const breakdown = getSelectedBreakdown();

  // Search/Filter results
  const filteredReservations = reservations
    .filter((res) => {
      const matchesSearch = 
        res.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        res.guestSurname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (res.notes && res.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesSource = filterSource === "all" || res.source === filterSource;
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const isPast = res.checkOut < todayStr;
      
      return matchesSearch && matchesSource && res.status !== "cancelled" && !isPast;
    })
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

  // Render check-in checklist progress badge
  const getChecklistSummary = (res: Reservation) => {
    const tasks = [
      res.checkInStatus.documentsUploaded,
      res.checkInStatus.touristTaxPaid,
      res.checkInStatus.alloggiatiReported,
      res.checkInStatus.keysDelivered,
      res.checkInStatus.depositPaid
    ];
    const completed = tasks.filter(Boolean).length;
    return `${completed}/5`;
  };

  // Source labels/colors helper
  const getSourceBadge = (source: string, res?: Reservation) => {
    const srcLower = (source || "").toLowerCase();
    const chan = (settings.channels || []).find(
      c => c.name.toLowerCase() === srcLower || c.id.toLowerCase() === srcLower
    );

    if (chan) {
      let emoji = "🟣";
      let colorClasses = "bg-purple-50 text-purple-800 border-purple-100";
      if (chan.id.toLowerCase() === "famiglia") {
        emoji = "🟡";
        colorClasses = "bg-amber-50 text-amber-800 border-amber-100";
      } else if (chan.id.toLowerCase() === "novasol") {
        emoji = "🟢";
        colorClasses = "bg-emerald-50 text-emerald-800 border-emerald-100";
      } else if (chan.id.toLowerCase() === "valnea") {
        emoji = "🔵";
        colorClasses = "bg-indigo-50 text-indigo-800 border-indigo-100";
      } else if (chan.type === "gross") {
        emoji = "🟠";
        colorClasses = "bg-sky-50 text-sky-800 border-sky-100";
      }

      const sub = res?.valneaSubChannel ? ` (${res.valneaSubChannel})` : "";
      return (
        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full select-none ${colorClasses}`}>
          {emoji} {chan.name.toUpperCase()}{sub}
        </span>
      );
    }

    // fallback
    const sub = res?.valneaSubChannel ? ` (${res.valneaSubChannel})` : "";
    return (
      <span className="text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-full select-none">
        ❔ {source.toUpperCase()}{sub}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full select-none">CONFERMATA</span>;
      case 'checked_in':
        return <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full select-none">IN CASA</span>;
      case 'checked_out':
        return <span className="text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full select-none">CHECKED OUT</span>;
      case 'cancelled':
        return <span className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full select-none">CANCELLATA</span>;
      default:
        return <span className="text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full select-none">{status.toUpperCase()}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans leading-relaxed">
      
      {/* Top Banner Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">
                  Gestione Prenotazioni Villa
                </h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 mt-0.5">
                  <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Sincronizzato in locale
                  </p>
                  
                  {/* Google Drive Sync Status Badge */}
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setError(null);
                    }}
                    className={`text-[10px] font-extrabold py-0.5 px-2 rounded-full flex items-center gap-1 border transition-all cursor-pointer ${
                      driveToken
                        ? isSyncingDrive
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse"
                          : driveSyncError
                            ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                    title={
                      driveToken
                        ? isSyncingDrive
                          ? "Salvataggio in corso su Google Drive..."
                          : driveSyncError
                            ? `Errore di sincronizzazione: ${driveSyncError}. Clicca per risolvere.`
                            : "Backup Google Drive Connesso e Sincronizzato"
                        : "Google Drive Backup disconfigurato. Clicca per collegare."
                    }
                  >
                    <Cloud className={`w-3 h-3 ${isSyncingDrive ? "animate-spin text-indigo-500" : ""}`} />
                    <span>
                      {driveToken
                        ? isSyncingDrive
                          ? "Salvataggio Drive..."
                          : driveSyncError
                            ? `Errore Backup (${driveSyncError})`
                            : "Backup Drive Attivo"
                        : "Collega Google Drive"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1 self-stretch sm:self-auto select-none overflow-x-auto max-w-full">
            <button
              onClick={() => { setActiveTab("calendar"); setError(null); }}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "calendar"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-4 h-4" /> Calendario & Soggiorni
            </button>
            <button
              onClick={() => { setActiveTab("stats"); setError(null); }}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "stats"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Rendiconto
            </button>
            <button
              onClick={() => { setActiveTab("expenses"); setError(null); }}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "expenses"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Receipt className="w-4 h-4" /> Spese & Flussi
            </button>
            <button
              onClick={() => { setActiveTab("villa"); setError(null); }}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "villa"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <a
                href="https://www.google.com/maps/search/?api=1&query=Villa+Druskovic,+Triban+8,+52460,+Buje,+Croazia"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="hover:scale-120 transition-all p-0.5 rounded hover:bg-slate-150 flex items-center justify-center shrink-0"
                title="Apri localizzazione su Google Maps"
              >
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              </a>
              <span>Villa Druskovic</span>
            </button>
            <button
              onClick={() => { setActiveTab("settings"); setError(null); }}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "settings"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sliders className="w-4 h-4" /> Parametri
            </button>
          </div>
        </div>
      </header>

      {/* Main Wrapper */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Globally displayed error banner */}
        {error && (
          <div className="bg-amber-50 border border-amber-100 text-amber-900 text-xs p-4 rounded-2xl mb-6 shadow-xs flex items-start gap-2.5 animate-bounce">
            <CircleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Attenzione o Errore nel sistema:</span>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="font-black text-rose-700 hover:text-rose-900 px-1 py-0.5">X</button>
          </div>
        )}

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold">Caricamento database prenotazioni in corso...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* TAB 1: CALENDAR AND RESERVATIONS */}
            {activeTab === "calendar" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Visual Calendar Panel - Span 8 */}
                <div className="lg:col-span-8 space-y-4">
                  
                  {isFormOpen ? (
                    <ReservationForm
                      reservation={editingReservation}
                      initialCheckIn={calendarSelectStart}
                      initialCheckOut={calendarSelectEnd}
                      settings={settings}
                      onSave={handleSaveReservation}
                      onCancel={() => {
                        setIsFormOpen(false);
                        setEditingReservation(undefined);
                      }}
                    />
                  ) : (
                    <CalendarView
                      currentDate={calendarDate}
                      onCurrentDateChange={setCalendarDate}
                      reservations={reservations}
                      onSelectReservation={(res) => {
                        setSelectedReservation(res);
                        setError(null);
                      }}
                      onSelectDateRange={(start, end) => {
                        setCalendarSelectStart(start);
                        setCalendarSelectEnd(end);
                        setEditingReservation(undefined);
                        setIsFormOpen(true);
                        setError(null);
                      }}
                      onAddReservationClick={() => {
                        setCalendarSelectStart("");
                        setCalendarSelectEnd("");
                        setEditingReservation(undefined);
                        setIsFormOpen(true);
                        setError(null);
                      }}
                    />
                  )}
                </div>

                {/* Right sidebar panel - Span 4 */}
                <div className="lg:col-span-4 space-y-4">
                  
                  {/* DETAIL VIEW OF CLICKED RESERVATION */}
                  {selectedReservation ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                      
                      {/* Sidebar Header */}
                      <div className="p-4 bg-slate-50 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Dettaglio Soggiorno</p>
                          <h3 className="font-bold text-slate-900 text-sm">
                            {selectedReservation.guestName} {selectedReservation.guestSurname}
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedReservation(null)}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase px-2 py-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Chiudi
                        </button>
                      </div>

                      {/* Info lines */}
                      <div className="p-4 space-y-3.5 text-xs">
                        
                        {/* Source Status */}
                        <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100/60 font-medium">
                          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Fonte Canale:</span>
                          {getSourceBadge(selectedReservation.source, selectedReservation)}
                        </div>

                        {/* Booking Status Badge */}
                        <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100/60 font-medium">
                          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Stato Prenotazione:</span>
                          {getStatusBadge(selectedReservation.status || "confirmed")}
                        </div>

                        {/* Booking Ref */}
                        <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2.5">
                          <span className="text-slate-500 font-semibold">🆔 Rif. Prenotazione:</span>
                          {selectedReservation.bookingRef ? (
                            <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md shadow-3xs">{selectedReservation.bookingRef}</span>
                          ) : (
                            <span className="text-slate-400 italic">Non inserito</span>
                          )}
                        </div>

                        {/* Guests count */}
                        <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2.5">
                          <span className="text-slate-500 font-semibold">👥 Ospiti (Pax):</span>
                          <span className="font-bold text-slate-800 bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded-md">
                            {(selectedReservation.adults !== undefined && selectedReservation.adults !== null && selectedReservation.adults !== "") ? selectedReservation.adults : "1"} {Number(selectedReservation.adults || 1) === 1 ? 'Adulto' : 'Adulti'}
                            {selectedReservation.children ? ` + ${selectedReservation.children} ${Number(selectedReservation.children) === 1 ? 'Bambino' : 'Bambini'}` : ''}
                          </span>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-600 animate-pulse" />
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Arrivo</p>
                              <span className="font-bold text-slate-800">{selectedReservation.checkIn}</span>
                            </div>
                          </div>
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-600 animate-pulse" />
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Partenza</p>
                              <span className="font-bold text-slate-800">{selectedReservation.checkOut}</span>
                            </div>
                          </div>
                        </div>

                        {/* Booking Date */}
                        <div className="p-2.5 bg-indigo-50/40 border border-indigo-100/50 rounded-lg flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <p className="text-[9px] text-indigo-600 uppercase font-bold">Data Prenotazione (fermata stanza)</p>
                            <span className="font-bold text-slate-800 text-xs">
                              {selectedReservation.bookingDate ? (
                                (() => {
                                  try {
                                    const d = new Date(selectedReservation.bookingDate);
                                    if (isNaN(d.getTime())) return selectedReservation.bookingDate;
                                    return d.toLocaleDateString("it-IT", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric"
                                    });
                                  } catch (e) {
                                    return selectedReservation.bookingDate;
                                  }
                                })()
                              ) : (
                                <em className="text-slate-400 font-normal">Non definita</em>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Stay nights */}
                        <div className="flex justify-between border-t border-slate-50 pt-3">
                          <span className="text-slate-500 font-semibold">Durata Soggiorno:</span>
                          <span className="font-bold text-slate-800 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded-md">{selectedReservation.nights} {selectedReservation.nights === 1 ? 'notte' : 'notti'}</span>
                        </div>

                        {/* Nationality */}
                        <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2.5">
                          <span className="text-slate-500 font-semibold">🗺️ Nazionalità:</span>
                          {selectedReservation.guestNationality ? (
                            <span className="font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-100/30 px-2.5 py-0.5 rounded-md uppercase tracking-wide text-[10px]">{selectedReservation.guestNationality}</span>
                          ) : (
                            <span className="text-slate-400 italic">Non specificata</span>
                          )}
                        </div>

                        {/* Contact info */}
                        <div className="space-y-2.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/60">
                          <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400"> recapiti ospite </p>
                          <div className="flex items-center gap-2 text-slate-705">
                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-medium">{selectedReservation.guestPhone || <em className="text-slate-400">Nessun telefono inserito</em>}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-705">
                            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{selectedReservation.guestEmail || <em className="text-slate-400">Nessuna email inserita</em>}</span>
                          </div>
                        </div>

                        {/* Financial balance breakdown */}
                        <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-100">
                          <span className="font-bold text-slate-700 block">Rendimento Economico Famiglia:</span>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Base Soggiorno:</span>
                              <span className="font-semibold text-slate-800">€{selectedReservation.totalPrice.toFixed(2)}</span>
                            </div>

                            {breakdown && breakdown.platformCommPct > 0 && (
                              <div className="space-y-1 text-[11px] text-slate-500 border-l-2 border-indigo-200 pl-2 my-1 bg-slate-100/40 p-1.5 rounded-lg">
                                <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">Dettaglio Ripartizione</p>
                                <div className="flex justify-between">
                                  <span>Provvigione Canale ({breakdown.platformCommPct}%):</span>
                                  <span>-€{breakdown.platformCommission.toFixed(2)}</span>
                                </div>
                                {breakdown.agentShare > 0 && (
                                  <div className="flex justify-between">
                                    <span>Quota Partner Co-host ({breakdown.agentPct}%):</span>
                                    <span>-€{breakdown.agentShare.toFixed(2)}</span>
                                  </div>
                                )}
                                {breakdown.taxValue > 0 && (
                                  <div className="flex justify-between text-rose-650">
                                    <span>Tasse su provvigione ({breakdown.platformTaxPct}%):</span>
                                    <span>-€{breakdown.taxValue.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {breakdown && breakdown.extrasTotal > 0 && (
                              <div className="flex justify-between text-emerald-800">
                                <span>Conto Servizi Extra (al 100% nostro):</span>
                                <span className="font-semibold">+€{breakdown.extrasTotal.toFixed(2)}</span>
                              </div>
                            )}

                            {breakdown && (
                              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5 text-emerald-900">
                                <span className="font-bold">Effettivo Netto a Noi (Famiglia):</span>
                                <span className="text-base font-extrabold text-emerald-600">€{breakdown.netIncome.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Extra Services list summary */}
                        {selectedReservation.extras?.length > 0 && (
                          <div className="border-t border-slate-50 pt-3">
                            <span className="font-bold text-slate-600 block mb-1">Servizi extra inclusi:</span>
                            <div className="flex flex-wrap gap-1">
                              {selectedReservation.extras.map((ext) => (
                                <span key={ext.id} className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg px-2 py-0.5">
                                  {ext.name} (+€{ext.price})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Check-in tasks live checklist */}
                        <div className="space-y-2 border-t border-slate-50 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-600">Stato adempimenti check-in:</span>
                            <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{getChecklistSummary(selectedReservation)}</span>
                          </div>

                          <div className="space-y-1.5 text-[11px] text-slate-600">
                            <div className="flex items-center gap-2">
                              {selectedReservation.checkInStatus.documentsUploaded ? (
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              ) : (
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              )}
                              <span className={selectedReservation.checkInStatus.documentsUploaded ? "font-semibold text-slate-800" : ""}>Certificati d'identità caricati</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedReservation.checkInStatus.touristTaxPaid ? (
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              ) : (
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              )}
                              <span className={selectedReservation.checkInStatus.touristTaxPaid ? "font-semibold text-slate-800" : ""}>Tassa di soggiorno incassata</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedReservation.checkInStatus.alloggiatiReported ? (
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              ) : (
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              )}
                              <span className={selectedReservation.checkInStatus.alloggiatiReported ? "font-semibold text-slate-800" : ""}>Segnalato su Portale Alloggiati Web</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedReservation.checkInStatus.keysDelivered ? (
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              ) : (
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              )}
                              <span className={selectedReservation.checkInStatus.keysDelivered ? "font-semibold text-slate-800" : ""}>Consegna delle chiavi effettuata</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedReservation.checkInStatus.depositPaid ? (
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              ) : (
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              )}
                              <span className={selectedReservation.checkInStatus.depositPaid ? "font-semibold text-slate-800" : ""}>Pagato caparra</span>
                            </div>
                          </div>
                        </div>

                        {/* Notes if any */}
                        {selectedReservation.notes && (
                          <div className="p-2.5 bg-amber-50/50 rounded-lg text-slate-605 border border-amber-100 leading-normal">
                            <p className="font-bold text-[10px] text-amber-800 uppercase">Note di gestione:</p>
                            {selectedReservation.notes}
                          </div>
                        )}

                        {/* Top panel actions buttons */}
                        <div className="flex gap-2 pt-3 border-t border-slate-150">
                          <button
                            onClick={() => {
                              setEditingReservation(selectedReservation);
                              setIsFormOpen(true);
                            }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-indigo-700" /> Modifica
                          </button>
                          
                          <button
                            onClick={() => handleDeleteReservation(selectedReservation.id)}
                            className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Elimina
                          </button>
                        </div>

                      </div>

                      {/* COMMUNICATIONS COMPONENT */}
                      <div className="bg-slate-50/30">
                        <CommunicationsTemplate reservation={selectedReservation} />
                      </div>

                    </div>
                  ) : (
                    
                    /* CHRONOLOGICAL LIST OF UPCOMING RESERVATIONS */
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
                      
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                        <span className="text-xs font-bold text-slate-800 tracking-wider uppercase">Prossimi Soggiorni</span>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{filteredReservations.length} totali</span>
                      </div>

                      {/* Searching inputs */}
                      <div className="space-y-2 text-xs">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            id="sidebar-search-input"
                            type="text"
                            placeholder="Cerca cognome ospite..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full text-xs p-2 pl-7.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <select
                          id="sidebar-filter-select"
                          value={filterSource}
                          onChange={(e) => setFilterSource(e.target.value)}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer font-semibold text-slate-700"
                        >
                          <option value="all">Tutte le fonti</option>
                          {(settings.channels || []).map((chan) => (
                            <option key={chan.id} value={chan.name}>{chan.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Scrollable list of items */}
                      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                        {filteredReservations.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-xs">
                            <p>Nessun soggiorno futuro o corrispondente ai filtri impostati.</p>
                          </div>
                        ) : (
                          filteredReservations.map((res) => {
                            const isSelected = selectedReservation?.id === res.id;
                            const checkInTime = new Date(res.checkIn).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
                            const checkOutTime = new Date(res.checkOut).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

                            const sub = res.source === "Valnea" && res.valneaSubChannel ? ` (${res.valneaSubChannel})` : "";

                            return (
                              <div
                                key={res.id}
                                id={`sidebar-res-card-${res.id}`}
                                onClick={() => setSelectedReservation(res)}
                                className={`p-3 rounded-xl border transition-all text-xs cursor-pointer select-none ${
                                  isSelected 
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                    : "bg-slate-50 hover:bg-slate-100/80 border-slate-150"
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-bold block text-sm">
                                      {res.guestName} {res.guestSurname}
                                    </span>
                                    <span className="text-[10px] tracking-wide mt-0.5 block opacity-90">
                                      {checkInTime} → {checkOutTime} ({res.nights} notti)
                                    </span>
                                  </div>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                    isSelected 
                                      ? "bg-white/20 text-white" 
                                      : "bg-slate-200 text-slate-700 border border-slate-300"
                                  }`}>
                                    {res.source.toUpperCase()}{sub}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-200/50 text-[10px] opacity-90">
                                  <span>Check-in: <strong>{getChecklistSummary(res)}</strong></span>
                                  <span className="font-bold text-sm">
                                    €{res.totalPrice.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  )}
                </div>

              </div>
            )}

            {/* TAB 2: STATISTICS AND REAL-TIME BALANCE REPORTING */}
            {activeTab === "stats" && (
              <StatsPanel reservations={reservations} settings={settings} expenses={expenses} />
            )}

            {/* TAB 3: BUDGET & HOME EXPENSES */}
            {activeTab === "expenses" && (
              <ExpensesPanel
                expenses={expenses}
                reservations={reservations}
                settings={settings}
                onSaveExpense={handleSaveExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}

            {/* TAB 4: VILLA PHYSICAL DETAILS, REVIEWS & GALLERY */}
            {activeTab === "villa" && (
              <VillaDetailsPanel />
            )}

            {/* TAB 5: SPLIT RATIOS SETTINGS */}
            {activeTab === "settings" && (
              <div className="max-w-xl mx-auto py-6 space-y-6">
                <SupabaseAuthWidget key={isSupabaseActive ? "configured" : "not-configured"} onUserChange={(user) => setSupabaseUser(user)} />
                <DriveBackupWidget
                  reservations={reservations}
                  expenses={expenses}
                  settings={settings}
                  parentLoading={loading}
                  onAuthStatusChange={(user, token) => {
                    setDriveToken(token);
                  }}
                  onRestore={async (recoveredData) => {
                    setReservations(recoveredData.reservations);
                    setExpenses(recoveredData.expenses);
                    setSettings(recoveredData.settings);

                    // Sync immediately to the express backend
                    try {
                      await fetch("/api/sync/restore", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          restoredReservations: recoveredData.reservations,
                          restoredExpenses: recoveredData.expenses,
                          restoredSettings: recoveredData.settings
                        })
                      });
                    } catch (e) {
                      console.error("Failed to restore bulk backup on server backend:", e);
                    }
                  }}
                />
                <SettingsModal
                  settings={settings}
                  onSave={handleSaveSettings}
                  onClose={() => setActiveTab("calendar")}
                />
              </div>
            )}

          </div>
        )}

      </main>

      {/* Custom elegant confirmation modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-100 shadow-xl space-y-4">
            <h3 className="text-base font-black text-slate-900">
              ⚠️ {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-500 leading-normal font-medium">
              {confirmModal.message}
            </p>
            <div className="flex gap-2.5 pt-2 select-none text-xs">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-150 py-8 mt-12 text-center text-slate-400 text-xs">
        <p>© 2026 Villa Vacanze - Gestore Prenotazioni di Famiglia.</p>
        <p className="mt-1">Integrazione WhatsApp diretta e Calcolatore Fiscale per Portali.</p>
      </footer>
    </div>
  );
}
