import { useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
} from "date-fns";

export type FilterState = {
  searchQuery: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  quickFilter: string;
};

const QUICK_FILTERS: { value: string; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "this_week", label: "Tuần này" },
  { value: "this_month", label: "Tháng này" },
  { value: "this_quarter", label: "Quý này" },
  { value: "this_year", label: "Năm nay" },
];

function getQuickFilterDates(value: string): { start: Date; end: Date } {
  const now = new Date();
  switch (value) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "this_quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "this_year":
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

interface ImportFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const ImportFilterBar = ({ filters, onFiltersChange }: ImportFilterBarProps) => {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const update = (partial: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const handleQuickFilter = (value: string) => {
    const { start, end } = getQuickFilterDates(value);
    onFiltersChange({ ...filters, quickFilter: value, startDate: start, endDate: end });
  };

  const clearFilters = () => {
    onFiltersChange({ searchQuery: "", startDate: undefined, endDate: undefined, quickFilter: "" });
  };

  const hasFilters = filters.searchQuery || filters.startDate || filters.endDate || filters.quickFilter;

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-end flex-wrap">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm mã phiếu, SP hoặc NCC..."
          value={filters.searchQuery}
          onChange={(e) => update({ searchQuery: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Start Date */}
      <Popover open={startOpen} onOpenChange={setStartOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !filters.startDate && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.startDate ? format(filters.startDate, "dd/MM/yyyy") : "Từ ngày"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.startDate}
            onSelect={(d) => { update({ startDate: d || undefined, quickFilter: "" }); setStartOpen(false); }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* End Date */}
      <Popover open={endOpen} onOpenChange={setEndOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !filters.endDate && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.endDate ? format(filters.endDate, "dd/MM/yyyy") : "Đến ngày"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.endDate}
            onSelect={(d) => { update({ endDate: d || undefined, quickFilter: "" }); setEndOpen(false); }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Quick Filter */}
      <Select value={filters.quickFilter} onValueChange={handleQuickFilter}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Lọc nhanh" />
        </SelectTrigger>
        <SelectContent>
          {QUICK_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
          <X className="mr-1 h-4 w-4" /> Xóa bộ lọc
        </Button>
      )}
    </div>
  );
};

export default ImportFilterBar;
