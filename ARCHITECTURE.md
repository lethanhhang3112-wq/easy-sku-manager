# 🏗️ ARCHITECTURE.md — Kiến trúc hệ thống KiotPOS

> Tài liệu kỹ thuật tổng quan dành cho lập trình viên tham gia phát triển hệ thống **Quản lý Bán hàng & Kho vận (POS & Inventory Management)**.

---

## 📑 Mục lục

1. [Tổng quan hệ thống](#1--tổng-quan-hệ-thống)
2. [Tính năng cốt lõi](#2--tính-năng-cốt-lõi-core-features)
3. [Tech Stack & Cơ sở dữ liệu](#3--tech-stack--cơ-sở-dữ-liệu)
4. [Kiến trúc giao tiếp & Giao thức](#4--kiến-trúc-giao-tiếp--giao-thức-api)
5. [Cấu trúc thư mục mã nguồn](#5--cấu-trúc-thư-mục-mã-nguồn)
6. [Database Schema](#6--database-schema)
7. [Quy ước phát triển](#7--quy-ước-phát-triển)

---

## 1. 🎯 Tổng quan hệ thống

KiotPOS là ứng dụng web quản lý bán hàng và kho vận lấy cảm hứng từ **KiotViet**, được xây dựng hoàn toàn bằng **React** (SPA) với backend là **Supabase** (PostgreSQL). Hệ thống hướng tới môi trường bán lẻ nhỏ và vừa, hỗ trợ:

- Bán hàng tại quầy (POS) với quét mã vạch
- Quản lý sản phẩm, tồn kho, nhập hàng
- Quản lý khách hàng, nhà cung cấp
- In hóa đơn, in tem mã vạch
- Báo cáo doanh thu

**Kiến trúc tổng thể:**

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                  │
│                                                     │
│   React + Vite + Tailwind CSS + shadcn/ui           │
│   └── TanStack Query (state & cache management)     │
│   └── React Router (client-side routing)            │
└─────────────┬───────────────────────┬───────────────┘
              │ HTTPS (REST)          │ WSS (Realtime)
              ▼                       ▼
┌─────────────────────────────────────────────────────┐
│                 SUPABASE PLATFORM                   │
│                                                     │
│   ┌─────────────┐  ┌──────────┐  ┌──────────────┐  │
│   │  PostgREST   │  │ Realtime │  │Edge Functions│  │
│   │  (REST API)  │  │  (WSS)   │  │  (Deno)      │  │
│   └──────┬───────┘  └────┬─────┘  └──────┬───────┘  │
│          └───────┬───────┘───────────────┘           │
│                  ▼                                   │
│        ┌──────────────────┐                          │
│        │   PostgreSQL DB  │                          │
│        │   + RLS Policies │                          │
│        └──────────────────┘                          │
└─────────────────────────────────────────────────────┘
```

---

## 2. 🧩 Tính năng cốt lõi (Core Features)

| Module | Mô tả | Trang |
|---|---|---|
| **📊 Tổng quan (Dashboard)** | Thống kê nhanh doanh thu, tồn kho, đơn hàng gần đây | `Index.tsx` |
| **🛒 Bán hàng POS** | Giao diện POS toàn màn hình, quét barcode, tìm sản phẩm, thanh toán | `SalesPOSPage.tsx` |
| **📋 Hóa đơn bán hàng** | Danh sách đơn bán, xem chi tiết inline (expandable row), hủy đơn, sao chép, xuất file | `SalesPage.tsx` |
| **📦 Hàng hóa (Products)** | CRUD sản phẩm, lọc theo danh mục/trạng thái, xuất Excel, in tem mã vạch hàng loạt | `ProductsPage.tsx` |
| **🏷️ Nhóm sản phẩm** | Quản lý danh mục sản phẩm | `CategoriesPage.tsx` |
| **📥 Nhập hàng (Imports)** | Tạo phiếu nhập, chọn NCC, tự động cập nhật tồn kho và giá vốn | `ImportsPage.tsx`, `CreateImportPage.tsx` |
| **👥 Khách hàng** | Quản lý thông tin khách hàng, nhóm khách hàng | `CustomersPage.tsx` |
| **🏭 Nhà cung cấp** | Quản lý nhà cung cấp với thông tin liên hệ, mã số thuế | `SuppliersPage.tsx` |
| **📊 Báo cáo** | Báo cáo doanh thu, biểu đồ | `ReportsPage.tsx` |
| **⚙️ Cài đặt** | Thông tin cửa hàng, mẫu in hóa đơn | `SettingsPage.tsx` |
| **🔖 In tem mã vạch** | Hỗ trợ nhiều layout giấy (A4, cuộn, Xprinter 350BM), xem trước và in | `BarcodePrintModal.tsx` |
| **📊 Sổ kho (Stock Ledger)** | Lịch sử xuất nhập tồn theo sản phẩm, điều chỉnh tồn kho | `StockLedgerTab.tsx` |

---

## 3. ⚙️ Tech Stack & Cơ sở dữ liệu

### Frontend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| **React** | 18.3 | UI library (SPA) |
| **Vite** | 5.x | Build tool & dev server |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **shadcn/ui** | Latest | Component library (Radix UI primitives) |
| **Lucide React** | 0.462 | Icon library |
| **TanStack Query** | 5.x | Server state management, caching, refetching |
| **React Router** | 6.x | Client-side routing |
| **React Hook Form** | 7.x | Form state management |
| **Zod** | 3.x | Schema validation |
| **Recharts** | 2.x | Biểu đồ/chart |
| **react-barcode** | 1.6 | Render mã vạch |
| **react-zxing** | 2.1 | Quét mã vạch qua camera |
| **xlsx** | 0.18 | Xuất/nhập file Excel |
| **date-fns** | 3.x | Format và xử lý ngày tháng |

### Backend & Database

| Công nghệ | Vai trò |
|---|---|
| **Supabase** | Backend-as-a-Service (BaaS) |
| **PostgreSQL** | Cơ sở dữ liệu quan hệ (hosted bởi Supabase) |
| **PostgREST** | Tự động tạo RESTful API từ schema PostgreSQL |
| **Row Level Security (RLS)** | Bảo mật dữ liệu ở tầng database |
| **Database Functions (PL/pgSQL)** | Logic phức tạp chạy trên server (VD: tìm kiếm không dấu) |
| **Edge Functions (Deno)** | Serverless functions cho logic backend tùy chỉnh |

### Design System

Dự án sử dụng **semantic design tokens** qua CSS custom properties (HSL) được khai báo trong `src/index.css` và ánh xạ trong `tailwind.config.ts`. Tất cả màu sắc trong component **phải** dùng token (`bg-primary`, `text-muted-foreground`...) thay vì hardcode giá trị.

---

## 4. 🔌 Kiến trúc giao tiếp & Giao thức (API)

### 4.1 Supabase Client

Frontend giao tiếp với database thông qua thư viện **`@supabase/supabase-js`**, được khởi tạo tại:

```
src/integrations/supabase/client.ts
```

```typescript
import { supabase } from "@/integrations/supabase/client";
```

> ⚠️ File này được **tự động tạo** — không chỉnh sửa thủ công.

### 4.2 Giao thức truyền tải

```
┌──────────────────┐     HTTPS (REST)      ┌──────────────┐
│  React Frontend  │ ───────────────────▶   │  PostgREST   │
│  (supabase-js)   │                        │  (Supabase)  │
│                  │ ◀─────────────────── │              │
│                  │     JSON Response      │              │
└──────────────────┘                        └──────────────┘
```

| Giao thức | Sử dụng cho | Ví dụ |
|---|---|---|
| **REST over HTTPS** | Tất cả CRUD operations | `supabase.from('products').select()` |
| **WebSocket (WSS)** | Realtime subscriptions (nếu bật) | `supabase.channel('...').on('postgres_changes', ...)` |
| **RPC (Remote Procedure Call)** | Gọi database functions | `supabase.rpc('search_products_unaccented', { search_term })` |

### 4.3 REST API (PostgREST)

Supabase tự động tạo RESTful endpoints cho mỗi bảng trong schema `public`. Thư viện `supabase-js` đóng vai trò là **SDK client** che giấu HTTP calls bên dưới:

```typescript
// SDK call (developer viết)
const { data } = await supabase
  .from('products')
  .select('*, categories(name)')
  .eq('status', 'active')
  .order('created_at', { ascending: false });

// Tương đương HTTP request bên dưới (PostgREST tự xử lý)
// GET /rest/v1/products?select=*,categories(name)&status=eq.active&order=created_at.desc
```

### 4.4 RPC — Database Functions

Các truy vấn phức tạp được đóng gói thành **PostgreSQL functions** và gọi qua RPC:

```typescript
// Tìm kiếm sản phẩm không dấu tiếng Việt
const { data } = await supabase.rpc('search_products_unaccented', {
  search_term: 'ca phe'
});
```

**Danh sách functions hiện có:**

| Function | Mô tả |
|---|---|
| `search_products_unaccented(search_term)` | Tìm sản phẩm theo tên/mã, bỏ qua dấu tiếng Việt |
| `unaccent(text)` | Hàm helper loại bỏ dấu tiếng Việt |

### 4.5 Server State Management

**TanStack Query** quản lý toàn bộ vòng đời dữ liệu từ server:

```
User Action → useQuery/useMutation → supabase-js → PostgREST → PostgreSQL
                                                        ↓
UI Update  ← Cache Invalidation  ← onSuccess callback ←┘
```

- **`useQuery`**: Fetch & cache dữ liệu, tự động refetch khi stale
- **`useMutation`**: Thực hiện INSERT/UPDATE/DELETE, invalidate cache sau khi thành công
- **Query Keys**: Dùng để quản lý cache (VD: `['products']`, `['sales-orders']`)

---

## 5. 📂 Cấu trúc thư mục mã nguồn

```
src/
├── components/                    # React components
│   ├── ui/                        # shadcn/ui primitives (Button, Dialog, Table...)
│   │                              # ⚠️ Không chỉnh sửa trực tiếp, dùng variants
│   ├── shared/                    # Components dùng chung giữa nhiều module
│   │   └── BarcodePrintModal.tsx  #   Modal in tem mã vạch (multi-layout)
│   ├── sales/                     # Components riêng cho module Bán hàng
│   │   └── SalesOrderDetailRow.tsx#   Inline expanded row chi tiết hóa đơn
│   ├── AppLayout.tsx              # Layout chính (Sidebar + Header + Content)
│   ├── AppSidebar.tsx             # Navigation sidebar
│   ├── AddProductModal.tsx        # Dialog thêm/sửa sản phẩm
│   ├── BarcodeScannerDialog.tsx   # Dialog quét mã vạch qua camera
│   ├── CurrencyInput.tsx          # Input tiền tệ + helper formatCurrency()
│   ├── ImportFilterBar.tsx        # Thanh lọc cho trang Nhập hàng
│   ├── NavLink.tsx                # Link navigation có active state
│   ├── ProductSearchDropdown.tsx  # Dropdown tìm kiếm sản phẩm (debounced)
│   ├── StockAdjustmentModal.tsx   # Dialog điều chỉnh tồn kho
│   ├── StockLedgerSheet.tsx       # Sheet xem sổ kho
│   └── StockLedgerTab.tsx         # Tab sổ kho trong trang sản phẩm
│
├── hooks/                         # Custom React hooks
│   ├── use-debounce.ts            #   Debounce giá trị (cho search input)
│   ├── use-mobile.tsx             #   Detect responsive breakpoint
│   └── use-toast.ts               #   Toast notification hook
│
├── integrations/
│   └── supabase/
│       ├── client.ts              # Supabase client instance (⚠️ TỰ ĐỘNG TẠO)
│       └── types.ts               # TypeScript types từ DB schema (⚠️ TỰ ĐỘNG TẠO)
│
├── lib/
│   └── utils.ts                   # Hàm tiện ích (cn() cho Tailwind merge)
│
├── pages/                         # Page components (mỗi file = 1 route)
│   ├── Index.tsx                  #   / — Dashboard
│   ├── SalesPOSPage.tsx           #   /pos — Giao diện POS
│   ├── SalesPage.tsx              #   /sales — Danh sách hóa đơn bán
│   ├── ProductsPage.tsx           #   /products — Quản lý sản phẩm
│   ├── CategoriesPage.tsx         #   /categories — Nhóm sản phẩm
│   ├── ImportsPage.tsx            #   /imports — Danh sách phiếu nhập
│   ├── CreateImportPage.tsx       #   /imports/create — Tạo phiếu nhập mới
│   ├── CustomersPage.tsx          #   /customers — Quản lý khách hàng
│   ├── SuppliersPage.tsx          #   /suppliers — Quản lý NCC
│   ├── ReportsPage.tsx            #   /reports — Báo cáo
│   ├── SettingsPage.tsx           #   /settings — Cài đặt cửa hàng
│   └── NotFound.tsx               #   404 page
│
├── test/                          # Test files
│   ├── setup.ts                   #   Vitest setup
│   └── example.test.ts            #   Example test
│
├── App.tsx                        # Router configuration
├── main.tsx                       # Entry point (React root)
├── index.css                      # Global styles & design tokens
└── vite-env.d.ts                  # Vite type declarations
```

### Thư mục gốc quan trọng

```
├── supabase/
│   ├── config.toml                # Cấu hình Supabase (⚠️ TỰ ĐỘNG TẠO)
│   └── migrations/                # SQL migration files (theo thứ tự timestamp)
├── public/                        # Static assets
├── tailwind.config.ts             # Tailwind configuration & design tokens
├── vite.config.ts                 # Vite build configuration
├── LOCAL_SETUP_GUIDE.md           # Hướng dẫn cài đặt local
└── ARCHITECTURE.md                # Tài liệu này
```

---

## 6. 🗄️ Database Schema

### Entity Relationship Diagram (ERD)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  categories  │       │     products     │       │  suppliers   │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │◄──┐   │ id (PK)          │   ┌──▶│ id (PK)      │
│ name         │   └───│ category_id (FK) │   │   │ name         │
│ description  │       │ code (unique)    │   │   │ code         │
└──────────────┘       │ name             │   │   │ company      │
                       │ cost_price       │   │   │ phone, email │
                       │ sale_price       │   │   │ address      │
                       │ stock_quantity   │   │   │ tax_code     │
                       │ status           │   │   │ status       │
                       └────────┬─────────┘   │   └──────────────┘
                                │             │
              ┌─────────────────┼─────────────┘
              │                 │
┌─────────────┴──┐   ┌─────────┴────────┐   ┌──────────────────┐
│ import_orders  │   │ import_order_items│   │  payment_slips   │
├────────────────┤   ├──────────────────┤   ├──────────────────┤
│ id (PK)        │◄──│ import_order_id   │   │ id (PK)          │
│ code           │   │ product_id (FK)  │   │ import_order_id  │
│ supplier_id(FK)│   │ quantity         │   │ code             │
│ total_amount   │   │ unit_cost        │   │ amount           │
│ amount_paid    │   └──────────────────┘   │ payment_method   │
│ discount       │                          └──────────────────┘
│ status, notes  │
└────────────────┘

┌──────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│  customers   │   │   sales_orders   │   │  sales_order_items   │
├──────────────┤   ├──────────────────┤   ├──────────────────────┤
│ id (PK)      │◄──│ customer_id (FK) │◄──│ sales_order_id (FK)  │
│ name, code   │   │ id (PK)          │   │ product_id (FK)      │
│ phone        │   │ code             │   │ quantity             │
│ address      │   │ total_amount     │   │ unit_price           │
│ group_id(FK) │   │ payment_method   │   └──────────────────────┘
└──────┬───────┘   │ status           │
       │           └──────────────────┘
┌──────┴──────────┐
│ customer_groups │   ┌──────────────────┐   ┌──────────────────┐
├─────────────────┤   │stock_adjustments │   │ store_settings   │
│ id (PK)         │   ├──────────────────┤   ├──────────────────┤
│ name            │   │ product_id (FK)  │   │ store_name       │
│ description     │   │ type, quantity   │   │ store_phone      │
└─────────────────┘   │ unit_price, note │   │ store_address    │
                      └──────────────────┘   │ print_paper_size │
                                             └──────────────────┘

┌──────────────────┐
│ print_templates  │
├──────────────────┤
│ id, name, type   │
│ content          │
│ paper_size       │
│ is_default       │
└──────────────────┘
```

### Bảng tổng hợp

| Bảng | Mô tả | Quan hệ |
|---|---|---|
| `products` | Sản phẩm | → `categories` |
| `categories` | Danh mục sản phẩm | — |
| `import_orders` | Phiếu nhập hàng | → `suppliers` |
| `import_order_items` | Chi tiết phiếu nhập | → `import_orders`, `products` |
| `payment_slips` | Phiếu thanh toán nhập hàng | → `import_orders` |
| `sales_orders` | Hóa đơn bán hàng | → `customers` |
| `sales_order_items` | Chi tiết hóa đơn bán | → `sales_orders`, `products` |
| `customers` | Khách hàng | → `customer_groups` |
| `customer_groups` | Nhóm khách hàng | — |
| `suppliers` | Nhà cung cấp | — |
| `stock_adjustments` | Điều chỉnh tồn kho | → `products` |
| `store_settings` | Cài đặt cửa hàng | — (singleton) |
| `print_templates` | Mẫu in hóa đơn | — |

---

## 7. 📐 Quy ước phát triển

### Naming Conventions

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Component files | PascalCase | `ProductsPage.tsx` |
| Hook files | camelCase với prefix `use-` | `use-debounce.ts` |
| Utility files | camelCase | `utils.ts` |
| Database tables | snake_case, số nhiều | `sales_orders` |
| Database columns | snake_case | `stock_quantity` |
| CSS tokens | kebab-case | `--primary-foreground` |

### Component Guidelines

1. **Page components** (`src/pages/`): Chứa logic fetch data, state management, layout trang
2. **Feature components** (`src/components/`): Logic nghiệp vụ cụ thể cho module
3. **UI components** (`src/components/ui/`): Primitives từ shadcn/ui — **không chỉnh sửa trực tiếp**, mở rộng qua `variants`
4. **Shared components** (`src/components/shared/`): Dùng chung giữa nhiều module

### Styling Rules

- ✅ Dùng semantic tokens: `bg-primary`, `text-muted-foreground`, `border-border`
- ❌ Không hardcode màu: `bg-blue-500`, `text-gray-600`, `#ff0000`
- ✅ Tất cả màu mới thêm vào `index.css` (CSS variables) + `tailwind.config.ts` (mapping)

### Files không được chỉnh sửa thủ công

| File | Lý do |
|---|---|
| `src/integrations/supabase/client.ts` | Tự động tạo bởi Supabase integration |
| `src/integrations/supabase/types.ts` | Tự động tạo từ DB schema |
| `supabase/config.toml` | Tự động quản lý |
| `.env` | Tự động cập nhật bởi platform |

---

> 📅 Cập nhật lần cuối: Tháng 3, 2026
