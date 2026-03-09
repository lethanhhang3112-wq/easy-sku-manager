export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          customer_group_id: string | null
          id: string
          name: string
          phone: string | null
          status: string
          total_debt: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          customer_group_id?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
          total_debt?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          customer_group_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
          total_debt?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      import_order_items: {
        Row: {
          id: string
          import_order_id: string
          product_id: string
          quantity: number
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          id?: string
          import_order_id: string
          product_id: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
        }
        Update: {
          id?: string
          import_order_id?: string
          product_id?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_order_items_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "import_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_orders: {
        Row: {
          amount_paid: number
          branch_name: string
          code: string
          created_at: string
          created_by: string
          discount: number
          id: string
          notes: string | null
          status: string
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branch_name?: string
          code: string
          created_at?: string
          created_by?: string
          discount?: number
          id?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branch_name?: string
          code?: string
          created_at?: string
          created_by?: string
          discount?: number
          id?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_slips: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          import_order_id: string | null
          notes: string | null
          payment_method: string
          reference_id: string | null
          target_id: string | null
          target_type: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          id?: string
          import_order_id?: string | null
          notes?: string | null
          payment_method?: string
          reference_id?: string | null
          target_id?: string | null
          target_type?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          import_order_id?: string | null
          notes?: string | null
          payment_method?: string
          reference_id?: string | null
          target_id?: string | null
          target_type?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_slips_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "import_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      print_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          paper_size: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          paper_size?: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          paper_size?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          code: string
          cost_price: number
          created_at: string
          id: string
          name: string
          sale_price: number
          status: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          cost_price?: number
          created_at?: string
          id?: string
          name: string
          sale_price?: number
          status?: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          cost_price?: number
          created_at?: string
          id?: string
          name?: string
          sale_price?: number
          status?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          discount: number
          final_price: number | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Insert: {
          discount?: number
          final_price?: number | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          sales_order_id: string
          unit_price?: number
        }
        Update: {
          discount?: number
          final_price?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sales_order_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          branch_name: string
          code: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          payment_method: string
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_name?: string
          code: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_name?: string
          code?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          created_at: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          type: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          type: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          type?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          created_at: string
          id: number
          print_paper_size: string
          receipt_footer_text: string
          store_address: string
          store_logo_url: string | null
          store_name: string
          store_phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          print_paper_size?: string
          receipt_footer_text?: string
          store_address?: string
          store_logo_url?: string | null
          store_name?: string
          store_phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          print_paper_size?: string
          receipt_footer_text?: string
          store_address?: string
          store_logo_url?: string | null
          store_name?: string
          store_phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          code: string
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          tax_code: string | null
          total_debt: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_code?: string | null
          total_debt?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_code?: string | null
          total_debt?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_products_unaccented: {
        Args: { search_term: string }
        Returns: {
          category_id: string | null
          code: string
          cost_price: number
          created_at: string
          id: string
          name: string
          sale_price: number
          status: string
          stock_quantity: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
