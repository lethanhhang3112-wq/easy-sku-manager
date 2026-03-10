import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type EntityType = "product" | "invoice" | "import" | "customer" | "supplier";

const ROUTE_MAP: Record<EntityType, { path: string; param: string }> = {
  product: { path: "/products", param: "productId" },
  invoice: { path: "/sales", param: "invoiceId" },
  import: { path: "/imports", param: "importId" },
  customer: { path: "/customers", param: "customerId" },
  supplier: { path: "/suppliers", param: "supplierId" },
};

interface EntityLinkProps {
  type: EntityType;
  id: string;
  code: string;
  className?: string;
}

export const EntityLink = ({ type, id, code, className }: EntityLinkProps) => {
  const navigate = useNavigate();
  const { path, param } = ROUTE_MAP[type];

  return (
    <span
      className={cn(
        "text-primary hover:underline cursor-pointer font-medium",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`${path}?${param}=${id}`);
      }}
    >
      {code}
    </span>
  );
};
