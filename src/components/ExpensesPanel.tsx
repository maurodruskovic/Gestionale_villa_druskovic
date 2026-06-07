import React, { useState } from "react";
import { Reservation, Settings, Expense } from "../types";
import { 
  Plus, 
  Trash2, 
  Receipt, 
  ArrowUpRight, 
  ArrowDownRight, 
  Coins, 
  FileText, 
  Calendar, 
  PlusCircle, 
  Eye, 
  AlertCircle,
  TrendingUp,
  Filter,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  LineChart
} from "lucide-react";

interface ExpensesPanelProps {
  expenses: Expense[];
  reservations: Reservation[];
  settings: Settings;
  onSaveExpense: (exp: Omit<Expense, 'id'>) => Promise<boolean>;
  onDeleteExpense: (id: string) => Promise<void>;
}

// Maps category values to Italian labels and beautiful style presets
const CATEGORY_DETAILS: Record<Expense['category'], { label: string; icon: string; textClass: string; bgClass: string; barBg: string; borderClass: string }> = {
  elettricita: { label: "Bolletta Elettricità", icon: "⚡", textClass: "text-amber-800", bgClass: "bg-amber-50", barBg: "bg-amber-500", borderClass: "border-amber-100" },
  acqua: { label: "Bolletta Acqua", icon: "💧", textClass: "text-blue-800", bgClass: "bg-blue-50", barBg: "bg-indigo-505", borderClass: "border-blue-100" },
  piscina: { label: "Prodotti Piscina", icon: "🏊", textClass: "text-cyan-800", bgClass: "bg-cyan-50", barBg: "bg-cyan-500", borderClass: "border-cyan-100" },
  sauna: { label: "Prodotti Sauna", icon: "🌡️", textClass: "text-rose-805", bgClass: "bg-rose-50", barBg: "bg-rose-500", borderClass: "border-rose-100" },
  stoviglieria: { label: "Spese Stoviglieria", icon: "🍽️", textClass: "text-slate-800", bgClass: "bg-slate-50", barBg: "bg-slate-500", borderClass: "border-slate-100" },
  lenzuola: { label: "Spese Lenzuola", icon: "🛏️", textClass: "text-indigo-800", bgClass: "bg-indigo-50", barBg: "bg-indigo-500", borderClass: "border-indigo-100" },
  asciugamani: { label: "Spese Asciugamani", icon: "🧖", textClass: "text-teal-800", bgClass: "bg-teal-50", barBg: "bg-teal-500", borderClass: "border-teal-100" },
  carta_igienica: { label: "Carta Igienica", icon: "🧻", textClass: "text-emerald-800", bgClass: "bg-emerald-50", barBg: "bg-emerald-500", borderClass: "border-emerald-100" },
  drogheria: { label: "Drogheria", icon: "🛒", textClass: "text-orange-850", bgClass: "bg-orange-50", barBg: "bg-orange-500", borderClass: "border-orange-100" },
  extra: { label: "Spese Extra / Varie", icon: "💸", textClass: "text-purple-800", bgClass: "bg-purple-50", barBg: "bg-purple-500", borderClass: "border-purple-100" }
};

