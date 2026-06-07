import React, { useState } from "react";
import { Reservation } from "../types";
import { Copy, Send, Languages, MessageSquare, Loader2, RefreshCw, CheckCircle } from "lucide-react";

interface CommunicationsTemplateProps {
  reservation: Reservation;
}

export default function CommunicationsTemplate({ reservation }: CommunicationsTemplateProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("Inglese");
  const [selectedTone, setSelectedTone] = useState<string>("Gentile/Professionale");
  const [translating, setTranslating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Template definitions
  const TEMPLATES = [
    {
      id: "welcome",
      title: "👋 Benvenuto & Istruzioni di Check-in",
      text: `Ciao [Nome] [Cognome],
Siamo felicissimi di ospitarvi presto nella nostra Villa! 🏡

Ecco alcuni dettagli importanti per il vostro arrivo il [CheckIn]:
- **Check-in disponibile dalle ore:** 15:00
- **Coordinate Google Maps della Villa:** https://maps.google.com/?q=Villa+Vacanze+Fvg
- **Contatto Telefonico:** [TelefonoOspite]

⚠️ Vi chiediamo cortesemente di inviarci in anticipo la foto dei documenti d'identità (carta d'identità o passaporto) di tutti gli ospiti per la segnalazione obbligatoria alla Polizia di Stato italiana.

A presto,
La nostra Famiglia`
    },
    {
      id: "checkout",
      title: "🔑 Istruzioni di Check-out",
      text: `Gentile [Nome],
Speriamo che il vostro soggiorno nella nostra Villa stia procedendo al meglio! ✨

Vi ricordiamo che il check-out è previsto per domani [CheckOut] entro le ore 10:00.

Istruzioni per la partenza:
1. Lasciate le chiavi sul tavolo del soggiorno o consegnatele direttamente a noi.
2. Assicuratevi che tutte le luci e il riscaldamento/aria condizionata siano spenti.
3. Chiudete bene tutte le finestre e la porta d'ingresso.

Vi auguriamo un piacevole rientro a casa! Safe travels! 🚗✈️`
    },
    {
      id: "extras",
      title: "🍷 Promozione Servizi Extra della Villa",
      text: `Ciao [Nome] [Cognome],
Sapevi che offriamo una vasta gamma di servizi extra per rendere speciale la tua vacanza in Villa? 🥂✨

Ecco le nostre proposte esclusive per voi:
- 🍷 **Degustazione Vini in Cantina:** €100 (vini locali d'eccellenza con sommelier)
- 🧺 **Cesto di Benvenuto Premium:** €50 (prodotti tipici del territorio)
- 🏊 **Riscaldamento Piscina Privata:** €150/settimana (acqua riscaldata a 28°C)

Facci sapere al più presto se desideri prenotare uno di questi servizi per trovarlo già pronto al tuo arrivo! 😊`
    },
    {
      id: "review",
      title: "⭐ Richiesta di Recensione",
      text: `Caro [Nome],
Grazie mille per aver scelto la nostra Villa per le tue vacanze in Italia! 🇮🇹

È stato un vero piacere ospitarvi. Se vi siete trovati bene, vi chiediamo il grandissimo favore di lasciare una breve recensione su Airbnb/Booking (o sul nostro profilo Google Maps). Il vostro feedback aiuta tantissimo la nostra gestione familiare! ❤️

Speriamo di potervi ospitare nuovamente in futuro!

Un caro saluto da tutta la famiglia.`
    }
  ];

  const [activeTemplateId, setActiveTemplateId] = useState<string>("welcome");
  const [messageDraft, setMessageDraft] = useState<string>(() => {
    return resolvePlaceholders(TEMPLATES[0].text);
  });

  // Helper code to map placeholders with reservation details
  function resolvePlaceholders(txt: string) {
    return txt
      .replace(/\[Nome\]/g, reservation.guestName)
      .replace(/\[Cognome\]/g, reservation.guestSurname)
      .replace(/\[CheckIn\]/g, reservation.checkIn)
      .replace(/\[CheckOut\]/g, reservation.checkOut)
      .replace(/\[TelefonoOspite\]/g, reservation.guestPhone || "[Nessun numero inserito]");
  }

  // Handle template selection
  const handleTemplateChange = (id: string) => {
    setActiveTemplateId(id);
    const selected = TEMPLATES.find((t) => t.id === id);
    if (selected) {
      setMessageDraft(resolvePlaceholders(selected.text));
    }
  };

  // Perform translation calling Gemini API
  const handleTranslate = async () => {
    setTranslating(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/communicate/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: messageDraft,
          language: selectedLanguage,
          tone: selectedTone,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessageDraft(data.text);
        if (data.warning === "GEMINI_API_KEY_MISSING") {
          setStatusMessage({
            type: 'error',
            text: "Chiave Google Gemini non configurata. Mostrato template standard o traduzione grezza. Configurala nei Segreti."
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: `Tradotto con successo in ${selectedLanguage} con tono ${selectedTone}!`
          });
        }
      } else {
        setStatusMessage({ type: 'error', text: data.message || "Errore durante la traduzione." });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: "Impossibile contattare il server per la traduzione." });
    } finally {
      setTranslating(false);
    }
  };

  // Re-generate current template (reset to origin placeholder resolve)
  const handleReset = () => {
    const selected = TEMPLATES.find((t) => t.id === activeTemplateId);
    if (selected) {
      setMessageDraft(resolvePlaceholders(selected.text));
      setStatusMessage(null);
    }
  };

  // Copy message text to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(messageDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Send communication via WhatsApp Link
  const handleSendWhatsApp = () => {
    const cleanPhone = reservation.guestPhone.replace(/\s+/g, "").replace(/-/g, "");
    const encodedText = encodeURIComponent(messageDraft);
    const targetUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(targetUrl, "_blank");
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-5">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-800 text-lg">Comunicazioni Intelligenti con l'Ospite</h3>
      </div>

      {/* Select Template tabs */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTemplateChange(t.id)}
            className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              activeTemplateId === t.id
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {t.title.split(" ")[0]} {t.title.substring(2)}
          </button>
        ))}
      </div>

      {/* Draft text Area */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <label className="font-bold text-slate-700">Modifica la bozza prima d'inviare:</label>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-semibold cursor-pointer"
            title="Ripristina valori originali"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Ripristina
          </button>
        </div>
        <textarea
          id="textarea-message-draft"
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          rows={10}
          className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans shadow-inner shrink-0"
        />
      </div>

      {/* AI Translator Panel (Gemini Integration) */}
      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 tracking-wider uppercase">
          <Languages className="w-4 h-4 text-indigo-500" /> Traduzione e Tonalità AI (Gemini 3.5)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 font-semibold">Lingua Ospite:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full border border-slate-200 bg-white p-2 rounded-lg font-medium text-slate-700 cursor-pointer"
            >
              <option value="Inglese">🇩🇪 🇬🇧 Inglese / English</option>
              <option value="Tedesco">🇩🇪 Tedesco / Deutsch</option>
              <option value="Francese">🇫🇷 Francese / Français</option>
              <option value="Spagnolo">🇪🇸 Spagnolo / Español</option>
              <option value="Croato">🇭🇷 Croato / Hrvatski</option>
              <option value="Sloveno">🇸🇮 Sloveno / Slovenščina</option>
              <option value="Italiano">🇮🇹 Italiano / Italiano</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-slate-500 font-semibold">Tono Conversazione:</span>
            <select
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value)}
              className="w-full border border-slate-200 bg-white p-2 rounded-lg font-medium text-slate-700 cursor-pointer"
            >
              <option value="Gentile/Professionale">✨ Gentile & Professionale</option>
              <option value="Caloroso/Amichevole">🌸 Caloroso & Ospitale</option>
              <option value="Formale">👔 Formale & Distaccato</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="flex-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {translating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Traduzione in corso...
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" /> Traduci Messaggio con Gemini AI
              </>
            )}
          </button>
        </div>

        {statusMessage && (
          <div className={`p-2.5 rounded-lg text-xs leading-relaxed flex items-start gap-1.5 ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'
          }`}>
            <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${statusMessage.type === 'success' ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Action buttons (Send / Share) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 border border-slate-200 text-xs font-bold py-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Testo Copiato!" : "Copia Messaggio"}
        </button>

        <button
          onClick={handleSendWhatsApp}
          disabled={!reservation.guestPhone}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
          title={reservation.guestPhone ? "Apri WhatsApp con la conversazione" : "Inserisci prima il numero nel booking per inviare"}
        >
          <Send className="w-4 h-4" />
          Invia via WhatsApp
        </button>
      </div>

      {!reservation.guestPhone && (
        <p className="text-[10px] text-amber-600 text-center">⚠️ Inserisci un contatto telefonico valido per abilitare l'invio diretto su WhatsApp.</p>
      )}
    </div>
  );
}
