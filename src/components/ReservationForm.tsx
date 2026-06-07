import React, { useState, useEffect } from "react";
import { Reservation, ExtraService, CheckInStatus, Settings } from "../types";
import { X, Calendar, User, DollarSign, Plus, Trash2, ShieldCheck, AlertCircle } from "lucide-react";

interface ReservationFormProps {
  reservation?: Reservation; // If provided, we are editing
  initialCheckIn?: string;
  initialCheckOut?: string;
  settings: Settings;
  onSave: (resData: any) => Promise<boolean>; // Returns true on success
  onCancel: () => void;
}

const PREDEFINED_EXTRAS = [
  { name: "Riscaldamento Piscina", price: 150 },
  { name: "Degustazione Vini", price: 100 },
  { name: "Cesto di Benvenuto Premium", price: 50 },
  { name: "Pulizie Extra Mezzo Soggiorno", price: 80 }
];

export default function ReservationForm({
  reservation,
  initialCheckIn,
  initialCheckOut,
  settings,
  onSave,
  onCancel,
}: ReservationFormProps) {
  const [guestName, setGuestName] = useState("");
  const [guestSurname, setGuestSurname] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [adults, setAdults] = useState<number | "">("");
  const [children, setChildren] = useState<number | "">("");
  const [source, setSource] = useState<string>("Famiglia");
  
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [notes, setNotes] = useState("");
  
  // Extra Services
  const [extras, setExtras] = useState<ExtraService[]>([]);
  const [customExtraName, setCustomExtraName] = useState("");
  const [customExtraPrice, setCustomExtraPrice] = useState("");

  // Check-In Status Checklist
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>({
    documentsUploaded: false,
    touristTaxPaid: false,
    alloggiatiReported: false,
    keysDelivered: false,
    depositPaid: false
  });

  const [status, setStatus] = useState<'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'>("confirmed");
  
  // Local state for Valnea commission overrides
  const [valneaPlatformCommissionPercentage, setValneaPlatformCommissionPercentage] = useState<number>(settings.valneaPlatformCommissionPercentage);
  const [valneaPlatformCommissionTaxPercentage, setValneaPlatformCommissionTaxPercentage] = useState<number>(settings.valneaPlatformCommissionTaxPercentage);
  const [valneaOwnerPercentage, setValneaOwnerPercentage] = useState<number>(settings.valneaOwnerPercentage);
  const [valneaAgentPercentage, setValneaAgentPercentage] = useState<number>(settings.valneaAgentPercentage);
  const [valneaSubChannel, setValneaSubChannel] = useState<string>("");
  const [guestNationality, setGuestNationality] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Populate data if editing
  useEffect(() => {
    if (reservation) {
      setGuestName(reservation.guestName);
      setGuestSurname(reservation.guestSurname);
      setGuestPhone(reservation.guestPhone);
      setGuestEmail(reservation.guestEmail || "");
      setGuestNationality(reservation.guestNationality || "");
      setBookingRef(reservation.bookingRef || "");
      setBookingDate(reservation.bookingDate || "");
      setAdults(reservation.adults !== undefined ? reservation.adults : "");
      setChildren(reservation.children !== undefined ? reservation.children : "");
      setSource(reservation.source);
      setCheckIn(reservation.checkIn);
      setCheckOut(reservation.checkOut);
      setNights(reservation.nights);
      setTotalPrice(reservation.totalPrice);
      setNotes(reservation.notes || "");
      setExtras(reservation.extras || []);
      setCheckInStatus({
        documentsUploaded: reservation.checkInStatus?.documentsUploaded || false,
        touristTaxPaid: reservation.checkInStatus?.touristTaxPaid || false,
        alloggiatiReported: reservation.checkInStatus?.alloggiatiReported || false,
        keysDelivered: reservation.checkInStatus?.keysDelivered || false,
        depositPaid: reservation.checkInStatus?.depositPaid || false
      });
      setStatus(reservation.status);

      if (reservation.valneaOwnerPercentage !== undefined) {
        setValneaPlatformCommissionPercentage(reservation.valneaPlatformCommissionPercentage ?? 0);
        setValneaPlatformCommissionTaxPercentage(reservation.valneaPlatformCommissionTaxPercentage ?? 0);
        setValneaOwnerPercentage(reservation.valneaOwnerPercentage ?? 100);
        setValneaAgentPercentage(reservation.valneaAgentPercentage ?? 0);
        setValneaSubChannel(reservation.valneaSubChannel || "");
      } else {
        const match = (settings.channels || []).find(c => c.name.toLowerCase() === reservation.source.toLowerCase());
        if (match) {
          setValneaPlatformCommissionPercentage(match.commissionPercentage);
          setValneaPlatformCommissionTaxPercentage(match.commissionTaxPercentage);
          setValneaOwnerPercentage(match.ownerPercentage);
          setValneaAgentPercentage(match.agentPercentage);
        }
        setValneaSubChannel("");
      }
    } else {
      if (initialCheckIn) setCheckIn(initialCheckIn);
      if (initialCheckOut) setCheckOut(initialCheckOut);
    }
  }, [reservation, initialCheckIn, initialCheckOut, settings]);

  // Recalculate nights when checkIn or checkOut changes
  useEffect(() => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const calculatedNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setNights(calculatedNights > 0 ? calculatedNights : 0);
    } else {
      setNights(0);
    }
  }, [checkIn, checkOut]);

  // Find current channel metadata
  const getSelectedChannelInfo = () => {
    const channels = settings.channels || [
      { id: "valnea", name: "Valnea", type: "gross", commissionPercentage: 15, commissionTaxPercentage: 25, ownerPercentage: 85, agentPercentage: 15 },
      { id: "novasol", name: "Novasol CLS574", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 },
      { id: "famiglia", name: "Famiglia", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 }
    ];
    return channels.find(c => {
      const srcLower = (source || "").toLowerCase();
      const chanNameLower = c.name.toLowerCase();
      const chanIdLower = c.id.toLowerCase();
      return chanNameLower === srcLower || 
             chanIdLower === srcLower || 
             (srcLower.length > 2 && chanNameLower.startsWith(srcLower)) || 
             (chanNameLower.length > 2 && srcLower.startsWith(chanNameLower)) ||
             (chanIdLower.length > 2 && srcLower.startsWith(chanIdLower));
    }) || channels[2];
  };

  const currentChannel = getSelectedChannelInfo();
  const isGrossType = currentChannel ? currentChannel.type === "gross" : false;

  // Sync state whenever the selected source dropdown changes
  useEffect(() => {
    if (!reservation || reservation.source !== source) {
      const activeChannel = getSelectedChannelInfo();
      if (activeChannel) {
        setValneaPlatformCommissionPercentage(activeChannel.commissionPercentage);
        setValneaPlatformCommissionTaxPercentage(activeChannel.commissionTaxPercentage);
        setValneaOwnerPercentage(activeChannel.ownerPercentage);
        setValneaAgentPercentage(activeChannel.agentPercentage);
      }
    }
  }, [source]);

  // Helper calculation details for real-time visual card representation
  const getValneaCalculations = () => {
    const gross = Number(totalPrice) || 0;
    const otaComm = gross * (valneaPlatformCommissionPercentage / 100);
    const rem = gross - otaComm;
    const agentValneaShare = rem * (valneaAgentPercentage / 100);
    const rawFamilyShare = rem * (valneaOwnerPercentage / 100);
    const taxValueOnComm = otaComm * (valneaPlatformCommissionTaxPercentage / 100);
    const familyNetReal = rawFamilyShare - taxValueOnComm;

    return {
      otaComm,
      rem,
      agentValneaShare,
      rawFamilyShare,
      taxValueOnComm,
      familyNetReal
    };
  };

  const valneaCalc = getValneaCalculations();

  // Add predefined extra Helper
  const handleAddPredefinedExtra = (item: { name: string, price: number }) => {
    const newExtra: ExtraService = {
      id: `ext-${Date.now()}`,
      name: item.name,
      price: item.price
    };
    setExtras([...extras, newExtra]);
  };

  // Add custom extra
  const handleAddCustomExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExtraName || !customExtraPrice) return;
    const newExtra: ExtraService = {
      id: `ext-${Date.now()}`,
      name: customExtraName,
      price: Number(customExtraPrice)
    };
    setExtras([...extras, newExtra]);
    setCustomExtraName("");
    setCustomExtraPrice("");
  };

  // Delete extra
  const handleDeleteExtra = (id: string) => {
    setExtras(extras.filter((ext) => ext.id !== id));
  };

  // Toggle checklist items
  const handleChecklistToggle = (field: keyof CheckInStatus) => {
    setCheckInStatus({
      ...checkInStatus,
      [field]: !checkInStatus[field]
    });
  };

  const handleValneaSubChannelChange = (subChanName: string) => {
    setValneaSubChannel(subChanName);
    if (!subChanName) return;
    
    // Check custom settings channels list first
    const channels = settings.channels || [];
    const matched = channels.find(c => c.name.toLowerCase() === subChanName.toLowerCase() || c.id.toLowerCase() === subChanName.toLowerCase());
    
    if (matched) {
      setValneaPlatformCommissionPercentage(matched.commissionPercentage);
      setValneaPlatformCommissionTaxPercentage(matched.commissionTaxPercentage);
      setValneaOwnerPercentage(matched.ownerPercentage);
      setValneaAgentPercentage(matched.agentPercentage);
    } else {
      // standard fallbacks defaults
      if (subChanName === "Booking.com") {
        setValneaPlatformCommissionPercentage(18);
        setValneaPlatformCommissionTaxPercentage(25);
        setValneaOwnerPercentage(85);
        setValneaAgentPercentage(15);
      } else if (subChanName === "Airbnb") {
        setValneaPlatformCommissionPercentage(15);
        setValneaPlatformCommissionTaxPercentage(25);
        setValneaOwnerPercentage(85);
        setValneaAgentPercentage(15);
      } else if (subChanName === "Vrbo") {
        setValneaPlatformCommissionPercentage(12);
        setValneaPlatformCommissionTaxPercentage(25);
        setValneaOwnerPercentage(85);
        setValneaAgentPercentage(15);
      } else if (subChanName === "Expedia") {
        setValneaPlatformCommissionPercentage(15);
        setValneaPlatformCommissionTaxPercentage(25);
        setValneaOwnerPercentage(85);
        setValneaAgentPercentage(15);
      }
    }
  };

  // Handle Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!guestName || !guestSurname) {
      setErrorMessage("Inserisci Nome e Cognome dell'ospite.");
      return;
    }
    if (!checkIn || !checkOut) {
      setErrorMessage("Inserisci data di Check-in e Check-out.");
      return;
    }
    if (nights <= 0) {
      setErrorMessage("La data di check-out deve essere successiva al check-in.");
      return;
    }
    if (totalPrice < 0) {
      setErrorMessage("Il prezzo inserito non può essere negativo.");
      return;
    }

    setSubmitting(true);

    const payload: any = {
      guestName,
      guestSurname,
      guestPhone,
      guestEmail,
      guestNationality,
      bookingRef: bookingRef || "",
      bookingDate: bookingDate || undefined,
      adults: adults !== "" ? Number(adults) : undefined,
      children: children !== "" ? Number(children) : undefined,
      source,
      checkIn,
      checkOut,
      totalPrice: Number(totalPrice),
      notes,
      extras,
      checkInStatus,
      status,
    };

    if (source === "Valnea") {
      payload.valneaSubChannel = valneaSubChannel;
    }

    if (valneaOwnerPercentage !== undefined) {
      payload.valneaPlatformCommissionPercentage = valneaPlatformCommissionPercentage;
      payload.valneaPlatformCommissionTaxPercentage = valneaPlatformCommissionTaxPercentage;
      payload.valneaOwnerPercentage = valneaOwnerPercentage;
      payload.valneaAgentPercentage = valneaAgentPercentage;
    }

    const success = await onSave(payload);
    setSubmitting(false);
  };

  // Render coloring borders dynamically for dropdown focus
  const getSourceBorderColor = () => {
    if (source === "Valnea") return "border-l-4 border-l-indigo-500";
    if (source && source.startsWith("Novasol")) return "border-l-4 border-l-emerald-500";
    return "border-l-4 border-l-amber-500";
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 max-h-[90vh] overflow-y-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {reservation ? "✏️ Modifica Prenotazione" : "📅 Nuova Prenotazione"}
          </h2>
          <p className="text-xs text-slate-500">
            Compila accuratamente le date e la fonte per regolare le quote della famiglia.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1 px-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 uppercase transition-all"
        >
          Annulla
        </button>
      </div>

      {errorMessage && (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs p-3.5 rounded-xl flex items-start gap-2 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 select-none">
        
        {/* Core Info: Source Selection with coloring dropdown! */}
        <div className={`p-4 bg-slate-50 rounded-xl space-y-4 ${getSourceBorderColor()} transition-all shadow-inner`}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Seleziona Canale / Chi Gestisce:</label>
              <select
                id="form-source-select"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                }}
                className="w-full text-sm font-semibold text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                {(settings.channels || [
                  { id: "famiglia", name: "Famiglia", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 },
                  { id: "novasol", name: "Novasol CLS574", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 },
                  { id: "valnea", name: "Valnea", type: "gross", commissionPercentage: 15, commissionTaxPercentage: 25, ownerPercentage: 85, agentPercentage: 15 }
                ]).map((ch) => {
                  let emoji = "🔵";
                  if (ch.id.toLowerCase() === "famiglia") emoji = "🟡";
                  else if (ch.id.toLowerCase() === "novasol") emoji = "🟢";
                  else if (ch.type === "net") emoji = "🟣";
                  
                  return (
                    <option key={ch.id} value={ch.name}>
                      {emoji} {ch.name} ({ch.type === "gross" ? "Lordo" : "Netto"})
                    </option>
                  );
                })}
              </select>
            </div>

            {source.toLowerCase() === "valnea" && (
              <div className="flex-1 space-y-1 animate-fade-in">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sito di Origine (OTA da Valnea):</label>
                <select
                  id="form-valnea-subchannel"
                  value={valneaSubChannel}
                  onChange={(e) => handleValneaSubChannelChange(e.target.value)}
                  className="w-full text-sm font-semibold text-slate-700 bg-white border border-indigo-250 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 cursor-pointer font-extrabold text-indigo-900"
                >
                  <option value="">Seleziona il sito OTA...</option>
                  {(settings.channels || []).filter(c => !["famiglia", "novasol", "valnea"].includes(c.id.toLowerCase())).map((ch) => (
                    <option key={ch.id} value={ch.name}>
                      ✈️ {ch.name} (Quota F.: {ch.ownerPercentage}%, Comm: {ch.commissionPercentage}%)
                    </option>
                  ))}
                  {/* Standard predefined fallback choices if not loaded already */}
                  {!(settings.channels || []).some(c => c.name.toLowerCase() === "booking.com") && <option value="Booking.com">✈️ Booking.com (F: 85%, Comm: 18%)</option>}
                  {!(settings.channels || []).some(c => c.name.toLowerCase() === "airbnb") && <option value="Airbnb">✈️ Airbnb (F: 85%, Comm: 15%)</option>}
                  {!(settings.channels || []).some(c => c.name.toLowerCase() === "vrbo") && <option value="Vrbo">✈️ Vrbo (F: 85%, Comm: 12%)</option>}
                  {!(settings.channels || []).some(c => c.name.toLowerCase() === "expedia") && <option value="Expedia">✈️ Expedia (F: 85%, Comm: 15%)</option>}
                </select>
              </div>
            )}

            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Stato della Prenotazione:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-sm font-semibold text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="confirmed">Confermata (In attesa)</option>
                <option value="checked_in">In Casa (Checked-in)</option>
                <option value="checked_out">Partiti (Checked-out)</option>
                <option value="cancelled">Cancellata</option>
              </select>
            </div>
          </div>
        </div>

        {/* Guest Details */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Anagrafica Ospite
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-600">Nome dell'ospite:</span>
              <input
                id="input-guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Es. John"
                className="w-full border border-slate-200 p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0"
              />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-600">Cognome dell'ospite:</span>
              <input
                id="input-guest-surname"
                type="text"
                value={guestSurname}
                onChange={(e) => setGuestSurname(e.target.value)}
                placeholder="Es. Smith"
                className="w-full border border-slate-200 p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-600">Telefono (con prefisso internazionale):</span>
              <input
                id="input-guest-phone"
                type="text"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Es. +393471234567 o +498912344"
                className="w-full border border-slate-200 p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0"
              />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-600">Email di contatto (Opzionale):</span>
              <input
                id="input-guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="john.smith@example.com"
                className="w-full border border-slate-200 p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0"
              />
            </div>
            
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-50/50 p-3 rounded-xl border border-slate-100/85">
            <div className="space-y-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1 select-none">🆔 Rif. Prenotazione:</span>
              <input
                id="input-booking-ref"
                type="text"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="Es. Booking-123456"
                className="w-full border border-slate-200 bg-white p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0 font-semibold text-slate-800 shadow-3xs"
              />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1 select-none">📅 Data Prenotazione:</span>
              <input
                id="input-booking-date"
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-slate-200 bg-white p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0 font-medium text-slate-800 shadow-3xs cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1 select-none">🧑 Adulti:</span>
              <input
                id="input-adults"
                type="number"
                min="0"
                value={adults}
                onChange={(e) => setAdults(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Numero adulti"
                className="w-full border border-slate-200 bg-white p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0 font-medium text-slate-800 shadow-3xs"
              />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-600 flex items-center gap-1 select-none">👶 Bambini:</span>
              <input
                id="input-children"
                type="number"
                min="0"
                value={children}
                onChange={(e) => setChildren(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Numero bambini"
                className="w-full border border-slate-200 bg-white p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0 font-medium text-slate-800 shadow-3xs"
              />
            </div>
          </div>

            {/* Guest Nationality input for market studies */}
            <div className="col-span-1 sm:col-span-2 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                🗺️ Nazionalità del Cliente (per studio di mercato):
              </span>
              <input
                id="input-guest-nationality"
                type="text"
                value={guestNationality}
                onChange={(e) => setGuestNationality(e.target.value)}
                placeholder="Inserisci o seleziona la nazionalità (es. Tedesca, Italiana, Austriaca...)"
                list="nationalities-list"
                className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0 font-medium text-slate-800"
              />
              <datalist id="nationalities-list">
                <option value="Italiana" />
                <option value="Tedesca" />
                <option value="Austriaca" />
                <option value="Olandese" />
                <option value="Polacca" />
                <option value="Croata" />
                <option value="Svizzera" />
                <option value="Francese" />
                <option value="Belga" />
                <option value="Britannica" />
                <option value="Slovena" />
                <option value="Svedese" />
                <option value="Danese" />
                <option value="Norvegese" />
                <option value="Ungherese" />
                <option value="Ceca" />
                <option value="Americana" />
              </datalist>
            </div>
          </div>
        </div>

        {/* Date Selections */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Date del Soggiorno
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-600">Data Check-in (Arrivo):</span>
              <input
                id="input-check-in"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full border border-slate-200 p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-slate-600">Data Check-out (Partenza):</span>
              <input
                id="input-check-out"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full border border-slate-200 p-2 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              />
            </div>
            <div className="bg-slate-50 border border-slate-150 p-2 rounded-lg flex flex-col justify-center items-center">
              <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">Notti Totali</span>
              <span className="text-xl font-black text-indigo-700 mt-1">{nights} notti</span>
            </div>
          </div>
        </div>

        {/* Financial Section */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Dettagli Economici Soggiorno
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-slate-600">
                {isGrossType ? "💵 PREZZO LORDO della prenotazione (da Portale commissionato):" : "💵 PREZZO NETTO (da Famiglia o Novasol):"}
              </span>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">€</span>
                <input
                  id="input-total-price"
                  type="number"
                  value={totalPrice || ""}
                  onChange={(e) => setTotalPrice(Number(e.target.value))}
                  placeholder="Es. 1000"
                  className="w-full border border-slate-200 p-2 pl-7 rounded-lg text-sm font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden shrink-0"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {isGrossType
                  ? `Inserisci il prezzo lordo totale pagato dall'ospite sul portale. Il sistema calcolerà le quote ${valneaOwnerPercentage}% / ${valneaAgentPercentage}% e le debite tasse.`
                  : "Le prenotazioni dirette Famiglia o Novasol sono pulite ed esenti da costi intermediari fiscali."}
              </p>
            </div>

            {/* Live Calculation card preview for bookings */}
            {isGrossType && (
              <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl text-xs space-y-1.5 shadow-3xs">
                <span className="font-bold text-indigo-900 block border-b border-indigo-100 pb-1">📊 Calcolo Quote in Tempo Reale ({source}):</span>
                <div className="flex justify-between">
                  <span>Imponibile Lordo:</span>
                  <span className="font-mono font-medium">€{Number(totalPrice || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-650 font-medium">
                  <span>Trattenuta OTA/Portale ({valneaPlatformCommissionPercentage}%):</span>
                  <span className="font-mono">-€{valneaCalc.otaComm.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rimanenza Dividendi ({valneaOwnerPercentage + valneaAgentPercentage}%):</span>
                  <span className="font-mono font-medium">€{valneaCalc.rem.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-750 font-medium">
                  <span>Quota Gestione / Co-host ({valneaAgentPercentage}%):</span>
                  <span className="font-mono">€{valneaCalc.agentValneaShare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-indigo-850 font-bold">
                  <span>Quota Proprietario / Famiglia ({valneaOwnerPercentage}%):</span>
                  <span className="font-mono">€{valneaCalc.rawFamilyShare.toFixed(2)}</span>
                </div>
                {valneaPlatformCommissionTaxPercentage > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>Tassa su Provvigione ({valneaPlatformCommissionTaxPercentage}%):</span>
                    <span className="font-mono">-€{valneaCalc.taxValueOnComm.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-800 font-extrabold border-t border-indigo-150 pt-1 mt-1">
                  <span>Nostro Ricavo Pulito:</span>
                  <span>€{valneaCalc.familyNetReal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* EXTRA SERVICES SELECTOR */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>🍷 Servizi Extra Richiesti</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Netto a Noi: +€{extras.reduce((sum, ext) => sum + ext.price, 0)}
            </span>
          </h3>

          {/* Preset buttons */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-650 block">Aggiungi un servizio predefinito:</span>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_EXTRAS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddPredefinedExtra(p)}
                  className="text-[10px] font-semibold bg-slate-50 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer text-slate-700 select-none"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600" /> {p.name} (+€{p.price})
                </button>
              ))}
            </div>
          </div>

          {/* Selected Extras List */}
          {extras.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-36 overflow-y-auto">
              {extras.map((ext) => (
                <div key={ext.id} className="flex justify-between items-center bg-slate-50/50 p-2.5 text-xs text-slate-805">
                  <span className="font-medium text-slate-700">{ext.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">€{ext.price}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExtra(ext.id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                      title="Rimuovi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add custom extra form */}
          <div className="flex gap-2 text-xs">
            <input
              type="text"
              placeholder="Nome extra personalizzato..."
              value={customExtraName}
              onChange={(e) => setCustomExtraName(e.target.value)}
              className="flex-1 border border-slate-200 p-2 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Prezzo (€)..."
              value={customExtraPrice}
              onChange={(e) => setCustomExtraPrice(e.target.value)}
              className="w-24 border border-slate-200 p-2 rounded-lg text-xs"
            />
            <button
              type="button"
              onClick={handleAddCustomExtra}
              className="bg-slate-250 hover:bg-slate-350 border border-slate-200 p-2 px-3 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              Aggiungi
            </button>
          </div>
        </div>

        {/* Check-in Checklist */}
        <div className="space-y-4 pt-2 border-t border-slate-100 bg-slate-50/40 p-3.5 rounded-xl border border-slate-100">
          <h3 className="text-xs font-bold text-slate-650 uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Checklist Stato Check-in
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs select-none">
            {/* Documents */}
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-150 shadow-2xs hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={checkInStatus.documentsUploaded}
                onChange={() => handleChecklistToggle('documentsUploaded')}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-medium text-slate-750">Foto Documenti Ricevuta</span>
            </label>

            {/* Tourist Tax */}
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-150 shadow-2xs hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={checkInStatus.touristTaxPaid}
                onChange={() => handleChecklistToggle('touristTaxPaid')}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-medium text-slate-755">Tassa di Soggiorno Saldata</span>
            </label>

            {/* Alloggiati Reported */}
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-150 shadow-2xs hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={checkInStatus.alloggiatiReported}
                onChange={() => handleChecklistToggle('alloggiatiReported')}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-medium text-slate-750">Polizia - Portale Alloggiati</span>
            </label>

            {/* Keys Handover */}
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-150 shadow-2xs hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={checkInStatus.keysDelivered}
                onChange={() => handleChecklistToggle('keysDelivered')}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-medium text-slate-750">Chiavi della Villa Consegnate</span>
            </label>

            {/* Deposit Paid */}
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-150 shadow-2xs hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={checkInStatus.depositPaid || false}
                onChange={() => handleChecklistToggle('depositPaid')}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-medium text-slate-750">Pagato Caparra</span>
            </label>
          </div>
        </div>

        {/* Notes (Opzionali) */}
        <div className="space-y-1.5 text-xs">
          <span className="font-semibold text-slate-600">Note & Dettagli aggiuntivi:</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2.5}
            placeholder="Scrivi qui eventuali richieste speciali, orario d'arrivo o note aggiuntive..."
            className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden resize-none shadow-sm shrink-0"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            Annulla
          </button>
          
          <button
            id="btn-save-reservation"
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Salvataggio..." : (reservation ? "Aggiorna Prenotazione" : "Salva Prenotazione")}
          </button>
        </div>

      </form>
    </div>
  );
}
