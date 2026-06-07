export interface ExtraService {
  id: string;
  name: string;
  price: number;
}

export interface CheckInStatus {
  documentsUploaded: boolean;     // Caricamento documenti d'identità
  touristTaxPaid: boolean;        // Tassa di soggiorno saldata
  alloggiatiReported: boolean;    // Notifica su portale Alloggiati Web (Polizia)
  keysDelivered: boolean;         // Consegna delle chiavi effettuata
  depositPaid: boolean;           // Pagato caparra
}

export interface Reservation {
  id: string;
  guestName: string;
  guestSurname: string;
  guestPhone: string;
  guestEmail?: string;
  guestNationality?: string; // Nazionalità del cliente
  bookingRef?: string;       // Rif. prenotazione (Numero prenotazione)
  adults?: number;           // Numero adulti
  children?: number;         // Numero bambini
  source: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  totalPrice: number; // For Valnea, this is Gross (Lordo). For others, it's net (puliti).
  notes?: string;
  extras: ExtraService[];
  checkInStatus: CheckInStatus;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  bookingDate?: string;             // Data prenotazione (YYYY-MM-DD)
  // Valnea specific overrides (defaults to settings load)
  valneaSubChannel?: string;
  valneaPlatformCommissionPercentage?: number;
  valneaPlatformCommissionTaxPercentage?: number;
  valneaOwnerPercentage?: number;
  valneaAgentPercentage?: number;
}

export interface OTAChannel {
  id: string;
  name: string;
  type: 'gross' | 'net'; // 'gross' (deducts commission/taxes, like Valnea), 'net' (uncommissioned source, like Novasol/direct)
  commissionPercentage: number;
  commissionTaxPercentage: number;
  ownerPercentage: number;
  agentPercentage: number;
}

export interface Settings {
  valneaPlatformCommissionPercentage: number;
  valneaOwnerPercentage: number;
  valneaAgentPercentage: number;
  valneaPlatformCommissionTaxPercentage: number;
  channels?: OTAChannel[];
}

export interface Expense {
  id: string;
  category: 'elettricita' | 'acqua' | 'piscina' | 'sauna' | 'stoviglieria' | 'lenzuola' | 'asciugamani' | 'carta_igienica' | 'drogheria' | 'extra';
  customCategoryName?: string; // used when category is 'extra'
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
}

