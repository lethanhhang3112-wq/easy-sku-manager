import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { formatCurrency } from "@/components/CurrencyInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProductResult = {
  id: string;
  code: string;
  name: string;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
};

interface ProductSearchDropdownProps {
  onSelect: (product: ProductResult) => void;
  excludeIds?: string[];
  placeholder?: string;
  /** Which price to display: cost_price or sale_price */
  displayPrice?: "cost_price" | "sale_price";
  /** Show stock filter (only show in-stock items) */
  onlyInStock?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export interface ProductSearchDropdownRef {
  focus: () => void;
}

export const ProductSearchDropdown = forwardRef<ProductSearchDropdownRef, ProductSearchDropdownProps>(({
  onSelect,
  excludeIds = [],
  placeholder = "Tìm hàng hóa theo tên, mã hàng (F3)...",
  displayPrice = "sale_price",
  onlyInStock = false,
  className,
  autoFocus = false,
}, ref) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedTerm = useDebounce(searchTerm, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["product-search", debouncedTerm],
    queryFn: async () => {
      if (!debouncedTerm.trim()) return [];
      const term = `%${debouncedTerm.trim()}%`;
      let query = supabase
        .from("products")
        .select("id, code, name, cost_price, sale_price, stock_quantity")
        .or(`name.ilike.${term},code.ilike.${term}`)
        .order("name")
        .limit(10);

      if (onlyInStock) {
        query = query.gt("stock_quantity", 0);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as ProductResult[]).filter((p) => !excludeIds.includes(p.id));
    },
    enabled: debouncedTerm.trim().length > 0,
    staleTime: 10_000,
  });

  const handleSelect = (product: ProductResult) => {
    onSelect(product);
    setSearchTerm("");
    setIsOpen(false);
  };

  const showDropdown = isOpen && searchTerm.trim().length > 0;

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      )}
      <Input
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="pl-10 h-9"
        autoFocus={autoFocus}
        ref={inputRef}
      />
      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-popover shadow-lg max-h-64 overflow-y-auto">
          {isFetching && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang tìm...
            </div>
          ) : !isFetching && results.length === 0 && debouncedTerm.trim().length > 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Không tìm thấy hàng hóa
            </div>
          ) : (
            results.map((p) => {
              const outOfStock = p.stock_quantity <= 0;
              return (
                <button
                  key={p.id}
                  className={cn(
                    "w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm border-b last:border-b-0 transition-colors",
                    outOfStock
                      ? "opacity-50 cursor-not-allowed bg-muted/30"
                      : "hover:bg-accent"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (outOfStock) {
                      toast.error("Sản phẩm này đã hết hàng!", { description: p.name });
                      return;
                    }
                    handleSelect(p);
                  }}
                >
                  <span className="font-mono text-muted-foreground w-20 shrink-0">{p.code}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className={cn(
                    "text-xs",
                    outOfStock ? "text-destructive font-medium" : "text-muted-foreground"
                  )}>
                    Tồn: {p.stock_quantity}
                  </span>
                  <span className="font-medium text-primary w-28 text-right">
                    {formatCurrency(p[displayPrice])}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

ProductSearchDropdown.displayName = "ProductSearchDropdown";
