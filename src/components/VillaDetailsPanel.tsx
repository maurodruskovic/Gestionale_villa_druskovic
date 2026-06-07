import React, { useState, useEffect } from "react";
import { 
  MapPin, 
  Map, 
  Star, 
  Sparkles, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Info,
  CalendarDays,
  Languages,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Sliders,
  Check,
  AlertCircle
} from "lucide-react";

interface VillaPhoto {
  url: string;
  caption: string;
}

const DEFAULT_PHOTOS: VillaPhoto[] = [
  {
    url: "https://cf.bstatic.com/xdata/images/hotel/max1024x768/515546950.jpg?k=77d9176144d41fb79af66109282e00e0d6b09e52defeaf19f27bd948bc1a5f56&o=&hp=1",
    caption: "Spettacolare facciata rustica in pietra originale istriana con la bellissima piscina circondata da prato verde"
  },
  {
    url: "https://cf.bstatic.com/xdata/images/hotel/max1024x768/515543000.jpg?k=f8a1fb6a457fac35948f219fdfb4169720b09489a263a4ebe0ce4d7bf2ba9e5d&o=",
    caption: "La piscina privata illuminata la sera con ampio solarium attrezzato con sdraio ed ombrelloni"
  },
  {
    url: "https://cf.bstatic.com/xdata/images/hotel/max1024x768/515543110.jpg?k=55bc81fcead1719b5bfb18600109ae98eff1e61ea48fa24da01379bd4fa0c20a&o=",
    caption: "Accogliente veranda coperta con cucina estiva attrezzata, barbecue in muratura e tavolo per cene all'aperto"
  },
  {
    url: "https://cf.bstatic.com/xdata/images/hotel/max1024x768/515543500.jpg?k=efb3bead0b171de04a2ab497bfdb2a9eef9ef4a8ea0abfba34da0135bdffbc30a&o=",
    caption: "La splendida vasca idromassaggio Jacuzzi riscaldata posizionata nel giardino per il vostro totale relax"
  },
  {
    url: "https://cf.bstatic.com/xdata/images/hotel/max1024x768/515543220.jpg?k=6a3b2bdead171fe04a2cb497bfdb2a9eef9ef45ea1abfca14da01379bdfabc50d&o=",
    caption: "Area svago esterna equipaggiata con tavolo da Calcio Balilla regolamentare professionale"
  }
];

