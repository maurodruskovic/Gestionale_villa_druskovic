import React, { useState } from "react";
import { Reservation, Settings, Expense } from "../types";
import { 
  TrendingUp, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  HelpCircle, 
  BarChart3, 
  AlertCircle,
  Download,
  Printer,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Filter,
  TrendingDown,
  PieChart,
  ArrowRight,
  ChevronDown,
  X
} from "lucide-react";

interface StatsPanelProps {
  reservations: Reservation[];
  settings: Settings;
  expenses: Expense[];
}

export default function StatsPanel({ reservations, settings, expenses }: StatsPanelProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const years = Array.from({ length: 2100 - 2022 + 1 }, (_, i) => 2022 + i);

  // Month select dropdown state for the Month-by-Month view
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-11
  
  // Chart variable toggle state: "revenue_vs_expenses" or "ratio_gross_net_exp"
  const [chartVariable, setChartVariable] = useState<"revenue_vs_expenses" | "ratio_gross_net_exp">("revenue_vs_expenses");

  // Print hub states
  const [reportPeriod, setReportPeriod] = useState<"whole" | "year" | "month">("year");
  const [reportFormat, setReportFormat] = useState<"simple" | "detailed">("detailed");
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Colors list for visual channel indicators
  const channelColors = [
    { bg: "bg-indigo-500", text: "text-indigo-650", dot: "bg-indigo-505", rawBg: "bg-indigo-50/55" },
    { bg: "bg-emerald-500", text: "text-emerald-650", dot: "bg-emerald-505", rawBg: "bg-emerald-50/55" },
    { bg: "bg-amber-500", text: "text-amber-650", dot: "bg-amber-505", rawBg: "bg-amber-50/55" },
    { bg: "bg-rose-500", text: "text-rose-650", dot: "bg-rose-505", rawBg: "bg-rose-50/55" },
    { bg: "bg-cyan-500", text: "text-cyan-650", dot: "bg-cyan-505", rawBg: "bg-cyan-50/55" },
    { bg: "bg-purple-500", text: "text-purple-650", dot: "bg-purple-505", rawBg: "bg-purple-50/55" }
  ];

  const monthLabelsFull = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  const monthLabelsAbbr = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

  // -------------------------------------------------------------
  // CALCULATIONS SECTION
  // -------------------------------------------------------------

  // Filter reservations by selected year
  const currentYearReservations = reservations.filter((res) => {
    if (res.status === "cancelled") return false;
    const start = new Date(res.checkIn);
    const end = new Date(res.checkOut);
    let current = new Date(start);
    while (current < end) {
      if (current.getFullYear() === selectedYear) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    return false;
  });

  // Filter expenses by selected year
  const currentYearExpenses = expenses.filter((exp) => {
    const d = new Date(exp.date);
    return d.getFullYear() === selectedYear;
  });

  // Setup channels breakdown maps
  const channelBreakdowns: Record<string, {
    id: string;
    name: string;
    nights: number;
    gross: number;
    ownerNet: number;
    agentShare: number;
    commissions: number;
    taxes: number;
    type: "gross" | "net";
  }> = {};

  const allConfiguredChannels = settings.channels || [
    { id: "valnea", name: "Valnea", type: "gross", commissionPercentage: 15, commissionTaxPercentage: 25, ownerPercentage: 85, agentPercentage: 15 },
    { id: "novasol", name: "Novasol CLS574", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 },
    { id: "famiglia", name: "Famiglia", type: "net", commissionPercentage: 0, commissionTaxPercentage: 0, ownerPercentage: 100, agentPercentage: 0 }
  ];

  allConfiguredChannels.forEach(c => {
    channelBreakdowns[c.id.toLowerCase()] = {
      id: c.id.toLowerCase(),
      name: c.name,
      nights: 0,
      gross: 0,
      ownerNet: 0,
      agentShare: 0,
      commissions: 0,
      taxes: 0,
      type: c.type
    };
  });

  let totalNights = 0;
  let totalExtrasAllSources = 0;

  // Monthly buckets (indices 0-11)
  const monthlyNights = Array(12).fill(0);
  const monthlyRevenue = Array(12).fill(0); // Family Net Revenue
  const monthlyExpenses = Array(12).fill(0); // Cumulative monthly expenses
  const monthlyGrossRealized = Array(12).fill(0); // Cumulative monthly gross revenue

  // Populate Monthly Expenses
  currentYearExpenses.forEach((exp) => {
    const d = new Date(exp.date);
    const m = d.getMonth();
    monthlyExpenses[m] += exp.amount;
  });

  // Populate reservations, splits & monthly charts
  reservations.forEach((res) => {
    if (res.status === "cancelled") return;

    const start = new Date(res.checkIn);
    const end = new Date(res.checkOut);
    const totalNightsOfStay = res.nights || 1;
    const srcLower = res.source.toLowerCase();

    const channelSettings = allConfiguredChannels.find(c => c.id.toLowerCase() === srcLower || c.name.toLowerCase() === srcLower) || {
      id: srcLower,
      name: res.source,
      type: srcLower === "valnea" ? ("gross" as const) : ("net" as const),
      commissionPercentage: srcLower === "valnea" ? 15 : 0,
      commissionTaxPercentage: srcLower === "valnea" ? 25 : 0,
      ownerPercentage: srcLower === "valnea" ? 85 : 100,
      agentPercentage: srcLower === "valnea" ? 15 : 0
    };

    const targetKey = channelSettings.id.toLowerCase();

    // Dyn fallback
    if (!channelBreakdowns[targetKey]) {
      channelBreakdowns[targetKey] = {
        id: targetKey,
        name: channelSettings.name,
        nights: 0,
        gross: 0,
        ownerNet: 0,
        agentShare: 0,
        commissions: 0,
        taxes: 0,
        type: channelSettings.type
      };
    }

    const chanData = channelBreakdowns[targetKey];

    const bookingGross = res.totalPrice;
    let bookingComm = 0;
    let bookingAgentShare = 0;
    let bookingTax = 0;
    let bookingOwnerNet = 0;
    const bookingExtras = res.extras?.reduce((sum, ext) => sum + ext.price, 0) || 0;

    if (channelSettings.type === "gross") {
      const platformCommPct = res.valneaPlatformCommissionPercentage ?? channelSettings.commissionPercentage;
      const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? channelSettings.commissionTaxPercentage;
      const ownerPct = res.valneaOwnerPercentage ?? channelSettings.ownerPercentage;
      const agentPct = res.valneaAgentPercentage ?? channelSettings.agentPercentage;

      bookingComm = bookingGross * (platformCommPct / 100);
      const remaining = bookingGross - bookingComm;
      bookingAgentShare = remaining * (agentPct / 100);
      const bookingOwnerShare = remaining * (ownerPct / 100);
      bookingTax = bookingComm * (platformTaxPct / 100);
      bookingOwnerNet = bookingOwnerShare - bookingTax;
    } else {
      const ownerPct = channelSettings.ownerPercentage ?? 100;
      const agentPct = channelSettings.agentPercentage ?? 0;

      bookingAgentShare = bookingGross * (agentPct / 100);
      bookingOwnerNet = bookingGross * (ownerPct / 100);
    }

    // Daily distribution loop
    let current = new Date(start);
    let nightsInYearCount = 0;

    while (current < end) {
      if (current.getFullYear() === selectedYear) {
        const m = current.getMonth();
        nightsInYearCount++;
        totalNights++;
        monthlyNights[m]++;

        const shareOfNight = 1 / totalNightsOfStay;

        chanData.nights += 1;
        chanData.gross += bookingGross * shareOfNight;
        chanData.commissions += bookingComm * shareOfNight;
        chanData.taxes += bookingTax * shareOfNight;
        chanData.agentShare += bookingAgentShare * shareOfNight;
        chanData.ownerNet += bookingOwnerNet * shareOfNight;

        // Proportional net for family on this stay month
        const familyNetForThisNight = (bookingOwnerNet + bookingExtras) * shareOfNight;
        monthlyRevenue[m] += familyNetForThisNight;
        monthlyGrossRealized[m] += bookingGross * shareOfNight;
      }
      current.setDate(current.getDate() + 1);
    }

    if (nightsInYearCount > 0) {
      const shareOfExtrasInYear = bookingExtras * (nightsInYearCount / totalNightsOfStay);
      totalExtrasAllSources += shareOfExtrasInYear;
    }
  });

  let grandTotalNetFamily = totalExtrasAllSources;
  let grandTotalGrossYear = 0;

  Object.values(channelBreakdowns).forEach(chan => {
    grandTotalNetFamily += chan.ownerNet;
    grandTotalGrossYear += chan.gross;
  });

  // Calculate annual expenses total
  const totalExpensesYear = currentYearExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfitYear = grandTotalNetFamily - totalExpensesYear;

  // Single-month specific calculations based on the select month menu
  const singleMonthRevenue = monthlyRevenue[selectedMonth];
  const singleMonthExpenses = monthlyExpenses[selectedMonth];
  const singleMonthGross = monthlyGrossRealized[selectedMonth];
  const singleMonthNetProfit = singleMonthRevenue - singleMonthExpenses;

  // -------------------------------------------------------------
  // EXCEL EXPORT ENGINE
  // -------------------------------------------------------------
  const handleExportToExcel = () => {
    // Generate absolute comprehensive spreadsheet containing ALL database entries safely formatted
    let excelContent = `
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; margin-bottom: 25px; }
        th { background-color: #4F46E5; color: #FFFFFF; font-weight: bold; font-size: 13px; text-transform: uppercase; padding: 10px; border: 1px solid #D1D5DB; }
        td { padding: 8px 10px; font-size: 12px; border: 1px solid #E5E7EB; }
        .title { font-size: 18px; font-weight: bold; color: #1E1B4B; margin-bottom: 10px; }
        .subtitle { font-size: 11px; color: #6B7280; margin-bottom: 20px; }
        .total-row { font-weight: bold; background-color: #F3F4F6; }
        .currency { mso-number-format: "\\00a0\\20ac"\\ #\\,##0\\.00; text-align: right; }
        .text-center { text-align: center; }
        .header-box { background-color: #EEF2F6; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="title">Villa Druskovic — Rendiconto Finanziario Completo</div>
        <div class="subtitle">Esportazione Database del: ${new Date().toLocaleDateString("it-IT")} | Valuta: EUR (&euro;)</div>
      </div>

      <div class="title" style="font-size: 14px;">1. REGISTRO PRENOTAZIONI / SOGGIORNI</div>
      <table>
        <thead>
          <tr>
            <th>ID Prenotazione</th>
            <th>Nome Ospite</th>
            <th>Cognome Ospite</th>
            <th>Telefono</th>
            <th>Email</th>
            <th>Nazionalit&agrave;</th>
            <th>Arrivo (Check-in)</th>
            <th>Partenza (Check-out)</th>
            <th>Notti</th>
            <th>Fonte / OTA</th>
            <th>Sub-Canale Valnea</th>
            <th>Tariffa Lorda/Netta (&euro;)</th>
            <th>Commissione Portale (&euro;)</th>
            <th>Co-host Coeff (&euro;)</th>
            <th>Imposta Commissione (&euro;)</th>
            <th>Netto Famiglia Rilevato (&euro;)</th>
            <th>Extra Totali (&euro;)</th>
            <th>Stato Soggiorno</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Populate reservations
    reservations.forEach((res) => {
      const srcLower = res.source.toLowerCase();
      const channelSettings = allConfiguredChannels.find(c => c.id.toLowerCase() === srcLower || c.name.toLowerCase() === srcLower) || {
        type: srcLower === "valnea" ? "gross" : "net",
        commissionPercentage: srcLower === "valnea" ? 15 : 0,
        commissionTaxPercentage: srcLower === "valnea" ? 25 : 0,
        ownerPercentage: srcLower === "valnea" ? 85 : 100,
        agentPercentage: srcLower === "valnea" ? 15 : 0
      };

      const bookingGross = res.totalPrice;
      let bookingComm = 0;
      let bookingAgentShare = 0;
      let bookingTax = 0;
      let bookingOwnerNet = 0;
      const bookingExtras = res.extras?.reduce((sum, ext) => sum + ext.price, 0) || 0;

      if (channelSettings.type === "gross") {
        const platformCommPct = res.valneaPlatformCommissionPercentage ?? channelSettings.commissionPercentage;
        const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? channelSettings.commissionTaxPercentage;
        const ownerPct = res.valneaOwnerPercentage ?? channelSettings.ownerPercentage;
        const agentPct = res.valneaAgentPercentage ?? channelSettings.agentPercentage;

        bookingComm = bookingGross * (platformCommPct / 100);
        const remaining = bookingGross - bookingComm;
        bookingAgentShare = remaining * (agentPct / 100);
        bookingTax = bookingComm * (platformTaxPct / 100);
        bookingOwnerNet = (remaining * (ownerPct / 100)) - bookingTax;
      } else {
        const ownerPct = channelSettings.ownerPercentage ?? 100;
        const agentPct = channelSettings.agentPercentage ?? 0;
        bookingAgentShare = bookingGross * (agentPct / 100);
        bookingOwnerNet = bookingGross * (ownerPct / 100);
      }

      excelContent += `
        <tr>
          <td>${res.id}</td>
          <td>${res.guestName}</td>
          <td>${res.guestSurname}</td>
          <td>${res.guestPhone || "-"}</td>
          <td>${res.guestEmail || "-"}</td>
          <td>${res.guestNationality || "N.D."}</td>
          <td class="text-center">${res.checkIn}</td>
          <td class="text-center">${res.checkOut}</td>
          <td class="text-center">${res.nights}</td>
          <td>${res.source}</td>
          <td>${res.valneaSubChannel || "-"}</td>
          <td class="currency">${bookingGross.toFixed(2)}</td>
          <td class="currency">${bookingComm.toFixed(2)}</td>
          <td class="currency">${bookingAgentShare.toFixed(2)}</td>
          <td class="currency">${bookingTax.toFixed(2)}</td>
          <td class="currency">${bookingOwnerNet.toFixed(2)}</td>
          <td class="currency">${bookingExtras.toFixed(2)}</td>
          <td class="text-center" style="font-weight: bold; color: ${res.status === "cancelled" ? "#DC2626" : "#059669"}">${res.status.toUpperCase()}</td>
        </tr>
      `;
    });

    excelContent += `
        </tbody>
      </table>

      <br>
      <div class="title" style="font-size: 14px;">2. ARCHIVIO SPESE GESTIONE CASA</div>
      <table>
        <thead>
          <tr>
            <th>ID Spesa</th>
            <th>Categoria Spesa</th>
            <th>Categoria Personalizzata</th>
            <th>Data Spesa</th>
            <th>Costo / Importo Pagato (&euro;)</th>
            <th>Note Spesa</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Populate expenses
    expenses.forEach((exp) => {
      excelContent += `
        <tr>
          <td>${exp.id}</td>
          <td>${exp.category.toUpperCase()}</td>
          <td>${exp.customCategoryName || "-"}</td>
          <td class="text-center">${exp.date}</td>
          <td class="currency">${exp.amount.toFixed(2)}</td>
          <td>${exp.notes || "-"}</td>
        </tr>
      `;
    });

    excelContent += `
          <tr class="total-row">
            <td colspan="4" style="text-align: right;">TOTALE SPESE ACUMULATE:</td>
            <td class="currency">${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <br>
      <div class="title" style="font-size: 14px;">3. CONFIGURAZIONE RIPARTO CANALI (SETTINGS)</div>
      <table>
        <thead>
          <tr>
            <th>ID Canale</th>
            <th>Nome Visualizzato</th>
            <th>Tipologia</th>
            <th>Percentuale Commissione OTA (%)</th>
            <th>Fiscale IVA su Commissione (%)</th>
            <th>Quota Famiglia (%)</th>
            <th>Quota Co-host Agenzia (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>valnea (Default)</td>
            <td>Valnea</td>
            <td>GROSS (Lordo)</td>
            <td class="text-center">${settings.valneaPlatformCommissionPercentage}%</td>
            <td class="text-center">${settings.valneaPlatformCommissionTaxPercentage}%</td>
            <td class="text-center">${settings.valneaOwnerPercentage}%</td>
            <td class="text-center">${settings.valneaAgentPercentage}%</td>
          </tr>
    `;

    // Custom channels
    settings.channels?.forEach(chan => {
      excelContent += `
        <tr>
          <td>${chan.id}</td>
          <td>${chan.name}</td>
          <td>${chan.type.toUpperCase()}</td>
          <td class="text-center">${chan.commissionPercentage}%</td>
          <td class="text-center">${chan.commissionTaxPercentage}%</td>
          <td class="text-center">${chan.ownerPercentage}%</td>
          <td class="text-center">${chan.agentPercentage}%</td>
        </tr>
      `;
    });

    excelContent += `
        </tbody>
      </table>
    </body>
    </html>
    `;

    // Trigger download
    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rendiconto_completo_villa_druskovic_${selectedYear}.xls`;
    link.click();
  };

  // -------------------------------------------------------------
  // PRINT REPORTS CONTROLS
  // -------------------------------------------------------------
  const handlePrintReport = () => {
    // Open our visual print preview sheet overlay inside the app
    setShowPrintPreview(true);
    
    // Attempt standard browser print after state renders
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.warn("window.print() completed or blocked by iframe sandbox:", err);
      }
    }, 450);
  };

  // SVG parameters and scaling helpers
  const maxNightsValue = Math.max(...monthlyNights, 5);
  const maxRevenueValue = Math.max(...monthlyRevenue, 100);
  const maxExpensesValue = Math.max(...monthlyExpenses, 100);
  const maxCombinedValue = Math.max(...monthlyRevenue, ...monthlyExpenses, ...monthlyGrossRealized, 500);

  return (
    <div className="space-y-6">
      
      {/* 1. FILTER HEADER AND QUICK ACTIONS */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-3xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5.5 h-5.5 text-indigo-600" /> Rendiconto Finanziario & Budget
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Entrate, riparto commissioni co-host e registro spese per l'anno <strong className="text-indigo-700">{selectedYear}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Excel Export Button */}
          <button
            onClick={handleExportToExcel}
            className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Scarica tutti i dati immessi nel database dell'app in formato compatibile con Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Esporta Excel (.xls)
          </button>

          {/* Stampa Report Trigger */}
          <button
            onClick={handlePrintReport}
            className="flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Stampa Report PDF
          </button>
          
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Year selector */}
          <div className="flex items-center gap-1.5">
            <select
              id="select-stats-year-menu"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y} (Anno)</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. PRINT DESIGN PREVIEW MODULE - Delineates report options before hitting print */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/20 border border-slate-150 p-4.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs pr-6">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
            🖨️ Stampa Report Personalizzati
          </span>
          <p className="font-semibold text-slate-700">Configura la stampa del documento per l'analisi fisica dei flussi di mercato:</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto text-xs">
          {/* Period Selection */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Periodo di Analisi:</span>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
              <button
                onClick={() => setReportPeriod("month")}
                className={`px-3 py-1.5 font-bold transition-all border-r border-slate-100 cursor-pointer ${reportPeriod === "month" ? "bg-indigo-600 text-white" : "text-slate-650 hover:bg-slate-50"}`}
              >
                Mese ({monthLabelsAbbr[selectedMonth]})
              </button>
              <button
                onClick={() => setReportPeriod("year")}
                className={`px-3 py-1.5 font-bold transition-all border-r border-slate-100 cursor-pointer ${reportPeriod === "year" ? "bg-indigo-600 text-white" : "text-slate-650 hover:bg-slate-50"}`}
              >
                Anno ({selectedYear})
              </button>
              <button
                onClick={() => setReportPeriod("whole")}
                className={`px-3 py-1.5 font-bold transition-all cursor-pointer ${reportPeriod === "whole" ? "bg-indigo-600 text-white" : "text-slate-650 hover:bg-slate-50"}`}
              >
                Tutto l'Archivio
              </button>
            </div>
          </div>

          {/* Report layout */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Tipo Documento:</span>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
              <button
                onClick={() => setReportFormat("simple")}
                className={`px-3 py-1.5 font-bold transition-all border-r border-slate-100 cursor-pointer ${reportFormat === "simple" ? "bg-indigo-600 text-white" : "text-slate-650 hover:bg-slate-50"}`}
                title="Solo i kpi primari riassuntivi principali"
              >
                Semplice (Sintesi)
              </button>
              <button
                onClick={() => setReportFormat("detailed")}
                className={`px-3 py-1.5 font-bold transition-all cursor-pointer ${reportFormat === "detailed" ? "bg-indigo-600 text-white" : "text-slate-650 hover:bg-slate-50"}`}
                title="Spaccato analitico riga per riga"
              >
                Dettagliato (Completo)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CORE FINANCIAL SUMMARY METRICS cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="print-area-kpis">
        {/* GRAND TOTAL REVENUE */}
        <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 p-5 rounded-2xl shadow-3xs">
          <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> Lordo Totale Ricevuto
          </p>
          <p className="text-2xl font-black text-indigo-950 tracking-tight mt-1.5">
            €{grandTotalGrossYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
            Somma di tutti i pagamenti grezzi emessi dalle OTA prima dei riparti.
          </p>
        </div>

        {/* FAMILY NET EARNINGS */}
        <div className="bg-gradient-to-br from-emerald-50/40 to-white border border-emerald-100 p-5 rounded-2xl shadow-3xs">
          <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Incasso Lordo Famiglia
          </p>
          <p className="text-2xl font-black text-emerald-900 tracking-tight mt-1.5">
            €{grandTotalNetFamily.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
            Nostre entrate totali comprensive di servizi extra, scomputati commissioni e tasse.
          </p>
        </div>

        {/* OUTGOING EXPENSES */}
        <div className="bg-gradient-to-br from-rose-50/40 to-white border border-rose-100 p-5 rounded-2xl shadow-3xs">
          <p className="text-xs font-bold text-rose-700/80 uppercase flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Spese Casa Annuali
          </p>
          <p className="text-2xl font-black text-rose-950 tracking-tight mt-1.5">
            €{totalExpensesYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
            Accumulo bollette (luce, acqua), forniture e manutenzioni fatte.
          </p>
        </div>

        {/* FINAL YEARLY PROFIT (NET EARNINGS - OUTGOING EXPENSES) */}
        <div className={`p-5 rounded-2xl shadow-3xs border ${netProfitYear >= 0 ? "bg-gradient-to-br from-green-50/40 to-white border-green-200" : "bg-rose-50/20 border-rose-200"}`}>
          <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            💵 Guadagno Pulito (Utile)
          </p>
          <p className={`text-2xl font-black tracking-tight mt-1.5 ${netProfitYear >= 0 ? "text-green-800" : "text-rose-700"}`}>
            €{netProfitYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
            Ricavo netto in tasca reale per l'anno (Entrate Nette scomputate le Spese).
          </p>
        </div>
      </div>

      {/* 4. ADVANCED CHARTS PANEL (ANNUAL & MONTHLY RATIOS) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-6">
        
        {/* Chart header & Variables Selectors */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-sm uppercase text-slate-800 tracking-wide flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-indigo-600" /> 📊 Grafici Avanzati dell'Andamento Casa
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Sotto: monitora gli andamenti finanziari sia sull'asse mensile che sull'anno intero con filtri integrati.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            {/* Variable selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
              <button
                onClick={() => setChartVariable("revenue_vs_expenses")}
                className={`p-1.5 px-3 rounded-md transition-all cursor-pointer ${chartVariable === "revenue_vs_expenses" ? "bg-white text-slate-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"}`}
              >
                1. Ricavi Netti vs. Spese
              </button>
              <button
                onClick={() => setChartVariable("ratio_gross_net_exp")}
                className={`p-1.5 px-3 rounded-md transition-all cursor-pointer ${chartVariable === "ratio_gross_net_exp" ? "bg-white text-slate-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"}`}
              >
                2. Rapporto Rapportato col Lordo
              </button>
            </div>

            {/* Single month selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Mese per Focus:</span>
              <select
                id="select-chart-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-700 cursor-pointer"
              >
                {monthLabelsFull.map((lbl, idx) => (
                  <option key={idx} value={idx}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TWO GRAPHICS GRID: ANNUAL (LEFT) & SELECTED MONTH FOCUS (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* GRAPH A: ANNUAL VIEW (Span 7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-700 flex items-center gap-1">
                📅 Andamento Annuale {selectedYear}
                <span className="font-medium text-[11px] text-slate-400">(Suddiviso per Mesi)</span>
              </span>
              <div className="flex items-center gap-3 font-semibold text-[10px]">
                {chartVariable === "revenue_vs_expenses" ? (
                  <>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Ricavo Netto Famiglia</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Spese Totali</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-400 rounded-sm" /> Volume Lordo OTA</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Ricavo Netto Famiglia</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Spese</span>
                  </>
                )}
              </div>
            </div>

            {/* Pure SVG Side by side scale rendering */}
            <div className="h-60 border-l border-b border-slate-100 pb-2 pt-6 flex items-end justify-between relative gap-1 select-none pr-1">
              
              {/* Vertical Gridlines Helper (Absolute Y coords) */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[8px] font-mono text-slate-300 pb-8 pt-3">
                <div className="border-t border-slate-100 w-full text-right pr-1">Max: €{maxCombinedValue.toFixed(0)}</div>
                <div className="border-t border-slate-100/50 w-full"></div>
                <div className="border-t border-slate-100/50 w-full"></div>
                <div className="border-t border-slate-100/50 w-full"></div>
              </div>

              {/* Month Bars loops */}
              {monthLabelsAbbr.map((label, idx) => {
                const monthRev = monthlyRevenue[idx];
                const monthExp = monthlyExpenses[idx];
                const monthGr = monthlyGrossRealized[idx];

                // Scale percents
                const revPct = maxCombinedValue > 0 ? (monthRev / maxCombinedValue) * 85 : 0;
                const expPct = maxCombinedValue > 0 ? (monthExp / maxCombinedValue) * 85 : 0;
                const grPct = maxCombinedValue > 0 ? (monthGr / maxCombinedValue) * 85 : 0;

                const hasData = monthRev > 0 || monthExp > 0 || monthGr > 0;

                return (
                  <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center relative group">
                    
                    {/* Floating Detailed Hover Info tooltip */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-950 text-white p-2 rounded-lg text-[9px] font-bold z-40 transition-opacity duration-150 pointer-events-none shadow-md w-32 border border-slate-800 space-y-1">
                      <p className="font-extrabold text-indigo-300 border-b border-slate-800 pb-0.5">{monthLabelsFull[idx]}</p>
                      <p className="text-slate-300">Lordo: €{monthGr.toFixed(0)}</p>
                      <p className="text-emerald-400">Netto: €{monthRev.toFixed(0)}</p>
                      <p className="text-rose-400">Spese: €{monthExp.toFixed(0)}</p>
                    </div>

                    {/* Stacked bars depending on chart variable selected */}
                    <div className="w-full flex justify-center items-end gap-0.5 h-full pb-1">
                      {chartVariable === "revenue_vs_expenses" ? (
                        <>
                          {/* Family Net */}
                          <div 
                            className="w-1/2 bg-emerald-500 rounded-t-xs hover:bg-emerald-600 transition-colors"
                            style={{ height: `${Math.max(revPct, hasData ? 2 : 0)}%` }}
                          />
                          {/* Expenses */}
                          <div 
                            className="w-1/2 bg-rose-500 rounded-t-xs hover:bg-rose-600 transition-colors"
                            style={{ height: `${Math.max(expPct, hasData ? 2 : 0)}%` }}
                          />
                        </>
                      ) : (
                        <>
                          {/* Gross OTA */}
                          <div 
                            className="w-1/3 bg-indigo-400 rounded-t-xs opacity-75 hover:opacity-100 transition-opacity"
                            style={{ height: `${Math.max(grPct, hasData ? 2 : 0)}%` }}
                          />
                          {/* Family Net */}
                          <div 
                            className="w-1/3 bg-emerald-500 rounded-t-xs hover:bg-emerald-600"
                            style={{ height: `${Math.max(revPct, hasData ? 2 : 0)}%` }}
                          />
                          {/* Expenses */}
                          <div 
                            className="w-1/3 bg-rose-500 rounded-t-xs hover:bg-rose-600 shadow-3xs"
                            style={{ height: `${Math.max(expPct, hasData ? 2 : 0)}%` }}
                          />
                        </>
                      )}
                    </div>

                    {/* X-Axis Month label */}
                    <span className="text-[10px] text-slate-400 font-bold font-mono text-center pt-1 border-t border-slate-100 w-full shrink-0">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <p className="text-[10px] text-slate-400 italic text-left leading-normal pt-1">
              * Nota: Passa con il mouse sopra ciascun mese per vedere il dettaglio dei valori monetari totali (Lordo, Netto Famiglia, e Spese cumulative).
            </p>
          </div>

          {/* GRAPH B: SINGLE MONTH SELECT FOCUS (Span 5) */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            
            {/* Header statistics of Selected month */}
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-sm">
                Focus Mensile Selezionato
              </span>
              <h4 className="font-extrabold text-slate-800 text-sm">
                Rendimento Focus: {monthLabelsFull[selectedMonth]} {selectedYear}
              </h4>
            </div>

            {/* Absolute stats lines */}
            <div className="space-y-3 bg-white border border-slate-200 p-4.5 rounded-xl text-xs font-semibold">
              <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-100">
                <span>Volume Entrate Lorde (OTA):</span>
                <span className="font-bold text-slate-800">€{singleMonthGross.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-800 pb-1.5 border-b border-slate-100">
                <span>Incasso Netto Famiglia:</span>
                <span className="font-black text-emerald-700">€{singleMonthRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-rose-700 pb-1.5 border-b border-slate-100">
                <span>Spese Totali Sostenute:</span>
                <span className="font-bold text-rose-800">€{singleMonthExpenses.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg text-slate-950 font-black">
                <span>Utile Pulito Mensile:</span>
                <span className={singleMonthNetProfit >= 0 ? "text-indigo-800 font-black" : "text-rose-700 font-black"}>
                  €{singleMonthNetProfit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Graphic gauges - Efficiency indices */}
            <div className="space-y-2 text-[11px] font-medium leading-normal text-slate-650 pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-800 text-xs block">Indicatori di Efficienza:</span>
              
              {/* Ratio: Expenses representation on Net Family Earnings */}
              {singleMonthRevenue > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Costi/Spese su Entrate Nette:</span>
                    <span className="font-bold text-slate-800">{((singleMonthExpenses / singleMonthRevenue) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all" 
                      style={{ width: `${Math.min((singleMonthExpenses / singleMonthRevenue) * 100, 100)}%` }} 
                    />
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic">Efficienza calcolabile solo in presenza di entrate nette positive in questo mese.</div>
              )}

              {/* Net realization on Gross percentage */}
              {singleMonthGross > 0 && (
                <div className="space-y-1 pt-1.5">
                  <div className="flex justify-between">
                    <span>Velocità di conversione (Lordo a Netto):</span>
                    <span className="font-bold text-emerald-700">{((singleMonthRevenue / singleMonthGross) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all" 
                      style={{ width: `${Math.min((singleMonthRevenue / singleMonthGross) * 100, 100)}%` }} 
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* 5. CHANNEL BREAKDOWNS DETAILS TABLE AND TAX SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="print-area-breakdowns">
        
        {/* Dynamic Table for splits */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-8 space-y-4">
          <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" /> Analisi Dettagliata per Singolo Canale Sincronizzato
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-black tracking-wider uppercase">
                  <th className="py-2">Canale</th>
                  <th className="py-2 text-right">Volume...</th>
                  <th className="py-2 text-right">Comm. Portale</th>
                  <th className="py-2 text-right">Fondo Agenzia</th>
                  <th className="py-2 text-right">Imposta IVA Com.</th>
                  <th className="py-2 text-right text-indigo-600">Netto Famiglia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {Object.values(channelBreakdowns)
                  .filter(chan => chan.nights > 0 || chan.gross > 0)
                  .map((chan, idx) => {
                    const colorObj = channelColors[idx % channelColors.length];
                  return (
                    <tr key={chan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colorObj.dot}`} />
                        <span className="font-bold text-slate-800">{chan.name}</span>
                      </td>
                      <td className="py-3 text-right">€{chan.gross.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 text-right">
                        {chan.commissions > 0 ? (
                          <span className="text-red-650 font-semibold">-€{chan.commissions.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {chan.agentShare > 0 ? (
                          <span className="text-amber-700 font-semibold">-€{chan.agentShare.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {chan.taxes > 0 ? (
                          <span className="text-rose-600 font-semibold">-€{chan.taxes.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-black text-indigo-950 bg-indigo-50/20 px-1">
                        €{chan.ownerNet.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
                {/* Extras Services Summary Row */}
                <tr className="bg-emerald-50/10 font-bold border-t border-slate-200">
                  <td className="py-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-emerald-800">Servizi Extra & Incassi Cassa</span>
                  </td>
                  <td className="py-3 text-right">€{totalExtrasAllSources.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right text-slate-400">-</td>
                  <td className="py-3 text-right text-slate-400">-</td>
                  <td className="py-3 text-right text-slate-400">-</td>
                  <td className="py-3 text-right font-black text-emerald-800 bg-emerald-50/25 px-1">
                    €{totalExtrasAllSources.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Occupancy Stats Indicators */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-4 space-y-5">
          <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" /> Tasso di Occupazione {selectedYear}
          </h3>

          <div className="space-y-4">
            <div className="text-center bg-slate-50 py-4 rounded-xl">
              <span className="text-2xl font-extrabold text-slate-800">{currentYearReservations.length}</span>
              <p className="text-[10px] text-slate-500 tracking-wider uppercase font-bold">Prenotazioni Totali</p>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Notti Occupate Totali:</span>
                <span className="font-bold text-slate-800">{totalNights} notti</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((totalNights / 365) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 text-right font-bold">Occupazione annuale: {((totalNights / 365) * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

      </div>

      {/* 6. PHYSICAL PRINT LAYOUT CONTAINER - HIDDEN IN BROWSER UI, DYNAMICALLY RECONGIZED BY BROWSER ON PRINTER */}
      {/* Target of standard window.print() and styled specifically */}
      <div className="hidden print:block bg-white text-black p-10 font-sans absolute inset-0 space-y-8 text-sm" id="physical-printed-invoice">
        <div className="flex justify-between items-start border-b-2 border-slate-400 pb-5">
          <div>
            <h1 className="text-2xl font-black uppercase text-indigo-900 leading-none">VILLA DRUSKOVIC</h1>
            <p className="text-xs text-slate-650 font-semibold mt-1">Triban 8, Buje, Croazia - Registro Flussi di Cassa</p>
            <p className="text-[10px] text-slate-400">Esportato il: {new Date().toLocaleDateString("it-IT")}</p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-bold bg-slate-100 p-2 rounded-lg inline-block uppercase tracking-wide">
              {reportPeriod === "whole" ? "Report: Intero Periodo" : reportPeriod === "year" ? `Report: Anno ${selectedYear}` : `Report: Mese ${monthLabelsFull[selectedMonth]} ${selectedYear}`}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Formato: {reportFormat === "simple" ? "Sintetico" : "Dettagliato Riga per Riga"}</p>
          </div>
        </div>

        {/* PRINT STATISTICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Totale Volume Lordo (OTA)</span>
            <p className="text-lg font-extrabold text-slate-900">€{grandTotalGrossYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Incasso Famiglia Proprietaria</span>
            <p className="text-lg font-extrabold text-emerald-800">€{grandTotalNetFamily.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Costi e Spese Gestione Casa</span>
            <p className="text-lg font-extrabold text-rose-800">€{totalExpensesYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Utile Pulito Realizzato</span>
            <p className="text-lg font-black text-indigo-900">€{netProfitYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* IF DETAILED: PRINT LINE ITEMS */}
        {reportFormat === "detailed" && (
          <div className="space-y-6 pt-4">
            
            {/* Table of bookings inside print bounds */}
            <div className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wide border-b border-slate-300 pb-1">1. Lista Prenotazioni Corrispondenti</h2>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-400 font-bold text-slate-700 bg-slate-50">
                    <th className="p-2">Nome Ospite</th>
                    <th className="p-2">Nazionalità</th>
                    <th className="p-2">Check-in</th>
                    <th className="p-2">Check-out</th>
                    <th className="p-2 text-center">Notti</th>
                    <th className="p-2">Canale Fonte</th>
                    <th className="p-2 text-right">Lordo</th>
                    <th className="p-2 text-right">Netto Famiglia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentYearReservations.map((res) => {
                    const srcLower = res.source.toLowerCase();
                    const bookingGross = res.totalPrice;
                    let bookingOwnerNet = 0;
                    
                    const channelSettings = allConfiguredChannels.find(c => c.id.toLowerCase() === srcLower || c.name.toLowerCase() === srcLower) || {
                      type: srcLower === "valnea" ? "gross" : "net",
                      commissionPercentage: srcLower === "valnea" ? 15 : 0,
                      commissionTaxPercentage: srcLower === "valnea" ? 25 : 0,
                      ownerPercentage: srcLower === "valnea" ? 85 : 100,
                      agentPercentage: srcLower === "valnea" ? 15 : 0
                    };

                    if (channelSettings.type === "gross") {
                      const platformCommPct = res.valneaPlatformCommissionPercentage ?? channelSettings.commissionPercentage;
                      const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? channelSettings.commissionTaxPercentage;
                      const ownerPct = res.valneaOwnerPercentage ?? channelSettings.ownerPercentage;
                      const bookingComm = bookingGross * (platformCommPct / 100);
                      const remaining = bookingGross - bookingComm;
                      const bookingTax = bookingComm * (platformTaxPct / 100);
                      bookingOwnerNet = (remaining * (ownerPct / 100)) - bookingTax;
                    } else {
                      const ownerPct = channelSettings.ownerPercentage ?? 100;
                      bookingOwnerNet = bookingGross * (ownerPct / 100);
                    }

                    return (
                      <tr key={res.id}>
                        <td className="p-2 font-bold">{res.guestName} {res.guestSurname}</td>
                        <td className="p-2">{res.guestNationality || "N.D."}</td>
                        <td className="p-2 text-slate-600">{res.checkIn}</td>
                        <td className="p-2 text-slate-600">{res.checkOut}</td>
                        <td className="p-2 text-center">{res.nights}</td>
                        <td className="p-2 font-semibold text-indigo-700">{res.source}</td>
                        <td className="p-2 text-right font-mono">€{bookingGross.toFixed(0)}</td>
                        <td className="p-2 text-right font-black">€{bookingOwnerNet.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table of Expenses */}
            <div className="space-y-2 pt-4">
              <h2 className="text-xs font-black uppercase tracking-wide border-b border-slate-300 pb-1">2. Lista Spese della Casa</h2>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-400 font-bold text-slate-700 bg-slate-50">
                    <th className="p-2">Categoria Spesa</th>
                    <th className="p-2">Dettagli</th>
                    <th className="p-2">Data Registrata</th>
                    <th className="p-2 text-right">Costo / Importo Pagato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentYearExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="p-2 uppercase font-bold text-slate-800">{exp.category} {exp.customCategoryName ? `(${exp.customCategoryName})` : ""}</td>
                      <td className="p-2 text-slate-600 italic">"{exp.notes || "-"}"</td>
                      <td className="p-2 text-slate-600">{exp.date}</td>
                      <td className="p-2 text-right font-bold font-mono">-€{exp.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                    <td colspan="3" className="p-2 text-right">SOMMA SPESE GESTIONE:</td>
                    <td className="p-2 text-right font-black font-mono">-€{totalExpensesYear.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

        <div className="text-center text-[10px] text-slate-405 border-t border-slate-300 pt-10 select-none">
          Documento ufficiale digitale generato in automatico dal gestionale Villa Druskovic. Riservato per la Famiglia.
        </div>
      </div>

      {/* 7. PRINT PREVIEW MODAL - SHOWN WHEN showPrintPreview IS TRUE */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans print:hidden">
          <div className="relative w-full max-w-4xl bg-white shadow-2xl rounded-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal sticky top-bar */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0 z-20 rounded-t-2xl">
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-600 animate-pulse" /> Anteprima di Stampa & PDF
                </h3>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Controlla il report prima di confermare o scaricare</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    try {
                      window.focus();
                      window.print();
                    } catch (e) {
                      console.error("Print invocation failed:", e);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Stampa / PDF
                </button>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title="Chiudi anteprima"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Warning Info box about iframe sandboxing */}
            <div className="bg-amber-50/80 border-b border-amber-200 text-amber-900 p-4 text-xs font-semibold flex items-start gap-3 select-none">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">⚠️ Nota importante per l'uso dell'Anteprima di Google AI Studio</p>
                <p className="text-amber-700 font-medium leading-relaxed font-sans">
                  Il browser blocca l'avvio della stampa standard dall'anteprima embedded di AI Studio per ragioni di sicurezza. 
                  Se cliccando su <strong>"Stampa / PDF"</strong> non accade nulla, clicca sul tasto <strong>"Apri in una nuova scheda"</strong> (l'icona in alto a destra in alto nella finestra di AI Studio) per caricare l'app slegata dal frame protetto. Lì il pulsante di stampa funzionerà istantaneamente!
                </p>
              </div>
            </div>

            {/* Simulated Paper Sheets inside scroll container */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/70 border-b border-slate-200">
              
              {/* simulated paper container */}
              <div className="w-full max-w-3xl bg-white p-6 md:p-10 shadow-md border border-slate-250 min-h-[297mm] text-slate-800 mx-auto rounded-lg text-xs space-y-6">
                
                {/* Simulated Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-400 pb-5">
                  <div>
                    <h1 className="text-xl font-black uppercase text-indigo-900 leading-none tracking-tight">VILLA DRUSKOVIC</h1>
                    <p className="text-[11px] text-slate-650 font-semibold mt-1">Triban 8, Buje, Croazia - Registro Flussi di Cassa</p>
                    <p className="text-[10px] text-slate-400">Generato il: {new Date().toLocaleDateString("it-IT")} alle {new Date().toLocaleTimeString("it-IT", {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xs font-bold bg-slate-100 p-2 rounded-lg inline-block uppercase tracking-wide text-slate-700 border border-slate-200">
                      {reportPeriod === "whole" ? "Report: Intero Periodo" : reportPeriod === "year" ? `Report: Anno ${selectedYear}` : `Report: Mese ${monthLabelsFull[selectedMonth]} ${selectedYear}`}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">Formato: {reportFormat === "simple" ? "Sintetico" : "Dettagliato riga per riga"}</p>
                  </div>
                </div>

                {/* Print Statistics layout block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Volume Lordo (OTA)</span>
                    <p className="text-base font-extrabold text-slate-900">€{grandTotalGrossYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Incasso Proprietari</span>
                    <p className="text-base font-extrabold text-emerald-800">€{grandTotalNetFamily.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Costi & Spese Casa</span>
                    <p className="text-base font-extrabold text-rose-800">€{totalExpensesYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Utile Pulito</span>
                    <p className="text-base font-black text-indigo-900">€{netProfitYear.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Simulated bookings list */}
                {reportFormat === "detailed" ? (
                  <div className="space-y-6 pt-2">
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-black uppercase tracking-wider border-b border-slate-200 pb-1 text-slate-705 font-sans">1. Lista Prenotazioni del Periodo</h4>
                      {currentYearReservations.length === 0 ? (
                        <p className="text-slate-450 italic p-4 text-center">Nessuna prenotazione presente per i filtri impostati nel periodo selezionato.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] border-collapse min-w-[600px]">
                            <thead>
                              <tr className="border-b border-slate-350 font-bold text-slate-655 bg-slate-100/50">
                                <th className="p-1.5 font-sans">Ospite</th>
                                <th className="p-1.5 font-sans">Nazionalità</th>
                                <th className="p-1.5 font-sans">Check-in</th>
                                <th className="p-1.5 font-sans">Check-out</th>
                                <th className="p-1.5 text-center font-sans">Notti</th>
                                <th className="p-1.5 font-sans">Canale</th>
                                <th className="p-1.5 text-right font-semibold font-sans animate-none">Lordo</th>
                                <th className="p-1.5 text-right font-black font-sans">Netto Famiglia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {currentYearReservations.map((res) => {
                                const srcLower = res.source.toLowerCase();
                                const bookingGross = res.totalPrice;
                                let bookingOwnerNet = 0;
                                
                                const channelSettings = allConfiguredChannels.find(c => c.id.toLowerCase() === srcLower || c.name.toLowerCase() === srcLower) || {
                                  type: srcLower === "valnea" ? "gross" : "net",
                                  commissionPercentage: srcLower === "valnea" ? 15 : 0,
                                  commissionTaxPercentage: srcLower === "valnea" ? 25 : 0,
                                  ownerPercentage: srcLower === "valnea" ? 85 : 100,
                                  agentPercentage: srcLower === "valnea" ? 15 : 0
                                };

                                if (channelSettings.type === "gross") {
                                  const platformCommPct = res.valneaPlatformCommissionPercentage ?? channelSettings.commissionPercentage;
                                  const platformTaxPct = res.valneaPlatformCommissionTaxPercentage ?? channelSettings.commissionTaxPercentage;
                                  const ownerPct = res.valneaOwnerPercentage ?? channelSettings.ownerPercentage;
                                  const bookingComm = bookingGross * (platformCommPct / 100);
                                  const remaining = bookingGross - bookingComm;
                                  const bookingTax = bookingComm * (platformTaxPct / 100);
                                  bookingOwnerNet = (remaining * (ownerPct / 100)) - bookingTax;
                                } else {
                                  const ownerPct = channelSettings.ownerPercentage ?? 100;
                                  bookingOwnerNet = bookingGross * (ownerPct / 100);
                                }

                                return (
                                  <tr key={res.id}>
                                    <td className="p-1.5 font-bold text-slate-850 font-sans">{res.guestName} {res.guestSurname}</td>
                                    <td className="p-1.5 font-sans">{res.guestNationality || "N.D."}</td>
                                    <td className="p-1.5 text-slate-600 font-sans">{res.checkIn}</td>
                                    <td className="p-1.5 text-slate-600 font-sans">{res.checkOut}</td>
                                    <td className="p-1.5 text-center font-sans">{res.nights}</td>
                                    <td className="p-1.5 font-bold text-indigo-705 font-sans">{res.source}</td>
                                    <td className="p-1.5 text-right font-mono">€{bookingGross.toFixed(0)}</td>
                                    <td className="p-1.5 text-right font-black font-sans w-32 text-indigo-950">€{bookingOwnerNet.toFixed(0)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Expenses simulated listing */}
                    <div className="space-y-2 pt-4 font-sans">
                      <h4 className="text-[11px] font-black uppercase tracking-wider border-b border-slate-200 pb-1 text-slate-705 font-sans">2. Lista Spese della Casa</h4>
                      {currentYearExpenses.length === 0 ? (
                        <p className="text-slate-450 italic p-4 text-center">Nessuna spesa registrata nel periodo selezionato.</p>
                      ) : (
                        <table className="w-full text-left text-[10px] border-collapse font-sans">
                          <thead>
                            <tr className="border-b border-slate-355 font-bold text-slate-655 bg-slate-100/50">
                              <th className="p-1.5 font-sans">Categoria Spesa</th>
                              <th className="p-1.5 font-sans">Dettagli ed Informazioni</th>
                              <th className="p-1.5 font-sans">Data Registrata</th>
                              <th className="p-1.5 text-right font-semibold font-sans">Costo Pagato</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {currentYearExpenses.map((exp) => (
                              <tr key={exp.id}>
                                <td className="p-1.5 uppercase font-bold text-slate-800 font-sans">{exp.category} {exp.customCategoryName ? `(${exp.customCategoryName})` : ""}</td>
                                <td className="p-1.5 text-slate-605 italic font-sans">"{exp.notes || "-"}"</td>
                                <td className="p-1.5 text-slate-605 font-sans">{exp.date}</td>
                                <td className="p-1.5 text-right font-bold text-rose-700 font-mono">-€{exp.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-slate-250 font-bold bg-slate-50 text-slate-900 font-sans">
                              <td colSpan={3} className="p-1.5 text-right uppercase tracking-wide text-[9px] text-slate-500 font-bold font-sans">Somma spese gestione:</td>
                              <td className="p-1.5 text-right font-black font-mono text-rose-800">-€{totalExpensesYear.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 space-y-6 text-center max-w-md mx-auto print:font-sans">
                    <PieChart className="w-12 h-12 text-slate-350 mx-auto" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-slate-700">Formato del Report Semplificato</h4>
                      <p className="text-slate-500 leading-relaxed text-[11px] font-sans">
                        Questo documento presenta la sintesi dei flussi finanziari per l'immobile senza mostrare gli elenchi riga per riga. Ideale per rendicontazioni aggregate o per uso di controllo contabile generale di fine anno.
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-8 select-none">
                  Documento ufficiale digitale generato in automatico dal gestionale Villa Druskovic. Riservato per la Famiglia.
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowPrintPreview(false)}
                className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2 border border-slate-200 rounded-xl cursor-pointer shadow-3xs"
              >
                Chiudi Anteprima
              </button>
              <button
                onClick={() => {
                  try {
                    window.focus();
                    window.print();
                  } catch (e) {
                    console.error("Print invocation failed:", e);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Procedi alla Stampa / Salva PDF
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
