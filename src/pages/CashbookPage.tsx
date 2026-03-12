import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Search, Plus, Download, Star, CalendarIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

/* ─── helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const genCode = (type: "receipt" | "payment") => {
  const prefix = type === "receipt" ? "PT" : "PC";
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}${ts}`;
};

/* ─── types ─── */
type Slip = {
  id: string;
  code: string;
  type: string;
  amount: number;
  payment_method: string;
  target_type: string;
  target_id: string | null;
  reference_id: string | null;
  notes: string | null;
  is_checked: boolean;
  created_at: string;
};

type AuditFilter = "all" | "checked" | "unchecked";
type DocTypeFilter = "all" | "receipt" | "payment";
type FundFilter = "all" | "cash" | "bank" | "ewallet";

export default function CashbookPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ─── filter state ─── */
  const [search, setSearch] = useState("");
  const [fundFilter, setFundFilter] = useState<FundFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [docType, setDocType] = useState<DocTypeFilter>("all");
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ─── create slip dialog ─── */
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"receipt" | "payment">("receipt");
  const [newAmount, setNewAmount] = useState("");
  const [newMethod, setNewMethod] = useState("cash");
  const [newTargetType, setNewTargetType] = useState("other");
  const [newNotes, setNewNotes] = useState("");

  /* ─── data query ─── */
  const { data: slips = [], isLoading } = useQuery({
    queryKey: ["cashbook", fundFilter, docType, auditFilter, search, dateRange],
    queryFn: async () => {
      let q = supabase
        .from("payment_slips")
        .select("*")
        .order("created_at", { ascending: false });

      if (search.trim()) q = q.ilike("code", `%${search.trim()}%`);
      if (docType !== "all") q = q.eq("type", docType);
      if (fundFilter !== "all") {
        const methodMap: Record<string, string> = {
          cash: "cash", bank: "bank", ewallet: "ewallet",
        };
        q = q.eq("payment_method", methodMap[fundFilter]);
      }
      if (auditFilter === "checked") q = q.eq("is_checked", true);
      if (auditFilter === "unchecked") q = q.eq("is_checked", false);
      if (dateRange?.from) q = q.gte("created_at", dateRange.from.toISOString());
      if (dateRange?.to) {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Slip[];
    },
  });

  /* ─── summary ─── */
  const totalIn = slips.filter((s) => s.type === "receipt").reduce((a, s) => a + s.amount, 0);
  const totalOut = slips.filter((s) => s.type === "payment").reduce((a, s) => a + s.amount, 0);
  const openingBalance = 0; // placeholder – could be fetched from settings
  const closingBalance = openingBalance + totalIn - totalOut;

  /* ─── toggle audit ─── */
  const toggleChecked = useCallback(
    async (slip: Slip) => {
      const newVal = !slip.is_checked;
      const { error } = await supabase
        .from("payment_slips")
        .update({ is_checked: newVal } as any)
        .eq("id", slip.id);
      if (error) {
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
        return;
      }
      toast({
        title: newVal ? "Đã đánh dấu kiểm tra" : "Đã bỏ đánh dấu",
        description: `Phiếu ${slip.code}`,
      });
      qc.invalidateQueries({ queryKey: ["cashbook"] });
    },
    [toast, qc],
  );

  /* ─── create slip ─── */
  const handleCreate = async () => {
    const amount = parseFloat(newAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Vui lòng nhập số tiền hợp lệ", variant: "destructive" });
      return;
    }
    const code = genCode(createType);
    const { error } = await supabase.from("payment_slips").insert({
      code,
      type: createType,
      amount,
      payment_method: newMethod,
      target_type: newTargetType,
      notes: newNotes.trim() || null,
    });
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Tạo ${createType === "receipt" ? "phiếu thu" : "phiếu chi"} thành công`, description: code });
    qc.invalidateQueries({ queryKey: ["cashbook"] });
    setCreateOpen(false);
    setNewAmount("");
    setNewNotes("");
  };

  /* ─── bulk select ─── */
  const allSelected = slips.length > 0 && selectedIds.size === slips.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(slips.map((s) => s.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  /* ─── export CSV ─── */
  const handleExport = () => {
    if (slips.length === 0) return;
    const headers = ["Mã phiếu", "Thời gian", "Loại", "Phương thức", "Số tiền", "Ghi chú", "Đã kiểm tra"];
    const rows = slips.map((s) => [
      s.code,
      format(new Date(s.created_at), "dd/MM/yyyy HH:mm"),
      s.type === "receipt" ? "Thu" : "Chi",
      s.payment_method,
      s.amount,
      s.notes ?? "",
      s.is_checked ? "Có" : "Không",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `so-quy-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── TOP ACTION BAR ─── */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        <h1 className="text-xl font-bold shrink-0">Sổ quỹ</h1>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Theo mã phiếu"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            onClick={() => { setCreateType("receipt"); setCreateOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" /> Phiếu thu
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => { setCreateType("payment"); setCreateOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" /> Phiếu chi
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Xuất file
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT SIDEBAR FILTERS ─── */}
        <aside className="w-[250px] shrink-0 border-r overflow-y-auto p-4 space-y-6 bg-muted/30">
          {/* Quỹ tiền */}
          <FilterSection title="Quỹ tiền">
            <RadioGroup value={fundFilter} onValueChange={(v) => setFundFilter(v as FundFilter)}>
              {[
                ["all", "Tổng quỹ"],
                ["cash", "Tiền mặt"],
                ["bank", "Ngân hàng"],
                ["ewallet", "Ví điện tử"],
              ].map(([v, l]) => (
                <div className="flex items-center gap-2" key={v}>
                  <RadioGroupItem value={v} id={`fund-${v}`} />
                  <Label htmlFor={`fund-${v}`} className="text-sm cursor-pointer">{l}</Label>
                </div>
              ))}
            </RadioGroup>
          </FilterSection>

          {/* Thời gian */}
          <FilterSection title="Thời gian">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal text-sm h-8">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {dateRange?.from
                    ? dateRange.to
                      ? `${format(dateRange.from, "dd/MM")} – ${format(dateRange.to, "dd/MM")}`
                      : format(dateRange.from, "dd/MM/yyyy")
                    : "Chọn khoảng thời gian"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={vi} />
              </PopoverContent>
            </Popover>
            {dateRange && (
              <Button variant="ghost" size="sm" className="text-xs h-6 mt-1" onClick={() => setDateRange(undefined)}>
                Xóa bộ lọc
              </Button>
            )}
          </FilterSection>

          {/* Loại chứng từ */}
          <FilterSection title="Loại chứng từ">
            <RadioGroup value={docType} onValueChange={(v) => setDocType(v as DocTypeFilter)}>
              {[
                ["all", "Tất cả"],
                ["receipt", "Phiếu thu"],
                ["payment", "Phiếu chi"],
              ].map(([v, l]) => (
                <div className="flex items-center gap-2" key={v}>
                  <RadioGroupItem value={v} id={`doc-${v}`} />
                  <Label htmlFor={`doc-${v}`} className="text-sm cursor-pointer">{l}</Label>
                </div>
              ))}
            </RadioGroup>
          </FilterSection>

          {/* Đối soát */}
          <FilterSection title="Đối soát (Kiểm tra)">
            <RadioGroup value={auditFilter} onValueChange={(v) => setAuditFilter(v as AuditFilter)}>
              {[
                ["all", "Tất cả"],
                ["checked", "Đã kiểm tra"],
                ["unchecked", "Chưa kiểm tra"],
              ].map(([v, l]) => (
                <div className="flex items-center gap-2" key={v}>
                  <RadioGroupItem value={v} id={`audit-${v}`} />
                  <Label htmlFor={`audit-${v}`} className="text-sm cursor-pointer">{l}</Label>
                </div>
              ))}
            </RadioGroup>
          </FilterSection>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b">
            <SummaryCard label="Quỹ đầu kỳ" value={openingBalance} className="text-foreground" />
            <SummaryCard label="Tổng thu" value={totalIn} className="text-purple-600" />
            <SummaryCard label="Tổng chi" value={totalOut} className="text-destructive" />
            <SummaryCard label="Tồn quỹ" value={closingBalance} className="text-emerald-600" />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="w-10" />
                  <TableHead>Mã phiếu</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Loại thu chi</TableHead>
                  <TableHead>Người nộp/nhận</TableHead>
                  <TableHead className="text-right">Giá trị</TableHead>
                  <TableHead className="text-center w-24">Kiểm tra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : slips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Không có phiếu nào
                    </TableCell>
                  </TableRow>
                ) : (
                  slips.map((slip) => (
                    <TableRow
                      key={slip.id}
                      className={cn(
                        slip.is_checked && "bg-emerald-50/50 dark:bg-emerald-950/20",
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(slip.id)}
                          onCheckedChange={() => toggleOne(slip.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Star className="h-4 w-4 text-muted-foreground/40 hover:text-yellow-500 cursor-pointer" />
                      </TableCell>
                      <TableCell>
                        <span className="text-primary font-medium hover:underline cursor-pointer">
                          {slip.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(slip.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            slip.type === "receipt" ? "text-emerald-600" : "text-destructive",
                          )}
                        >
                          {slip.type === "receipt" ? "Phiếu thu" : "Phiếu chi"}
                        </span>
                        {slip.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{slip.notes}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {slip.target_type === "customer"
                          ? "Khách hàng"
                          : slip.target_type === "supplier"
                            ? "Nhà cung cấp"
                            : "Khác"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          slip.type === "receipt" ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        {slip.type === "receipt" ? "+" : "-"}{fmt(slip.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={slip.is_checked}
                          onCheckedChange={() => toggleChecked(slip)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>

      {/* ─── CREATE SLIP DIALOG ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createType === "receipt" ? "Tạo phiếu thu" : "Tạo phiếu chi"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Số tiền</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Phương thức</Label>
              <Select value={newMethod} onValueChange={setNewMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tiền mặt</SelectItem>
                  <SelectItem value="bank">Ngân hàng</SelectItem>
                  <SelectItem value="ewallet">Ví điện tử</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Đối tượng</Label>
              <Select value={newTargetType} onValueChange={setNewTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">Khác</SelectItem>
                  <SelectItem value="customer">Khách hàng</SelectItem>
                  <SelectItem value="supplier">Nhà cung cấp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea
                placeholder="Nội dung thu/chi..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", className)}>{fmt(value)}</p>
    </div>
  );
}