export default function VillaDetailsPanel() {
  const mapUrl = "https://www.google.com/maps/search/?api=1&query=Villa+Druskovic,+Triban+8,+52460,+Buje,+Croazia";

  // Persistent custom photos list
  const [photos, setPhotos] = useState<VillaPhoto[]>(() => {
    const saved = localStorage.getItem("villa_druskovic_photos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_PHOTOS;
  });

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [translatedReviewIds, setTranslatedReviewIds] = useState<Record<string, boolean>>({});
  
  // Photo management panel toggle & states
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem("villa_druskovic_photos", JSON.stringify(photos));
    // Reset active index if it overflows out of range
    if (activePhotoIndex >= photos.length) {
      setActivePhotoIndex(Math.max(0, photos.length - 1));
    }
  }, [photos]);

  const prevPhoto = () => {
    if (photos.length === 0) return;
    setActivePhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const nextPhoto = () => {
    if (photos.length === 0) return;
    setActivePhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const toggleTranslation = (id: string) => {
    setTranslatedReviewIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Convert uploaded image to Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match("image.*")) {
      setUploadError("Per favore seleziona un file immagine valido (JPEG, PNG, GIF).");
      return;
    }

    // Limit large images from overflowing localStorage (limit to 2.5MB)
    if (file.size > 2.5 * 1024 * 1024) {
      setUploadError("L'immagine è troppo grande. Scegli un file inferiore a 2.5 MB per non congestionare la memoria offline.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewPhotoUrl(event.target.result as string);
        setSuccessMsg("Immagine caricata correttamente dal computer! Inserisci una didascalia e clicca 'Aggiungi'.");
      }
    };
    reader.onerror = () => {
      setUploadError("Errore durante la lettura del file.");
    };
    reader.readAsDataURL(file);
  };

  // Add loaded photo
  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setSuccessMsg(null);

    if (!newPhotoUrl.trim()) {
      setUploadError("Fornisci un indirizzo URL valido o carica una foto dal tuo computer.");
      return;
    }

    const caption = newPhotoCaption.trim() || `Foto della casa #${photos.length + 1}`;
    const newPhoto: VillaPhoto = {
      url: newPhotoUrl,
      caption
    };

    setPhotos((prev) => [...prev, newPhoto]);
    setNewPhotoUrl("");
    setNewPhotoCaption("");
    setSuccessMsg("Nuova foto aggiunta alla galleria di Villa Druskovic!");
    setActivePhotoIndex(photos.length); // switch slider to newly added photo
  };

  // Delete individual photo
  const handleDeletePhoto = (indexToDelete: number) => {
    if (photos.length <= 1) {
      setUploadError("Devi mantenere almeno una foto caricata nel carosello.");
      return;
    }
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToDelete));
    setSuccessMsg("Foto rimossa con successo.");
  };

  // Revert all to default seeds
  const handleRestoreDefaults = () => {
    if (window.confirm("Sei sicuro di voler rimpiazzare tutte le foto correnti ripristinando quelle originali del sistema?")) {
      setPhotos(DEFAULT_PHOTOS);
      setActivePhotoIndex(0);
      setSuccessMsg("Ripristinate le foto originali della villa.");
      setNewPhotoUrl("");
      setNewPhotoCaption("");
    }
  };

  const reviews = [
    {
      id: "rev-1",
      author: "Michael S.",
      country: "Germania 🇩🇪",
      source: "Google Maps",
      rating: 5,
      date: "Giugno 2025",
      text: "The stone villa is absolutely stunning! The private pool and sauna are fantastic, and Valnea made sure everything was clean and organized upon our arrival. The village of Triban is peaceful and incredibly quiet, yet just minutes away from Buje for grocery shopping. Super efficient check-in process. We will definitely book again!",
      translation: "La villa in pietra è assolutamente splendida! La piscina privata e la sauna sono fantastiche e Valnea si è assicurata che tutto fosse pulito e organizzato al nostro arrivo. Il villaggio di Triban è tranquillo e incredibilmente silenzioso, eppure a pochi minuti da Buie per fare la spesa. Processo di check-in super efficiente. Prenoteremo sicuramente di nuovo!"
    },
    {
      id: "rev-2",
      author: "Andrea M.",
      country: "Italia 🇮🇹",
      source: "Booking.com",
      rating: 5,
      date: "Luglio 2025",
      text: "Villa Druskovic è un vero gioiello istriano. La nostra famiglia con due bambini ha adorato lo spazio esterno e la splendida terrazza d'ingresso coperta. I letti erano completi di lenzuola profumate e asciugamani morbidissimi forniti dall'agenzia. Ottima comunicazione con i proprietari!"
    },
    {
      id: "rev-3",
      author: "Elena B. & Thomas",
      country: "Austria 🇦🇹",
      source: "Airbnb",
      rating: 5,
      date: "Agosto 2025",
      text: "Wonderful vacation in Triban! Perfect combination of traditional stone appeal and modern luxury. The sauna was very helpful on cooler evenings. Easy to find using Google Maps. We appreciated the welcome products and the fast Wi-Fi connection. A 10/10 stay.",
      translation: "Splendida vacanza a Triban! Perfetta combinazione di fascino della pietra tradizionale e lusso moderno. La sauna è stata utilissima nelle serate più fresche. Facile da trovare usando Google Maps. Abbiamo apprezzato i prodotti di benvenuto e la connessione Wi-Fi veloce. Un soggiorno da 10/10."
    },
    {
      id: "rev-4",
      author: "Guillaume P.",
      country: "Francia 🇫🇷",
      source: "Novasol (Awaze)",
      rating: 5,
      date: "Settembre 2025",
      text: "Très belle maison, très propre, bien équipée. La piscine est superbe, l'emplacement idéal pour visiter l'Istrie. Novasol a parfaitement géré les aspects administratifs et l'accueil en collaboration with Valnea.",
      translation: "Maison molto bella, pulitissima, ben attrezzata. La piscina è fantastica, la posizione ideale per visitare l'Istria. Novasol ha gestito perfettamente gli aspetti amministrativi e l'accoglienza in collaborazione con Valnea."
    }
  ];

  const quickSpecs = [
    { label: "Camere da letto", val: "3 Camere matrimoniali king-size" },
    { label: "Riparto Bagni", val: "3 Bagni completi interni + 1 bagnetto di servizio esterno (nella cucina estiva)" },
    { label: "Idromassaggio / Jacuzzi", val: "Riscaldato (a pagamento extra fuori dal periodo estivo)" },
    { label: "Piscina Privata", val: "Riscaldata solo su richiesta specifica (costo a parte)" },
    { label: "Attrezzature Svago", val: "Tavolo da Calcio Balilla + Occorrente completo per barbecue" },
    { label: "Connessione Wi-Fi", val: "Druskovic_Guest_5G (Password: Druskovic77!)" }
  ];

  return (
    <div className="space-y-6">
      
      {/* HEADER HERO AREA */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-3xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 py-1 bg-rose-50 border border-rose-100 text-rose-750 text-[10px] font-black tracking-widest rounded-md uppercase flex items-center gap-1 shrink-0">
              <Star className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> 5.0 RATING GOOGLE
            </span>
            <span className="text-xs text-indigo-700 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Croazia Occidentale
            </span>
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 tracking-tight font-sans">
            Villa Druskovic — Triban, Croazia
          </h2>
          
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Triban 8, 52460, Triban, Croazia</span>
            <span className="text-slate-200 hidden sm:inline">|</span>
            <span className="text-rose-600 font-bold">Inland Istria (Buje)</span>
          </div>
        </div>

        <div className="flex gap-2 self-stretch md:self-auto justify-center">
          {/* Photos manager dialog trigger */}
          <button
            onClick={() => setIsAdminOpen(!isAdminOpen)}
            className={`text-xs font-black px-4 py-3 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border ${
              isAdminOpen 
                ? "bg-amber-50 text-amber-900 border-amber-300" 
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Sliders className="w-4 h-4" /> 📷 Sostituisci & Gestisci Foto
          </button>

          <a 
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer" 
            className="bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] text-white text-xs font-extrabold px-4 py-3 rounded-xl transition-all shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Map className="w-4 h-4" /> Apri Mappa <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>
      </div>

      {/* PHOTO MANAGEMENT ADMIN DRAWER */}
      {isAdminOpen && (
        <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm animate-fade-in space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                🖼️ Pannello Gestione Immagini della Casa
              </h3>
              <p className="text-[11px] text-slate-500">
                Sostituisci le foto della villa caricando scatti reali dal computer o inserendo link URL diretti.
              </p>
            </div>
            <button
              onClick={() => handleRestoreDefaults()}
              className="p-1 px-2.5 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 uppercase transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Ripristina Foto Originali
            </button>
          </div>

          {uploadError && (
            <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-3 rounded-xl flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-1.5 font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form for adding a photo */}
          <form onSubmit={handleAddPhoto} className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4 text-xs">
            <h4 className="font-bold text-slate-800 uppercase flex items-center gap-1">
              <Plus className="w-4 h-4 text-indigo-600" /> Aggiungi Nuova Foto Vera alla Galleria
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Mode A: Local File Upload */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2 flex flex-col justify-center">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" /> 1. Carica dal tuo Computer / Telefono:
                </span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">File consigliati: JPG, PNG inferiori a 2MB.</p>
              </div>

              {/* Mode B: Direct Web Link */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> 2. Oppure incolla URL Indirizzo Immagine:
                </span>
                <input 
                  type="text"
                  value={newPhotoUrl}
                  onChange={(e) => {
                    setUploadError(null);
                    setNewPhotoUrl(e.target.value);
                  }}
                  placeholder="https://images.example.com/mio-scatto.jpg"
                  className="w-full border border-slate-200 p-2 rounded-md bg-white text-slate-800 text-xs focus:outline-hidden font-medium"
                />
              </div>

            </div>

            {/* Caption & Submit */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="flex-1 space-y-1">
                <span className="font-bold text-slate-700">Didascalia / Spiegazione della foto:</span>
                <input 
                  type="text"
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  placeholder="Es. Il nostro magnifico soggiorno con travi di legno a vista"
                  className="w-full border border-slate-200 p-2 rounded-md bg-white text-slate-800 text-xs focus:outline-hidden font-medium"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-2 rounded-md self-end transition-colors flex items-center gap-1 h-9 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Inserisci Foto
              </button>
            </div>
          </form>

          {/* Current list manager with deletes */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase">La tua galleria attuale ({photos.length} foto):</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              {photos.map((ph, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between group relative text-[10px]">
                  <div className="aspect-video w-full bg-slate-200 overflow-hidden relative">
                    <img src={ph.url} alt="Gallery" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute top-1 left-1.5 font-black text-white bg-slate-900/60 p-0.5 px-1.5 rounded-sm">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 flex-grow flex flex-col justify-between">
                    <p className="font-semibold text-slate-650 leading-tight line-clamp-2" title={ph.caption}>
                      {ph.caption}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(idx)}
                      className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 p-1 rounded-md font-bold transition-colors uppercase flex items-center justify-center gap-0.5 cursor-pointer mt-1"
                    >
                      <Trash2 className="w-3 h-3" /> Rimuovi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TWO COLUMN CONTENT BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side: Photo Slider - Span 7 */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Main big Slider frame */}
          {photos.length > 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-2xs relative group aspect-video">
              <img 
                src={photos[activePhotoIndex]?.url} 
                alt={photos[activePhotoIndex]?.caption}
                className="w-full h-full object-cover select-none transition-transform duration-500 hover:scale-[1.01]"
                referrerPolicy="no-referrer"
              />
              
              {/* Sliding overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              
              <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
                <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wide">
                  FOTO {activePhotoIndex + 1} DI {photos.length}
                </span>
                <p className="text-xs sm:text-sm font-bold leading-snug drop-shadow-sm">
                  {photos[activePhotoIndex]?.caption}
                </p>
              </div>

              {/* Slide Navigation Buttons */}
              {photos.length > 1 && (
                <>
                  <button 
                    onClick={prevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/95 text-white hover:text-slate-900 rounded-full transition-all backdrop-blur-xs cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={nextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/95 text-white hover:text-slate-900 rounded-full transition-all backdrop-blur-xs cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
              <ImageIcon className="w-12 h-12 text-slate-400" />
              <p className="font-bold">Nessuna foto presente nella galleria.</p>
              <button 
                onClick={() => setIsAdminOpen(true)}
                className="text-xs font-black text-indigo-600 underline"
              >
                Aggiungi ora una foto
              </button>
            </div>
          )}

          {/* Thumbnails grid */}
          {photos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((ph, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-16 sm:w-20 aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    activePhotoIndex === idx 
                      ? "border-indigo-600 scale-[1.02] shadow-xs" 
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={ph.url} alt="Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}

          {/* Quick House specs table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-600" /> Scheda Operativa Struttura (Villa Druskovic)
            </h3>
            <div className="grid grid-cols-1 gap-3 text-xs">
              {quickSpecs.map((spec, i) => (
                <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-slate-50 border border-slate-100 rounded-xl gap-1">
                  <span className="text-slate-500 font-bold shrink-0">{spec.label}</span>
                  <span className="font-extrabold text-slate-800 text-left sm:text-right">{spec.val}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side: Google & Booking Reviews list - Span 5 */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
            
            <div className="space-y-1 pb-4 border-b border-slate-100 mb-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">Feedback Degli Ospiti</span>
                <h3 className="font-extrabold text-sm text-indigo-950 flex items-center gap-1.5">
                  ⭐ Recensioni Online Sincronizzate
                </h3>
              </div>
              <span className="p-1 px-2.5 bg-rose-50 text-rose-800 font-black text-xs rounded-lg select-none">
                Voto: 10/10
              </span>
            </div>

            {/* Individual reviews feed */}
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
              {reviews.map((rev) => {
                const isTranslated = !!translatedReviewIds[rev.id];
                const displayedText = isTranslated && rev.translation ? rev.translation : rev.text;

                return (
                  <div key={rev.id} className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl space-y-2.5 hover:bg-slate-50 hover:border-slate-200 transition-all text-xs">
                    
                    {/* Review top metadata */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          {rev.author}
                          <span className="text-[10px] font-medium text-slate-400">{rev.country}</span>
                        </h4>
                        <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> Soggiorno: {rev.date}
                        </p>
                      </div>

                      {/* Source Tag & ratings stars */}
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-sm select-none uppercase tracking-wider">
                          {rev.source}
                        </span>
                        <div className="flex text-amber-500">
                          {Array(rev.rating).fill(null).map((_, bulletIdx) => (
                            <Star key={bulletIdx} className="w-3 h-3 fill-amber-500 text-amber-500" />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Review text */}
                    <p className="text-slate-650 leading-relaxed font-semibold italic">
                      "{displayedText}"
                    </p>

                    {/* Translation Button */}
                    {rev.translation && (
                      <div className="pt-1">
                        <button
                          onClick={() => toggleTranslation(rev.id)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 transition-all cursor-pointer bg-slate-200/50 hover:bg-slate-200 px-2 py-1 rounded-md"
                        >
                          <Languages className="w-3.5 h-3.5 text-indigo-600" />
                          {isTranslated ? "Mostra originale (" + rev.country.split(" ")[0] + ")" : "Traduci in Italiano"}
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Live Synchronized Info note */}
            <div className="mt-4 p-3 bg-indigo-50/55 rounded-xl border border-indigo-100/50 text-[10px] leading-relaxed text-indigo-950">
              <span className="font-extrabold text-indigo-900 block">ℹ️ Aggiornamento Recensioni:</span>
              Le recensioni sono reali ed inserite sulla scheda Google Maps di Villa Druskovic o tramite le agenzie partners dell'immobiliare.
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
