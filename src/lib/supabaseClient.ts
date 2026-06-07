import { createClient } from "@supabase/supabase-js";

// Se il progetto è Vite, usa esclusivamente:
// - import.meta.env.VITE_SUPABASE_URL
// - import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const buildUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const buildKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Controllo esplicito richiesto:
// - se manca una env, mostra errore chiaro
// - se entrambe esistono, inizializza Supabase con createClient
if (buildUrl && !buildKey) {
  console.error("ERRORE CONFIGURAZIONE SUPABASE: La variabile d'ambiente 'VITE_SUPABASE_URL' è presente, ma manca 'VITE_SUPABASE_PUBLISHABLE_KEY'.");
} else if (!buildUrl && buildKey) {
  console.error("ERRORE CONFIGURAZIONE SUPABASE: La variabile d'ambiente 'VITE_SUPABASE_PUBLISHABLE_KEY' è presente, ma manca 'VITE_SUPABASE_URL'.");
} else if (buildUrl && buildKey) {
  console.log("Inizializzazione Supabase centralizzata completata tramite variabili d'ambiente client Vite.");
}

const initialUrl = buildUrl || "https://placeholder.supabase.co";
const initialKey = buildKey || "placeholder-key";

// Always initialize a default instance
export let supabase = createClient(initialUrl, initialKey);

/**
 * Configure or re-initialize the Supabase client dynamically.
 * This is useful if the config is fetched from the backend (API) at runtime.
 */
export function configureSupabase(url: string, key: string) {
  if (url && key && url !== "placeholder" && key !== "placeholder") {
    const isUrlOk = url.startsWith("http://") || url.startsWith("https://");
    if (!isUrlOk) {
      console.warn("Invalid Supabase URL format. Must start with http:// or https://", url);
      return;
    }
    try {
      if (url && !key) {
        console.error("ERRORE CONFIGURAZIONE SUPABASE (API RUNTIME): Manca la chiave publishable.");
        return;
      } else if (!url && key) {
        console.error("ERRORE CONFIGURAZIONE SUPABASE (API RUNTIME): Manca l'URL di Supabase.");
        return;
      }
      supabase = createClient(url, key);
    } catch (e) {
      console.error("Failed to initialize Supabase client with URL:", url, e);
    }
  }
}

/**
 * Clean helper to check if Supabase is properly configured
 * without accessing protected class fields.
 */
export function getIsSupabaseConfigured(): boolean {
  try {
    return !!supabase && 
           supabase.auth !== undefined && 
           !(supabase as any).supabaseUrl?.includes("placeholder.supabase.co") &&
           ((supabase as any).supabaseUrl?.startsWith("http://") || (supabase as any).supabaseUrl?.startsWith("https://"));
  } catch (e) {
    return false;
  }
}

// Helpers for mapping Database <=> TypeScript Models

export interface DBReservation {
  id: string;
  guest_name: string;
  guest_surname: string;
  guest_phone: string;
  guest_email: string;
  guest_nationality: string;
  booking_ref: string;
  booking_date: string;
  adults?: number;
  children?: number;
  source: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_price: number;
  notes: string;
  extras: any;
  check_in_status: any;
  status: string;
  valnea_sub_channel?: string;
  valnea_platform_commission_percentage?: number;
  valnea_platform_commission_tax_percentage?: number;
  valnea_owner_percentage?: number;
  valnea_agent_percentage?: number;
  user_id?: string;
}

export interface DBExpense {
  id: string;
  category: string;
  custom_category_name?: string;
  amount: number;
  date: string;
  notes: string;
  user_id?: string;
}

export interface DBSettings {
  id: string;
  valnea_platform_commission_percentage: number;
  valnea_owner_percentage: number;
  valnea_agent_percentage: number;
  valnea_platform_commission_tax_percentage: number;
  channels: any;
  user_id?: string;
}