export default function ExpensesPanel({ 
  expenses, 
  reservations, 
  settings, 
  onSaveExpense, 
  onDeleteExpense 
}: ExpensesPanelProps) {
  
  // Year selector for finance breakdown (2022 to 2100)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const years = Array.from({ length: 2100 - 2022 + 1 }, (_, i) => 2022 + i);

  // States for multi-year comparison
  const [selectedComparisonYears, setSelectedComparisonYears] = useState<number[]>([2025, 2026, 2027, 2028]);
  const [showCompRevenue, setShowCompRevenue] = useState(true);
  const [showCompExpenses, setShowCompExpenses] = useState(true);
  const [showCompProfit, setShowCompProfit] = useState(true);

  // Parameterized helper to calculate any arbitrary year's metrics for side-by-side comparison
  const getYearMetrics = (targetY: number) => {
    const yearReservations = reservations.filter((res) => {
      if (res.status === "cancelled") return false;
      const checkInDate = new Date(res.checkIn);
      return checkInDate.getFullYear() === targetY;
    });

    let grossRevenue = 0;
    let netRevenue = 0;

    yearReservations.forEach((res) => {
      const extrasTotal = res.extras ? res.extras.reduce((sum, ext) => sum + ext.price, 0) : 0;
      grossRevenue += res.totalPrice;
      
      const chan = (settings.channels || []).find(
        c => c.name.toLowerCase() === res.source.toLowerCase() || c.id.toLowerCase() === res.source.toLowerCase()
      );
      const isGross = chan ? chan.type === "gross" : (res.source === "Valnea");

      if (!isGross) {
        netRevenue += res.totalPrice + extrasTotal;
      } else {
        const platformCommPct = res.valneaPlatformCommissionPercentage ?? (chan ? chan.commissionPercentage : settings.valneaPlatformCommissionPercentage);
        const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? (chan ? chan.commissionTaxPercentage : settings.valneaPlatformCommissionTaxPercentage);
        const ownerPct = res.valneaOwnerPercentage ?? (chan ? chan.ownerPercentage : settings.valneaOwnerPercentage);

        const gross = res.totalPrice;
        const commValue = gross * (platformCommPct / 100);
        const remaining = gross - commValue;
        
        const ownerShare = remaining * (ownerPct / 100);
        const commTaxValue = commValue * (platformTaxPct / 100);
        
        netRevenue += (ownerShare - commTaxValue) + extrasTotal;
      }
    });

    const yearExpenses = expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      return expDate.getFullYear() === targetY;
    });

    const expensesSum = yearExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = netRevenue - expensesSum;

    return {
      year: targetY,
      gross: grossRevenue,
      revenue: netRevenue,
      expenses: expensesSum,
      profit: profit,
      reservationsCount: yearReservations.length
    };
  };

  const handleAddComparisonYear = (year: number) => {
    if (!selectedComparisonYears.includes(year)) {
      setSelectedComparisonYears([...selectedComparisonYears, year].sort((a, b) => a - b));
    }
  };

  const handleRemoveComparisonYear = (year: number) => {
    setSelectedComparisonYears(selectedComparisonYears.filter(y => y !== year));
  };

  // Filters for expense list
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchNotes, setSearchNotes] = useState<string>("");

  // Form states
  const [formCategory, setFormCategory] = useState<Expense['category']>("elettricita");
  const [formCustomName, setFormCustomName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Step 1: Filter Reservation elements by year
  const activeReservations = reservations.filter((res) => {
    if (res.status === "cancelled") return false;
    const checkInDate = new Date(res.checkIn);
    return checkInDate.getFullYear() === selectedYear;
  });

  // Step 2: Calculate revenues for family net
  let totalGrossRevenue = 0;
  let familyNetRevenue = 0;

  activeReservations.forEach((res) => {
    const extrasTotal = res.extras?.reduce((sum, ext) => sum + ext.price, 0) || 0;
    totalGrossRevenue += res.totalPrice;
    
    const chan = (settings.channels || []).find(
      c => c.name.toLowerCase() === res.source.toLowerCase() || c.id.toLowerCase() === res.source.toLowerCase()
    );
    const isGross = chan ? chan.type === "gross" : (res.source === "Valnea");

    if (!isGross) {
      familyNetRevenue += res.totalPrice + extrasTotal;
    } else {
      const platformCommPct = res.valneaPlatformCommissionPercentage ?? (chan ? chan.commissionPercentage : settings.valneaPlatformCommissionPercentage);
      const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? (chan ? chan.commissionTaxPercentage : settings.valneaPlatformCommissionTaxPercentage);
      const ownerPct = res.valneaOwnerPercentage ?? (chan ? chan.ownerPercentage : settings.valneaOwnerPercentage);

      const gross = res.totalPrice;
      const commValue = gross * (platformCommPct / 100);
      const remaining = gross - commValue;
      
      const ownerShare = remaining * (ownerPct / 100);
      const commTaxValue = commValue * (platformTaxPct / 100);
      
      familyNetRevenue += (ownerShare - commTaxValue) + extrasTotal;
    }
  });

  // Step 3: Filter expenses by year
  const activeExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.date);
    return expDate.getFullYear() === selectedYear;
  });

  // Calculate sum of active expenses
  const totalExpensesSum = activeExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Net Cash Flow (Net Family Income - Active Home Expenses)
  const netCashFlow = familyNetRevenue - totalExpensesSum;

  // Group active expenses by category for charts & distributions
  const categoryTotals: Record<Expense['category'], number> = {
    elettricita: 0,
    acqua: 0,
    piscina: 0,
    sauna: 0,
    stoviglieria: 0,
    lenzuola: 0,
    asciugamani: 0,
    carta_igienica: 0,
    drogheria: 0,
    extra: 0
  };

  activeExpenses.forEach((exp) => {
    if (categoryTotals[exp.category] !== undefined) {
      categoryTotals[exp.category] += exp.amount;
    } else {
      categoryTotals.extra += exp.amount;
    }
  });

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);

    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSubmitError("Inserisci un importo valido e maggiore di zero.");
      return;
    }

    if (formCategory === "extra" && !formCustomName.trim()) {
      setSubmitError("Per le spese extra è richiesto un titolo descrittivo.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSaveExpense({
        category: formCategory,
        customCategoryName: formCategory === "extra" ? formCustomName.trim() : undefined,
        amount: amountNum,
        date: formDate,
        notes: formNotes.trim() || undefined
      });

      if (success) {
        setSubmitSuccess(true);
        setFormAmount("");
        setFormCustomName("");
        setFormNotes("");
        // Reset success notification after 3 seconds
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
    } catch (err) {
      setSubmitError("Errore durante il salvataggio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter history expenses list
  const filteredExpensesList = activeExpenses.filter((exp) => {
    const matchesCategory = categoryFilter === "all" || exp.category === categoryFilter;
    const catDetails = CATEGORY_DETAILS[exp.category];
    const categoryText = exp.category === "extra" ? (exp.customCategoryName || "") : (catDetails?.label || "");
    const notesText = exp.notes || "";
    const matchesSearch = 
      categoryText.toLowerCase().includes(searchNotes.toLowerCase()) ||
      notesText.toLowerCase().includes(searchNotes.toLowerCase());

    return matchesCategory && matchesSearch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      
      {/* Upper context filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            Controllo Spese & Flussi di Cassa
          </h2>
          <p className="text-xs text-slate-500">
            Valuta in tempo reale l'efficienza economica inserendo i costi fissi e di consumo di Villa Druskovic.
          </p>
        </div>

        {/* Year Selector con menù a tendina */}
        <div className="flex bg-slate-50 border border-slate-200 p-1.5 px-3 rounded-xl items-center text-xs font-bold gap-2 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <span className="text-slate-500 flex items-center gap-1.5 font-bold">
            <Calendar className="w-4 h-4 text-slate-400" /> Anno di competenza:
          </span>
          <select
            id="select-expenses-panel-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs font-black text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Anno {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* THREE BENTO FINANCIAL SUMMARY CARD ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Entrate Netto Famiglia */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs hover:shadow-xs transition-shadow relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] text-indigo-805">
            <Coins className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">
              Ricavi Netti Famiglia ({selectedYear})
            </span>
            <span className="p-1 px-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-md flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> ENTRATE
            </span>
          </div>
          <div className="mt-3.5 space-y-1">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              €{familyNetRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="text-[10px] text-slate-505 font-bold space-y-0.5">
              <span>Prenotazioni lorde (intermedie): €{totalGrossRevenue.toLocaleString("it-IT", { maximumFractionDigits: 0 })}</span>
              <p className="text-indigo-600">Comprende prenotazioni pulite ed extra dedotte provvigioni.</p>
            </div>
          </div>
        </div>

        {/* Spese Totali Gestione */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs hover:shadow-xs transition-shadow relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] text-amber-950">
            <Receipt className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">
              Spese Totali Abitazione ({selectedYear})
            </span>
            <span className="p-1 px-1.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-md flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" /> USCITE
            </span>
          </div>
          <div className="mt-3.5 space-y-1">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              €{totalExpensesSum.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold">
              Rappresenta la somma delle bollette, costi consumabili piscina, biancheria e altro.
            </p>
          </div>
        </div>

        {/* Flusso di Cassa Netto */}
        <div className={`p-5 rounded-2xl border shadow-3xs hover:shadow-xs transition-shadow relative overflow-hidden ${
          netCashFlow >= 0 
            ? "bg-emerald-50/50 border-emerald-100" 
            : "bg-rose-50/50 border-rose-100"
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-500">
              Utile / Flusso di Cassa Netto
            </span>
            <span className={`p-1 px-1.5 text-[10px] font-black rounded-md select-none ${
              netCashFlow >= 0 
                ? "bg-emerald-100 text-emerald-800" 
                : "bg-rose-100 text-rose-800"
            }`}>
              {netCashFlow >= 0 ? "SURPLUS" : "DEFICIT CONTO"}
            </span>
          </div>
          <div className="mt-3.5 space-y-1">
            <h3 className={`text-3xl font-black tracking-tight ${
              netCashFlow >= 0 ? "text-emerald-900" : "text-rose-900"
            }`}>
              €{netCashFlow.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="text-[10px] font-semibold text-slate-600">
              {netCashFlow >= 0 ? (
                <span className="text-emerald-800 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" /> Conto positivo. L'attività genera profitto netto ideale.
                </span>
              ) : (
                <span className="text-rose-800 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" /> I costi programmati per quest'anno superano le entrate attuali.
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MAIN TWO PANEL LAYOUT: EXPENSES DISTRIBUTION CHART (VIRTUAL PIE GRAPH BENTO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Categoria distribution percentages (Visual Horizontal Bento Bars) - Span 5 */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs flex flex-col justify-between">
          <div className="space-y-1 pb-4 border-b border-slate-50">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Ripartizione dei Costi
            </h3>
            <p className="text-[11px] text-slate-400">Distribuzione percentuale delle uscite per l'anno {selectedYear}.</p>
          </div>

          <div className="space-y-3.5 py-4 flex-1 justify-center flex flex-col">
            {totalExpensesSum === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Receipt className="w-10 h-10 text-slate-200 mx-auto" />
                <p className="text-xs text-slate-400 font-bold">Nessun costo inserito per il {selectedYear}.</p>
                <p className="text-[10px] text-slate-450">Registra le bollette o le dotazioni per visualizzare la ripartizione.</p>
              </div>
            ) : (
              (Object.keys(CATEGORY_DETAILS) as Array<Expense['category']>).map((catKey) => {
                const amount = categoryTotals[catKey] || 0;
                const percentage = totalExpensesSum > 0 ? (amount / totalExpensesSum) * 100 : 0;
                const details = CATEGORY_DETAILS[catKey];
                
                if (amount === 0) return null; // Only show non-zero cost lines

                return (
                  <div key={catKey} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="text-base leading-none">{details?.icon || "💸"}</span>
                        {details?.label}
                      </span>
                      <span className="font-extrabold text-slate-900">
                        €{amount.toFixed(2)} <span className="text-[10px] font-semibold text-slate-400">({percentage.toFixed(1)}%)</span>
                      </span>
                    </div>
                    {/* Visual custom progress bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${details?.barBg || "bg-indigo-600"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Info Box on Home Cash Flow */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[10px] leading-relaxed text-slate-500">
            <span className="font-bold text-indigo-900 block border-b border-slate-100 pb-1 mb-1 mb-1">💡 Suggerimento di Controllo:</span>
            Controlla regolarmente le spese della <strong className="text-slate-800">Crociera/Piscina</strong> e della <strong className="text-slate-800">Sauna</strong> durante il picco estivo per ottimizzare la bolletta della luce elettrica!
          </div>
        </div>

        {/* Right Side: Expense adding form - Span 7 */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
          
          <div className="space-y-1 pb-4 border-b border-slate-50 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-indigo-650" /> Registra Nuova Spesa Abitazione
            </h3>
            <p className="text-[11px] text-slate-400">Inserisci una nuova spesa. Il sistema la applicherà al rendiconto economico.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Category selector */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Categoria di costo:</label>
                <select
                  value={formCategory}
                  onChange={(e) => {
                    setFormCategory(e.target.value as Expense['category']);
                    setSubmitError("");
                  }}
                  className="w-full p-2.5 bg-slate-55 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="elettricita">⚡ Bolletta Elettricità</option>
                  <option value="acqua">💧 Bolletta Acqua</option>
                  <option value="piscina">🏊 Prodotti per la piscina</option>
                  <option value="sauna">🌡️ Prodotti per la sauna</option>
                  <option value="stoviglieria">🍽️ Spese stoviglieria</option>
                  <option value="lenzuola">🛏️ Spese lenzuola/tessili</option>
                  <option value="asciugamani">🧖 Spese asciugamani</option>
                  <option value="carta_igienica">🧻 Carta igienica</option>
                  <option value="drogheria">🛒 Drogheria e spesa casa</option>
                  <option value="extra">💸 Costo Extra (Altro non presente)</option>
                </select>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Importo Pagato (€):</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Es. 120.45"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-505 focus:outline-hidden font-bold"
                />
              </div>

            </div>

            {/* Custom Extra expense category description input (triggers only when category is 'extra') */}
            {formCategory === "extra" && (
              <div className="space-y-1 animate-fadeIn">
                <label className="font-bold text-purple-900 block flex items-center gap-1">
                  💡 Titolo Spesa Extra Personalizzata: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Es. Sostituzione lampadina giardino, Manutenzione cancello..."
                  value={formCustomName}
                  onChange={(e) => {
                    setFormCustomName(e.target.value);
                    setSubmitError("");
                  }}
                  className="w-full p-2.5 bg-purple-50/50 border border-purple-100 rounded-xl focus:ring-1 focus:ring-purple-400 focus:outline-hidden font-semibold placeholder:text-violet-350"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Date selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Data del Pagamento:</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Quick helper info */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Note aggiuntive / Dettagli:</label>
                <input
                  type="text"
                  placeholder="Es. Numero fattura, fornitore o periodicità"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

            </div>

            {/* Alerts Feedback */}
            {submitError && (
              <p className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-bold rounded-xl flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5" /> {submitError}
              </p>
            )}

            {submitSuccess && (
              <p className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle className="w-3.5 h-3.5" /> Spesa registrata ed integrata con successo nel rendiconto familiare!
              </p>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold p-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all text-xs border border-slate-900 shadow-sm"
            >
              {isSubmitting ? "Registrazione in corso..." : "Salva e Registra Spesa"}
            </button>

          </form>

        </div>

      </div>

      {/* FILTERABLE EXPENSE HISTORY LIST */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
        
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b border-slate-50 mb-4">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">Cronologia Movimenti</span>
            <h3 className="font-extrabold text-sm text-indigo-950 flex items-center gap-1.5">
              📖 Elenco Spese Registrate ({selectedYear})
            </h3>
          </div>

          {/* List Search & category fitler */}
          <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
            
            {/* Note search */}
            <input
              type="text"
              placeholder="Cerca per parola chiave..."
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full md:w-48 placeholder:text-slate-400"
            />

            {/* Category filter dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer focus:outline-hidden"
            >
              <option value="all">Filtra per Categoria</option>
              <option value="elettricita">⚡ Elettricità</option>
              <option value="acqua">💧 Acqua</option>
              <option value="piscina">🏊 Prodotti Piscina</option>
              <option value="sauna">🌡️ Prodotti Sauna</option>
              <option value="stoviglieria">🍽️ Stoviglieria</option>
              <option value="lenzuola">🛏️ Lenzuola</option>
              <option value="asciugamani">🧖 Asciugamani</option>
              <option value="carta_igienica">🧻 Carta Igienica</option>
              <option value="drogheria">🛒 Drogheria</option>
              <option value="extra">💸 Spese Extra</option>
            </select>
            
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto">
          {filteredExpensesList.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <Receipt className="w-8 h-8 mx-auto text-slate-200" />
              <p className="text-xs font-bold">Nessun movimento trovato per i filtri selezionati.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                  <th className="py-2.5">Categoria</th>
                  <th className="py-2.5">Data Pagamento</th>
                  <th className="py-2.5">Dettagli / Note</th>
                  <th className="py-2.5 text-right">Importo</th>
                  <th className="py-2.5 text-center w-16">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredExpensesList.map((exp) => {
                  const details = CATEGORY_DETAILS[exp.category];
                  const displayLabel = exp.category === "extra" ? (exp.customCategoryName || "Spesa Extra") : (details?.label || exp.category);
                  const isExtra = exp.category === "extra";

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-3 font-semibold text-slate-800">
                        <span className={`p-1.5 px-2.5 rounded-lg border flex items-center gap-1.5 max-w-fit text-[11px] font-bold ${
                          isExtra ? "bg-purple-50 text-purple-800 border-purple-100" : (details?.bgClass || "bg-slate-100")
                        } ${details?.borderClass || "border-slate-200"}`}>
                          <span>{details?.icon || "💸"}</span>
                          {displayLabel}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 font-medium">
                        {new Date(exp.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                      </td>
                      <td className="py-3 text-slate-650 max-w-xs truncate font-medium">
                        {exp.notes || <em className="text-slate-400 font-normal">Nessuna nota inserita</em>}
                      </td>
                      <td className="py-3 text-right font-black text-slate-900 text-sm">
                        €{exp.amount.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => onDeleteExpense(exp.id)}
                          title="Elimina record"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* MULTI-YEAR FINANCIAL COMPARISON */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-3xs space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              Analisi Multi-Sito & Trend Storici
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
              <LineChart className="w-5 h-5 text-indigo-650" /> Confronto Finanziario Pluriennale
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitora l'andamento macro-economico sovrapponendo i ricavi, le spese e gli utili netti di diversi anni.
            </p>
          </div>

          {/* Metrics filter checkbuttons */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer hover:bg-white transition-all select-none">
              <input
                type="checkbox"
                checked={showCompRevenue}
                onChange={() => setShowCompRevenue(!showCompRevenue)}
                className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
              <span className="font-bold text-emerald-800">Ricavi Netti</span>
            </label>
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer hover:bg-white transition-all select-none">
              <input
                type="checkbox"
                checked={showCompExpenses}
                onChange={() => setShowCompExpenses(!showCompExpenses)}
                className="rounded border-slate-350 text-rose-600 focus:ring-rose-500"
              />
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" />
              <span className="font-bold text-rose-800">Spese Casa</span>
            </label>
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer hover:bg-white transition-all select-none">
              <input
                type="checkbox"
                checked={showCompProfit}
                onChange={() => setShowCompProfit(!showCompProfit)}
                className="rounded border-slate-350 text-indigo-650 focus:ring-indigo-500"
              />
              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-sm" />
              <span className="font-bold text-indigo-900">Utile Pulito</span>
            </label>
          </div>
        </div>

        {/* YEAR SELECTION MANAGER BAR */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50 border border-slate-200/60 p-4 rounded-xl text-xs">
          <div className="space-y-1.5">
            <span className="font-black text-slate-700 block text-xs">Anni inclusi nel confronto:</span>
            <div className="flex flex-wrap gap-2">
              {selectedComparisonYears.map((y) => (
                <span
                  key={y}
                  className="inline-flex items-center gap-1.5 p-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-extrabold shadow-3xs text-[11px]"
                >
                  Anno {y}
                  <button
                    type="button"
                    onClick={() => handleRemoveComparisonYear(y)}
                    disabled={selectedComparisonYears.length <= 1}
                    className="text-slate-400 hover:text-rose-600 font-black cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
                    title="Rimuovi anno"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Add Year menu */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto justify-end">
            <span className="text-slate-500 font-semibold">Aggiungi anno al confronto:</span>
            <select
              id="select-add-comparison-year"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAddComparisonYear(Number(e.target.value));
                  e.target.value = "";
                }
              }}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold border border-indigo-500 rounded-xl px-3 py-2 focus:outline-hidden cursor-pointer shadow-2xs"
            >
              <option value="">-- Seleziona anno --</option>
              {years
                .filter((y) => !selectedComparisonYears.includes(y))
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* SVG LINE CHART WITH COMPDATA CALCULATION */}
        {(() => {
          const compData = selectedComparisonYears
            .map((y) => getYearMetrics(y))
            .sort((a, b) => a.year - b.year);

          if (compData.length === 0) {
            return (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium font-bold">
                Seleziona almeno un anno per compilare i dati di confronto.
              </div>
            );
          }

          // Gather values considering only enabled line toggles
          const comparisonValues: number[] = [];
          compData.forEach((d) => {
            if (showCompRevenue) comparisonValues.push(d.revenue);
            if (showCompExpenses) comparisonValues.push(d.expenses);
            if (showCompProfit) comparisonValues.push(d.profit);
          });

          const maxVal = comparisonValues.length > 0 ? Math.max(...comparisonValues, 100) : 100;
          const minVal = comparisonValues.length > 0 ? Math.min(...comparisonValues, 0) : -50;
          const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

          // Chart canvas viewport dimensions
          const padLeft = 85; 
          const padRight = 35;
          const padTop = 30;
          const padBottom = 35;
          const chartH = 260 - padTop - padBottom; 
          const chartW = 800 - padLeft - padRight; 

          const getX = (idx: number) => {
            if (compData.length <= 1) return padLeft + chartW / 2;
            return padLeft + (idx / (compData.length - 1)) * chartW;
          };

          const getY = (v: number) => {
            const ratio = (v - minVal) / valRange;
            return 260 - padBottom - ratio * chartH;
          };

          // Generate paths for direct lines
          const getPath = (key: "revenue" | "expenses" | "profit") => {
            if (compData.length <= 1) return "";
            return compData
              .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d[key])}`)
              .join(" ");
          };

          const gridTicks = [
            minVal,
            minVal + valRange * 0.25,
            minVal + valRange * 0.5,
            minVal + valRange * 0.75,
            maxVal,
          ];

          return (
            <div className="space-y-6">
              {/* SVG Block */}
              <div className="bg-slate-950 p-4.5 pt-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden select-none">
                {/* Background glow matrix */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_30px] opacity-40 pointer-events-none" />

                <svg viewBox="0 0 800 260" className="w-full h-auto overflow-visible relative">
                  {/* Horizontal gridlines and tick labels */}
                  {gridTicks.map((val, idx) => {
                    const y = getY(val);
                    return (
                      <g key={idx}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={800 - padRight}
                          y2={y}
                          className="stroke-slate-800/60"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={padLeft - 10}
                          y={y + 3.5}
                          textAnchor="end"
                          className="fill-slate-500 font-mono text-[9px] font-bold"
                        >
                          €{val.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                        </text>
                      </g>
                    );
                  })}

                  {/* Profit Breakeven Line (Y = 0) if negative profits are observed */}
                  {minVal < 0 && maxVal > 0 && (
                    <line
                      x1={padLeft}
                      y1={getY(0)}
                      x2={800 - padRight}
                      y2={getY(0)}
                      className="stroke-rose-900/40"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Vertical lines connecting years */}
                  {compData.map((d, i) => {
                    const x = getX(i);
                    return (
                      <g key={i}>
                        <line
                          x1={x}
                          y1={padTop}
                          x2={x}
                          y2={260 - padBottom}
                          className="stroke-slate-800/40"
                          strokeWidth="1"
                        />
                        {/* Year description text along the X-axis */}
                        <text
                          x={x}
                          y={260 - padBottom + 18}
                          textAnchor="middle"
                          className="fill-slate-300 font-mono text-[10px] font-black"
                        >
                          {d.year}
                        </text>
                      </g>
                    );
                  })}

                  {/* The actual linear trends path lines */}
                  {compData.length > 1 && (
                    <>
                      {/* Revenue Line */}
                      {showCompRevenue && (
                        <path
                          d={getPath("revenue")}
                          fill="none"
                          className="stroke-emerald-500"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Expenses Line */}
                      {showCompExpenses && (
                        <path
                          d={getPath("expenses")}
                          fill="none"
                          className="stroke-rose-500"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Profit Line */}
                      {showCompProfit && (
                        <path
                          d={getPath("profit")}
                          fill="none"
                          className="stroke-indigo-500"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </>
                  )}

                  {/* Interactive Dot Plots representing year values */}
                  {compData.map((d, i) => {
                    const x = getX(i);
                    const yRev = getY(d.revenue);
                    const yExp = getY(d.expenses);
                    const yProf = getY(d.profit);

                    return (
                      <g key={i}>
                        {/* Revenue dots */}
                        {showCompRevenue && (
                          <circle
                            cx={x}
                            cy={yRev}
                            r="5.5"
                            className="fill-emerald-500 stroke-slate-950 stroke-[2px] cursor-pointer hover:scale-130 transition-transform"
                            title={`Ricavo ${d.year}: €${d.revenue}`}
                          />
                        )}

                        {/* Expenses dots */}
                        {showCompExpenses && (
                          <circle
                            cx={x}
                            cy={yExp}
                            r="5.5"
                            className="fill-rose-500 stroke-slate-950 stroke-[2px] cursor-pointer hover:scale-130 transition-transform"
                            title={`Spesa ${d.year}: €${d.expenses}`}
                          />
                        )}

                        {/* Profit dots */}
                        {showCompProfit && (
                          <circle
                            cx={x}
                            cy={yProf}
                            r="5.5"
                            className="fill-indigo-500 stroke-slate-950 stroke-[2px] cursor-pointer hover:scale-130 transition-transform"
                            title={`Utile ${d.year}: €${d.profit}`}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {compData.length <= 1 && (
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs font-semibold text-slate-500 px-6">
                    ⚠️ Seleziona almeno due anni per tracciare le linee di andamento del confronto.
                  </div>
                )}
              </div>

              {/* DETAILED COMPARISON DATA TABLE */}
              <div className="space-y-3.5">
                <span className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  📋 Tabella Dettagli Relatività e Crescita
                </span>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left font-medium text-xs text-slate-600 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                        <th className="p-3.5">Anno</th>
                        <th className="p-3.5 text-right">Lordo Prenotazioni</th>
                        <th className="p-3.5 text-right text-emerald-800 bg-emerald-50/20">Ricavo Netto</th>
                        <th className="p-3.5 text-right text-rose-800 bg-rose-50/20">Spese Casa</th>
                        <th className="p-3.5 text-right text-indigo-900 bg-indigo-50/20">Utile Pulito</th>
                        <th className="p-3.5 text-center">Margine Operativo</th>
                        <th className="p-3.5 text-right">Crescita Utile vs. Prec.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {compData.map((d, idx) => {
                        const operatingMargin = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                        const prevYearData = idx > 0 ? compData[idx - 1] : null;

                        let growthStr = "-";
                        let growthPositive = false;
                        let growthNegative = false;

                        if (prevYearData) {
                          const delta = d.profit - prevYearData.profit;
                          const formattedDelta = `${delta >= 0 ? "+" : ""}€${delta.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
                          
                          if (prevYearData.profit !== 0) {
                            const percent = (delta / Math.abs(prevYearData.profit)) * 100;
                            growthStr = `${formattedDelta} (${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%)`;
                          } else {
                            growthStr = formattedDelta;
                          }

                          growthPositive = delta > 0;
                          growthNegative = delta < 0;
                        }

                        return (
                          <tr key={d.year} className="hover:bg-slate-50/40 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900">Anno {d.year}</td>
                            <td className="p-3.5 text-right text-slate-500 font-mono">
                              €{d.gross.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-emerald-700 font-mono bg-emerald-50/10">
                              €{d.revenue.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-rose-700 font-mono bg-rose-50/10">
                              €{d.expenses.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-bold text-indigo-900 font-mono bg-indigo-50/10">
                              €{d.profit.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-center font-bold">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] ${
                                operatingMargin >= 50 
                                  ? "bg-green-100 text-green-800"
                                  : operatingMargin >= 20 
                                  ? "bg-indigo-100 text-indigo-800"
                                  : operatingMargin >= 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}>
                                {operatingMargin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-bold font-mono">
                              {growthPositive && (
                                <span className="text-emerald-600 inline-flex items-center gap-1">
                                  ▲ {growthStr}
                                </span>
                              )}
                              {growthNegative && (
                                <span className="text-rose-600 inline-flex items-center gap-1">
                                  ▼ {growthStr}
                                </span>
                              )}
                              {!growthPositive && !growthNegative && (
                                <span className="text-slate-400">{growthStr}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
