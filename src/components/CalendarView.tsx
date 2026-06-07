import React from "react";
import { Reservation } from "../types";
import { ChevronLeft, ChevronRight, PlusCircle, Check, ArrowRight, Calendar } from "lucide-react";

interface CalendarViewProps {
  reservations: Reservation[];
  onSelectDateRange: (start: string, end: string) => void;
  onSelectReservation: (res: Reservation) => void;
  onAddReservationClick: () => void;
  currentDate: Date;
  onCurrentDateChange: (date: Date) => void;
}

export default function CalendarView({
  reservations,
  onSelectDateRange,
  onSelectReservation,
  onAddReservationClick,
  currentDate,
  onCurrentDateChange,
}: CalendarViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthsItalian = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const daysOfWeek = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];

  // Get number of days in the current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get weekday of the first day of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  // Convert standard JS (0=Sun) to target (0=Mon, 1=Tue, ..., 6=Sun)
  let firstDayIndex = new Date(year, month, 1).getDay();
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Navigate months
  const prevMonth = () => {
    onCurrentDateChange(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    onCurrentDateChange(new Date(year, month + 1, 1));
  };

  const formattedDateString = (dayNum: number): string => {
    const d = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    const m = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
    return `${year}-${m}-${d}`;
  };

  // Helper to check booking status for a specific date
  // Returns: { occupied: boolean, checkInRes?: Reservation, checkOutRes?: Reservation, fullRes?: Reservation }
  const getBookingForDate = (dateStr: string) => {
    const today = new Date(dateStr);
    let checkInRes: Reservation | undefined;
    let checkOutRes: Reservation | undefined;
    let fullRes: Reservation | undefined;

    for (const res of reservations) {
      if (res.status === "cancelled") continue;
      
      const inDate = new Date(res.checkIn);
      const outDate = new Date(res.checkOut);

      if (res.checkIn === dateStr) {
        checkInRes = res;
      } else if (res.checkOut === dateStr) {
        checkOutRes = res;
      } else if (today > inDate && today < outDate) {
        fullRes = res;
      }
    }

    return { checkInRes, checkOutRes, fullRes };
  };

  // Style mapper for color codes
  const getSourceStyles = (source: string, type: 'full' | 'in' | 'out') => {
    const srcLower = (source || "").toLowerCase();
    
    if (srcLower.startsWith("novasol")) {
      if (type === 'full') return "bg-emerald-500 hover:bg-emerald-600 text-white";
      if (type === 'in') return "bg-linear-to-r from-transparent to-emerald-500 hover:to-emerald-600 text-slate-850 font-semibold";
      return "bg-linear-to-r from-emerald-500 to-transparent hover:from-emerald-600 text-slate-850 font-semibold";
    }
    
    if (srcLower === "famiglia") {
      if (type === 'full') return "bg-amber-500 hover:bg-amber-600 text-white";
      if (type === 'in') return "bg-linear-to-r from-transparent to-amber-500 hover:to-amber-600 text-slate-855 font-semibold";
      return "bg-linear-to-r from-amber-500 to-transparent hover:from-amber-600 text-slate-855 font-semibold";
    }

    if (srcLower === "valnea") {
      if (type === 'full') return "bg-indigo-500 hover:bg-indigo-600 text-white";
      if (type === 'in') return "bg-linear-to-r from-transparent to-indigo-500 hover:to-indigo-600 text-slate-850 font-semibold";
      return "bg-linear-to-r from-indigo-500 to-transparent hover:from-indigo-600 text-slate-850 font-semibold";
    }

    // Default Purple/Violet color scheme for custom/additional channels
    if (type === 'full') return "bg-purple-500 hover:bg-purple-600 text-white";
    if (type === 'in') return "bg-linear-to-r from-transparent to-purple-500 hover:to-purple-600 text-slate-850 font-semibold";
    return "bg-linear-to-r from-purple-500 to-transparent hover:from-purple-600 text-slate-850 font-semibold";
  };

  const getDayDotColor = (source: string) => {
    const srcLower = (source || "").toLowerCase();
    if (srcLower === "valnea") return "bg-indigo-500 border border-white";
    if (srcLower.startsWith("novasol")) return "bg-emerald-500 border border-white";
    if (srcLower === "famiglia") return "bg-amber-500 border border-white";
    return "bg-purple-500 border border-white";
  };

  const renderDays = () => {
    const days: React.ReactNode[] = [];

    // Prepend empty cells for days of previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(
        <div 
          key={`empty-${i}`} 
          className="h-14 sm:h-20 bg-slate-50 border border-slate-100 opacity-40"
        />
      );
    }

    // Populate actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formattedDateString(day);
      const { checkInRes, checkOutRes, fullRes } = getBookingForDate(dateStr);

      let cellStyle = "bg-white hover:bg-slate-50";
      let cellContentClass = "text-slate-900";
      let isOccupied = false;
      let targetRes: Reservation | undefined;

      // Determine styling of cell (supporting transition checkout/check-in same day)
      if (fullRes) {
        cellStyle = getSourceStyles(fullRes.source, 'full');
        cellContentClass = "text-white font-semibold";
        isOccupied = true;
        targetRes = fullRes;
      } else if (checkInRes && checkOutRes) {
        // Special split day: Guest A checking out, Guest B checking in
        // We will make a dual split look
        isOccupied = true;
        targetRes = checkInRes; // Prefers the starting guest for detailed click, but user can see list
      } else if (checkInRes) {
        cellStyle = getSourceStyles(checkInRes.source, 'in');
        cellContentClass = "text-slate-900 font-semibold";
        isOccupied = true;
        targetRes = checkInRes;
      } else if (checkOutRes) {
        cellStyle = getSourceStyles(checkOutRes.source, 'out');
        cellContentClass = "text-slate-900 font-semibold";
        isOccupied = true;
        targetRes = checkOutRes;
      }

      const hasCombinedOverlap = checkInRes && checkOutRes;

      days.push(
        <div
          key={`day-${day}`}
          id={`day-cell-${dateStr}`}
          className={`h-14 sm:h-20 border border-slate-100 flex flex-col justify-between p-1.5 transition-all text-sm cursor-pointer relative overflow-hidden group select-none ${cellStyle}`}
          onClick={() => {
            if (targetRes) {
              onSelectReservation(targetRes);
            } else if (checkOutRes) {
              onSelectReservation(checkOutRes);
            } else {
              // Open form pre-registering check-in
              onSelectDateRange(dateStr, "");
            }
          }}
        >
          {/* Day Number */}
          <div className="flex justify-between items-center w-full z-10">
            <span className={`text-xs sm:text-sm rounded-full w-6 h-6 flex items-center justify-center ${
              fullRes ? "bg-black/10" : ""
            } ${cellContentClass}`}>
              {day}
            </span>

            {/* Source Mini Badge / Legend Indicator */}
            <div className="flex gap-1">
              {!fullRes && checkInRes && (
                <span className={`w-2.5 h-2.5 rounded-full ${getDayDotColor(checkInRes.source)}`} title="Arrivo" />
              )}
              {!fullRes && checkOutRes && (
                <span className={`w-2.5 h-2.5 rounded-full ${getDayDotColor(checkOutRes.source)}`} title="Partenza" />
              )}
            </div>
          </div>

          {/* Guest Name on larger screens */}
          {isOccupied && (
            <div className="hidden sm:block truncate text-[10px] mt-1 z-10 leading-tight">
              {hasCombinedOverlap ? (
                <div className="flex flex-col gap-0.5 text-[8px] leading-none">
                  <span className="text-purple-900 truncate font-semibold">↑ {checkInRes?.guestSurname}</span>
                  <span className="text-gray-600 truncate">↓ {checkOutRes?.guestSurname}</span>
                </div>
              ) : fullRes ? (
                <span className="font-medium opacity-95">{fullRes.guestName.charAt(0)}. {fullRes.guestSurname}</span>
              ) : checkInRes ? (
                <span className="text-slate-700 font-bold">In: {checkInRes?.guestSurname}</span>
              ) : checkOutRes ? (
                <span className="text-slate-500">Out: {checkOutRes?.guestSurname}</span>
              ) : null}
            </div>
          )}

          {/* Combined same-day transition illustration backdrop for mobile/desktop */}
          {hasCombinedOverlap && (
            <div className="absolute inset-0 flex pointer-events-none">
              <div className={`w-1/2 h-full ${getSourceStyles(checkOutRes.source, 'full')} opacity-40`} />
              <div className={`w-1/2 h-full ${getSourceStyles(checkInRes.source, 'full')} opacity-90`} />
            </div>
          )}

          {/* Hover highlight for completely empty days */}
          {!isOccupied && (
            <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/30 transition-colors flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                <PlusCircle className="w-3.5 h-3.5" /> Prenota
              </span>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const renderAnnualMonth = (monthIdx: number) => {
    const daysInAnnuoMonth = new Date(year, monthIdx + 1, 0).getDate();
    let firstDayAnnuoIndex = new Date(year, monthIdx, 1).getDay();
    firstDayAnnuoIndex = firstDayAnnuoIndex === 0 ? 6 : firstDayAnnuoIndex - 1;

    const daysEls = [];

    // Empty padding cells for previous days
    for (let i = 0; i < firstDayAnnuoIndex; i++) {
      daysEls.push(
        <div key={`annuo-empty-${monthIdx}-${i}`} className="w-5 h-4.5 bg-slate-50 border-[0.5px] border-slate-100 opacity-20" />
      );
    }

    // Actual days
    for (let dNum = 1; dNum <= daysInAnnuoMonth; dNum++) {
      const formattedD = dNum < 10 ? `0${dNum}` : `${dNum}`;
      const formattedM = (monthIdx + 1) < 10 ? `0${monthIdx + 1}` : `${monthIdx + 1}`;
      const dateStr = `${year}-${formattedM}-${formattedD}`;

      const { checkInRes, checkOutRes, fullRes } = getBookingForDate(dateStr);

      let cellColor = "bg-slate-50 border-[0.5px] border-slate-100/70 hover:bg-slate-150 text-slate-500 hover:text-slate-900";
      let isReserved = false;
      let targetRes: Reservation | undefined;

      if (fullRes) {
        cellColor = getSourceStyles(fullRes.source, 'full');
        isReserved = true;
        targetRes = fullRes;
      } else if (checkInRes && checkOutRes) {
        cellColor = getSourceStyles(checkInRes.source, 'full');
        isReserved = true;
        targetRes = checkInRes;
      } else if (checkInRes) {
        cellColor = getSourceStyles(checkInRes.source, 'in');
        isReserved = true;
        targetRes = checkInRes;
      } else if (checkOutRes) {
        cellColor = getSourceStyles(checkOutRes.source, 'out');
        isReserved = true;
        targetRes = checkOutRes;
      }

      const titleText = isReserved && targetRes
        ? `${dNum} ${monthsItalian[monthIdx]}: ${targetRes.guestName} ${targetRes.guestSurname} (${targetRes.source})`
        : `${dNum} ${monthsItalian[monthIdx]} (Disponibile)`;

      daysEls.push(
        <div
          key={`annuo-day-${monthIdx}-${dNum}`}
          title={titleText}
          onClick={() => {
            // Open monthly calendar to clicked month/year
            onCurrentDateChange(new Date(year, monthIdx, 1));
            
            // If reserved, update guest stay detail
            if (targetRes) {
              onSelectReservation(targetRes);
            } else if (checkOutRes) {
              onSelectReservation(checkOutRes);
            }
          }}
          className={`w-5 h-4.5 border-[0.5px] border-slate-100/75 flex items-center justify-center text-[7.5px] font-bold cursor-pointer rounded-xs transition-all hover:scale-110 shadow-3xs ${cellColor}`}
        >
          {dNum}
        </div>
      );
    }

    return (
      <div key={monthIdx} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center">
        <span className="text-[10px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{monthsItalian[monthIdx]}</span>
        
        {/* Month Days Week Header */}
        <div className="grid grid-cols-7 gap-[2px] text-center mb-1">
          {["L", "M", "M", "G", "V", "S", "D"].map((w, idx) => (
            <span key={idx} className="w-5 text-[7px] font-semibold text-slate-400 select-none">{w}</span>
          ))}
        </div>

        {/* Month Days Grid */}
        <div className="grid grid-cols-7 gap-[2px]">
          {daysEls}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Monthly Calendar Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Calendar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <select
                id="select-calendar-month"
                value={month}
                onChange={(e) => onCurrentDateChange(new Date(year, parseInt(e.target.value), 1))}
                className="text-sm font-bold border border-slate-250 bg-white rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
              >
                {monthsItalian.map((mObj, idx) => (
                  <option key={idx} value={idx}>{mObj}</option>
                ))}
              </select>

              <select
                id="select-calendar-year"
                value={year}
                onChange={(e) => onCurrentDateChange(new Date(parseInt(e.target.value), month, 1))}
                className="text-sm font-bold border border-slate-250 bg-white rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
              >
                {Array.from({ length: 2100 - 2022 + 1 }, (_, i) => 2022 + i).map((yVal) => (
                  <option key={yVal} value={yVal}>{yVal}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1.5 items-center text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-3xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Famiglia
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-3xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Novasol CLS574
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 shadow-3xs">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                Valnea
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              id="btn-prev-month"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <button
              id="btn-today"
              onClick={() => onCurrentDateChange(new Date())}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Oggi
            </button>

            <button
              id="btn-next-month"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekdays Grid */}
        <div className="grid grid-cols-7 text-center bg-slate-50/50 border-b border-slate-100 py-2">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 duration-150">
          {renderDays()}
        </div>

        {/* Tip Banner */}
        <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <p>💡 Clicca su una cella vuota per inserire una nuova riservazione, o su una prenotata per gestirla.</p>
          <button
            onClick={onAddReservationClick}
            className="text-indigo-600 font-bold hover:text-indigo-800 hover:underline transition-all flex items-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> Nuova prenotazione
          </button>
        </div>
      </div>

      {/* Annual Calendar Tracker Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-slate-950 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" /> Calendario Annuale {year}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Panoramica completa dell'anno. Clicca su un giorno colorato per aprire il soggiorno corrispondente e aggiornare il pannello sopra.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onCurrentDateChange(new Date(year - 1, month, 1))}
              className="p-1 px-2.5 text-[11px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-3xs cursor-pointer"
            >
              « {year - 1}
            </button>
            <button
              onClick={() => onCurrentDateChange(new Date(year + 1, month, 1))}
              className="p-1 px-2.5 text-[11px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-3xs cursor-pointer"
            >
              {year + 1} »
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, mIdx) => renderAnnualMonth(mIdx))}
        </div>
      </div>
    </div>
  );
}