export function mapReservationToModel(db: DBReservation): any {
  return {
    id: db.id,
    guestName: db.guest_name,
    guestSurname: db.guest_surname,
    guestPhone: db.guest_phone,
    guestEmail: db.guest_email || undefined,
    guestNationality: db.guest_nationality || undefined,
    bookingRef: db.booking_ref || undefined,
    bookingDate: db.booking_date || undefined,
    adults: db.adults,
    children: db.children,
    source: db.source,
    checkIn: db.check_in,
    checkOut: db.check_out,
    nights: db.nights,
    totalPrice: db.total_price,
    notes: db.notes || undefined,
    extras: Array.isArray(db.extras) ? db.extras : [],
    checkInStatus: db.check_in_status || {
      documentsUploaded: false,
      touristTaxPaid: false,
      alloggiatiReported: false,
      keysDelivered: false,
      depositPaid: false
    },
    status: db.status as any,
    valneaSubChannel: db.valnea_sub_channel || undefined,
    valneaPlatformCommissionPercentage: db.valnea_platform_commission_percentage || undefined,
    valneaPlatformCommissionTaxPercentage: db.valnea_platform_commission_tax_percentage || undefined,
    valneaOwnerPercentage: db.valnea_owner_percentage || undefined,
    valneaAgentPercentage: db.valnea_agent_percentage || undefined
  };
}

export function mapReservationToDB(model: any, userId?: string | null): DBReservation {
  return {
    id: model.id,
    guest_name: model.guestName,
    guest_surname: model.guestSurname,
    guest_phone: model.guestPhone || "",
    guest_email: model.guestEmail || "",
    guest_nationality: model.guestNationality || "",
    booking_ref: model.bookingRef || "",
    booking_date: model.bookingDate || "",
    adults: model.adults,
    children: model.children,
    source: model.source,
    check_in: model.checkIn,
    check_out: model.checkOut,
    nights: Number(model.nights),
    total_price: Number(model.totalPrice),
    notes: model.notes || "",
    extras: model.extras || [],
    check_in_status: model.checkInStatus || {},
    status: model.status || "confirmed",
    valnea_sub_channel: model.valneaSubChannel || "",
    valnea_platform_commission_percentage: model.valneaPlatformCommissionPercentage,
    valnea_platform_commission_tax_percentage: model.valneaPlatformCommissionTaxPercentage,
    valnea_owner_percentage: model.valneaOwnerPercentage,
    valnea_agent_percentage: model.valneaAgentPercentage,
    ...(userId ? { user_id: userId } : {})
  };
}

export function mapExpenseToModel(db: DBExpense): any {
  return {
    id: db.id,
    category: db.category,
    customCategoryName: db.custom_category_name || undefined,
    amount: db.amount,
    date: db.date,
    notes: db.notes || undefined
  };
}

export function mapExpenseToDB(model: any, userId?: string | null): DBExpense {
  return {
    id: model.id,
    category: model.category,
    custom_category_name: model.customCategoryName || "",
    amount: Number(model.amount),
    date: model.date,
    notes: model.notes || "",
    ...(userId ? { user_id: userId } : {})
  };
}

export function mapSettingsToModel(db: DBSettings): any {
  return {
    valneaPlatformCommissionPercentage: db.valnea_platform_commission_percentage,
    valneaOwnerPercentage: db.valnea_owner_percentage,
    valneaAgentPercentage: db.valnea_agent_percentage,
    valneaPlatformCommissionTaxPercentage: db.valnea_platform_commission_tax_percentage,
    channels: Array.isArray(db.channels) ? db.channels : []
  };
}

export function mapSettingsToDB(model: any, userId?: string | null): DBSettings {
  return {
    id: "default", // Single settings row
    valnea_platform_commission_percentage: Number(model.valneaPlatformCommissionPercentage),
    valnea_owner_percentage: Number(model.valneaOwnerPercentage),
    valnea_agent_percentage: Number(model.valneaAgentPercentage),
    valnea_platform_commission_tax_percentage: Number(model.valneaPlatformCommissionTaxPercentage),
    channels: model.channels || [],
    ...(userId ? { user_id: userId } : {})
  };
}
