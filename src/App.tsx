import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import SalesPage from "./pages/SalesPage";
import SalesPOSPage from "./pages/SalesPOSPage";
import ImportsPage from "./pages/ImportsPage";
import CreateImportPage from "./pages/CreateImportPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import SuppliersPage from "./pages/SuppliersPage";
import CustomersPage from "./pages/CustomersPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import CashbookPage from "./pages/CashbookPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/sales/new" element={<SalesPOSPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/imports/create" element={<CreateImportPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/cashbook" element={<CashbookPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
