import React, { useState } from "react";
import { Settings, OTAChannel } from "../types";
import { Sliders, Check, HelpCircle, AlertCircle, Plus, Trash2, Edit2, Info, ArrowRight } from "lucide-react";

interface SettingsModalProps {
  settings: Settings;
  onSave: (newSettings: Settings) => Promise<boolean>;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  // Global Valnea Defaults
  const [valneaPlatformCommissionPercentage, setValneaPlatformCommissionPercentage] = useState<number>(settings.valneaPlatformCommissionPercentage);
  const [valneaOwnerPercentage, setValneaOwnerPercentage] = useState<number>(settings.valneaOwnerPercentage);
  const [valneaPlatformCommissionTaxPercentage, setValneaPlatformCommissionTaxPercentage] = useState<number>(settings.valneaPlatformCommissionTaxPercentage);

  // Managed Channels List
  const [localChannels, setLocalChannels] = useState<OTAChannel[]>(
    settings.channels || [
      { id: "valnea", name: "Valnea", type: "gross", commissionPercentage: 15, commissionTaxPercentage: 25, ownerPercentage: 85, agentPercentage: 15 },
      { id: "novasol", name: "Novasol CLS574", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 },
      { id: "famiglia", name: "Famiglia", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 }
    ]
  );

  // Editing state for channels
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);

  // Form Fields for dynamic channel
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState<"gross" | "net">("net");
  const [cCommPct, setCCommPct] = useState(0);
  const [cTaxPct, setCTaxPct] = useState(0);
  const [cOwnerPct, setCOwnerPct] = useState(100);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate agent percentage remainder
  const calculatedAgentPct = Math.max(0, 100 - cOwnerPct);

  // Start adding/editing channel
  const handleOpenAddChannel = () => {
    setEditingChannelId(null);
    setCName("");
    setCType("net");
    setCCommPct(0);
    setCTaxPct(0);
    setCOwnerPct(100);
    setIsFormOpen(true);
    setErrorMsg(null);
  };

  const handleOpenEditChannel = (chan: OTAChannel) => {
    setEditingChannelId(chan.id);
    setCName(chan.name);
    setCType(chan.type);
    setCCommPct(chan.commissionPercentage);
    setCTaxPct(chan.commissionTaxPercentage);
    setCOwnerPct(chan.ownerPercentage);
    setIsFormOpen(true);
    setErrorMsg(null);
  };

  // Save single channel to local state list
  const handleSaveLocalChannel = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!cName.trim()) {
      setErrorMsg("Inserisci un nome valido per il canale OTA.");
      return;
    }

    if (cCommPct < 0 || cCommPct > 100) {
      setErrorMsg("La commissione deve essere compresa tra 0 e 100.");
      return;
    }

    if (cTaxPct < 0 || cTaxPct > 100) {
      setErrorMsg("L'aliquota tassa deve essere compresa tra 0 e 100.");
      return;
    }

    if (cOwnerPct < 0 || cOwnerPct > 100) {
      setErrorMsg("La quota spettante a famiglia deve essere compresa tra 0 e 100.");
      return;
    }

    const channelId = editingChannelId || cName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Prevent overwriting protection for defaults when adding or editing
    const updatedChannel: OTAChannel = {
      id: channelId,
      name: cName.trim(),
      type: cType,
      commissionPercentage: cType === "net" ? 0 : Number(cCommPct),
      commissionTaxPercentage: cType === "net" ? 0 : Number(cTaxPct),
      ownerPercentage: Number(cOwnerPct),
      agentPercentage: calculatedAgentPct
    };

    if (editingChannelId) {
      // Edit mode
      setLocalChannels(prev => prev.map(c => c.id === editingChannelId ? updatedChannel : c));
    } else {
      // Create mode
      if (localChannels.some(c => c.id === channelId)) {
        setErrorMsg("Esiste già un canale salvato con questo nome.");
        return;
      }
      setLocalChannels(prev => [...prev, updatedChannel]);
    }

    setIsFormOpen(false);
    setEditingChannelId(null);
    setCName("");
  };

  const handleDeleteLocalChannel = (id: string) => {
    const isCore = ["valnea", "novasol", "famiglia"].includes(id.toLowerCase());
    if (isCore) {
      setErrorMsg("I canali di default (Valnea, Novasol, Famiglia) non possono essere eliminati.");
      return;
    }
    setLocalChannels(prev => prev.filter(c => c.id !== id));
  };

  // Submit all settings parameters to backend
  const handleSubmitAllSettings = async () => {
    setErrorMsg(null);
    setSuccess(false);

    if (valneaPlatformCommissionPercentage < 0 || valneaPlatformCommissionPercentage > 100) {
      setErrorMsg("La percentuale della commissione di default deve essere compresa tra 0 e 100.");
      return;
    }

    if (valneaOwnerPercentage < 0 || valneaOwnerPercentage > 100) {
      setErrorMsg("La quota proprietario deve essere compresa tra 0 e 100.");
      return;
    }

    setSaving(true);

    const newSettings: Settings = {
      valneaPlatformCommissionPercentage: Number(valneaPlatformCommissionPercentage),
      valneaOwnerPercentage: Number(valneaOwnerPercentage),
      valneaAgentPercentage: Math.max(0, 100 - Number(valneaOwnerPercentage)),
      valneaPlatformCommissionTaxPercentage: Number(valneaPlatformCommissionTaxPercentage),
      channels: localChannels
    };

    const isSuccess = await onSave(newSettings);
    setSaving(false);

    if (isSuccess) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } else {
      setErrorMsg("Errore di rete durante la connessione con il server.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 space-y-6 max-h-[85vh] overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
          <Sliders className="w-4 h-4 text-indigo-600" /> Configurazione Canali & Quote (OTA)
        </h3>
        <button
          onClick={onClose}
          className="p-1 px-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 uppercase transition-all cursor-pointer"
        >
          Chiudi
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-3 rounded-xl flex items-start gap-1.5 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-1.5 leading-relaxed font-semibold">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Tutte le modifiche salvate con successo nel database! Sincronizzazione in corso...</span>
        </div>
      )}

      {/* SECTION 1: ADD / EDIT DIALOG EXPANDER */}
      {isFormOpen && (
        <form onSubmit={handleSaveLocalChannel} className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-4 animate-fade-in text-xs">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <h4 className="font-bold text-slate-800 uppercase">
              {editingChannelId ? `Modifica Canale: ${cName}` : "Sincronizza Nuovo Canale OTA"}
            </h4>
            <button 
              type="button" 
              onClick={() => setIsFormOpen(false)}
              className="text-[10px] font-extrabold text-slate-400 hover:text-slate-600 uppercase"
            >
              Annulla Form
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Channel Name */}
            <div className="space-y-1">
              <span className="font-bold text-slate-700">Nome Canale OTA</span>
              <input
                type="text"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="E.g., Airbnb Diretto, Booking Co-host"
                className="w-full border border-slate-200 p-2 rounded-lg bg-white font-semibold text-slate-800 focus:outline-hidden text-xs"
              />
            </div>

            {/* Billing Type */}
            <div className="space-y-1">
              <span className="font-bold text-slate-700">Modello di Calcolo commissionale</span>
              <select
                value={cType}
                onChange={(e) => setCType(e.target.value as "gross" | "net")}
                className="w-full border border-slate-200 p-2 rounded-lg bg-white font-semibold text-slate-800 focus:outline-hidden text-xs"
              >
                <option value="net">Netto (100% diretto, no commissioni portale)</option>
                <option value="gross">Lordo (Trattiene quota OTA + IVA Fiscale)</option>
              </select>
            </div>
          </div>

          {cType === "gross" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/20 border border-indigo-100/30 rounded-lg">
              {/* Comm platform */}
              <div className="space-y-1">
                <span className="font-bold text-slate-650 flex items-center gap-1">
                  Commissione Portale (%) <HelpCircle className="w-3.5 h-3.5 text-slate-400" title="Commissione addebitata dal portale e.g. 15%" />
                </span>
                <input
                  type="number"
                  value={cCommPct}
                  onChange={(e) => setCCommPct(Number(e.target.value))}
                  placeholder="15"
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-hidden"
                />
              </div>

              {/* platform Tax */}
              <div className="space-y-1">
                <span className="font-bold text-slate-650 flex items-center gap-1">
                  Tassa su Commissione OTA (%) <HelpCircle className="w-3.5 h-3.5 text-slate-400" title="E.g. IVA al 25% calcolata separatamente sulla fattura ota" />
                </span>
                <input
                  type="number"
                  value={cTaxPct}
                  onChange={(e) => setCTaxPct(Number(e.target.value))}
                  placeholder="25"
                  className="w-full border border-slate-200 p-2 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Quotas splits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <span className="font-bold text-slate-700">Quota Spettante alla Famiglia (%)</span>
              <input
                type="number"
                value={cOwnerPct}
                onChange={(e) => setCOwnerPct(Number(e.target.value))}
                placeholder="100"
                className="w-full border border-slate-200 p-2 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-400">Quota Gestione Co-host Spettante (%)</span>
              <div className="bg-slate-200/50 p-2.5 rounded-lg text-slate-600 font-extrabold h-9 flex items-center justify-between px-3 border border-slate-200">
                <span>{calculatedAgentPct}%</span>
                <span className="text-[9px] text-slate-400 uppercase font-black">Autocalcolato</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Salva Canale Locale
            </button>
          </div>
        </form>
      )}

      {/* SECTION 2: CHANNELS MANAGEMENT CARD GRID */}
      <div className="space-y-3">
        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div>
            <h4 className="font-bold text-xs text-slate-800">Canali OTA Associati & Quote Trattenute</h4>
            <p className="text-[10px] text-slate-500">Imposta e salva le fonti ed il piano commissionale.</p>
          </div>
          {!isFormOpen && (
            <button
              type="button"
              onClick={handleOpenAddChannel}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-2.5 rounded-lg text-[11px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Aggiungi Canale
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {localChannels.map((chan) => {
            const isDefault = ["valnea", "novasol", "famiglia"].includes(chan.id.toLowerCase());
            return (
              <div key={chan.id} className="bg-slate-50/45 border border-slate-150 p-3.5 rounded-xl flex flex-col justify-between hover:bg-slate-50 hover:border-slate-250 transition-all text-xs relative overflow-hidden group">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-1">
                    <div>
                      <h5 className="font-extrabold text-slate-900 flex items-center gap-1">
                        {chan.name}
                        {isDefault && <span className="text-[9px] font-black bg-indigo-50 border border-indigo-150 text-indigo-700 px-1 py-0.2 rounded-sm uppercase tracking-wide">Default</span>}
                      </h5>
                      <span className="text-[10px] font-semibold text-slate-450 uppercase">Quota: {chan.ownerPercentage}% Famiglia / {chan.agentPercentage}% Gestore</span>
                    </div>

                    <span className={`px-1.5 py-0.5 rounded-xs text-[9px] font-black uppercase select-none ${
                      chan.type === "gross" 
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                        : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    }`}>
                      {chan.type === "gross" ? "Lordo" : "Netto 100%"}
                    </span>
                  </div>

                  {chan.type === "gross" ? (
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] p-2 bg-indigo-50/20 border border-indigo-100/30 rounded-lg text-slate-500 font-medium">
                      <div>Commissione OTA: <strong className="text-slate-700">{chan.commissionPercentage}%</strong></div>
                      <div>Aliquota Fiscale: <strong className="text-slate-700">{chan.commissionTaxPercentage}%</strong></div>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50/20 border border-emerald-100/30 rounded-lg text-[10px] text-emerald-800 font-bold">
                      Canale Diretto. Nessuna commissione sul lordo.
                    </div>
                  )}
                </div>

                <div className="flex gap-1.5 justify-end pt-3 mt-1.5 border-t border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => handleOpenEditChannel(chan)}
                    className="p-1 px-2.5 bg-white text-slate-650 hover:text-slate-900 hover:bg-slate-150 border border-slate-200 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-indigo-600" /> Modifica
                  </button>
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLocalChannel(chan.id)}
                      className="p-1 px-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Elimina
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: SYSTEM GENERAL PARAMETERS */}
      <div className="border-t border-slate-150 pt-4 space-y-4">
        <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1">
          <Info className="w-4 h-4 text-indigo-600" /> Configurazione Co-Host Generale (Valnea)
        </h4>

        <p className="text-[11px] text-slate-500 leading-normal">
          Questi parametri impostano i valori percentuali globali d'emergenza utilizzati dal motore fiscale in caso di mancata selezione della quota singola.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Default commission */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">Commissione Default OTA (%)</span>
            <div className="relative">
              <input
                type="number"
                value={valneaPlatformCommissionPercentage}
                onChange={(e) => setValneaPlatformCommissionPercentage(Number(e.target.value))}
                className="w-full border border-slate-250 p-2 rounded-lg text-sm text-slate-700 font-semibold focus:outline-hidden"
              />
              <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
            </div>
          </div>

          {/* Owner split */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">Quota Proprietario (%)</span>
            <div className="relative">
              <input
                type="number"
                value={valneaOwnerPercentage}
                onChange={(e) => setValneaOwnerPercentage(Number(e.target.value))}
                className="w-full border border-slate-250 p-2 rounded-lg text-sm text-slate-700 font-semibold focus:outline-hidden"
              />
              <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
            </div>
          </div>

          {/* Commission tax */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">IVA su Commissione OTA (%)</span>
            <div className="relative">
              <input
                type="number"
                value={valneaPlatformCommissionTaxPercentage}
                onChange={(e) => setValneaPlatformCommissionTaxPercentage(Number(e.target.value))}
                className="w-full border border-slate-250 p-2 rounded-lg text-sm text-slate-700 font-semibold focus:outline-hidden"
              />
              <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-150 pt-4">
        <button
          type="button"
          onClick={handleSubmitAllSettings}
          disabled={saving}
          className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl text-xs tracking-widest shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 uppercase flex justify-center items-center gap-1.5"
        >
          {saving ? "Salvataggio e trasmissione d'urgenza..." : "Salva e Applica Cambiamenti Globali"}
        </button>
      </div>
    </div>
  );
}
