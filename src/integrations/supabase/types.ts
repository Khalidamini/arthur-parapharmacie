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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          brand: string
          cart_id: string | null
          created_at: string
          id: string
          image_url: string | null
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          reason: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand: string
          cart_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          reason?: string | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          cart_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          amount_total: number | null
          completed_at: string | null
          created_at: string
          delivery_address: Json | null
          delivery_method: string | null
          id: string
          notification_email: string | null
          notification_sent_at: string | null
          payment_intent_id: string | null
          payment_status: string | null
          pharmacy_id: string | null
          pickup_message: string | null
          ready_for_pickup: boolean | null
          shipping_label_url: string | null
          shipping_tracking_number: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_total?: number | null
          completed_at?: string | null
          created_at?: string
          delivery_address?: Json | null
          delivery_method?: string | null
          id?: string
          notification_email?: string | null
          notification_sent_at?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          pharmacy_id?: string | null
          pickup_message?: string | null
          ready_for_pickup?: boolean | null
          shipping_label_url?: string | null
          shipping_tracking_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_total?: number | null
          completed_at?: string | null
          created_at?: string
          delivery_address?: Json | null
          delivery_method?: string | null
          id?: string
          notification_email?: string | null
          notification_sent_at?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          pharmacy_id?: string | null
          pickup_message?: string | null
          ready_for_pickup?: boolean | null
          shipping_label_url?: string | null
          shipping_tracking_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string
          city: string
          created_at: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          opening_hours: Json | null
          phone: string | null
          postal_code: string
          qr_code: string
          stripe_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code: string
          qr_code: string
          stripe_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string
          qr_code?: string
          stripe_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pharmacy_activity_logs: {
        Row: {
          action_details: Json | null
          action_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          pharmacy_id: string
          user_id: string
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          pharmacy_id: string
          user_id: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          pharmacy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_activity_logs_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          pharmacy_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          pharmacy_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          pharmacy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_api_keys_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: true
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_products: {
        Row: {
          created_at: string | null
          id: string
          is_available: boolean | null
          pharmacy_id: string
          product_id: string
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          pharmacy_id: string
          product_id: string
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          pharmacy_id?: string
          product_id?: string
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_products_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_registrations: {
        Row: {
          address: string
          city: string
          created_at: string | null
          id: string
          owner_email: string
          owner_name: string
          pharmacy_name: string
          phone: string | null
          postal_code: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          id?: string
          owner_email: string
          owner_name: string
          pharmacy_name: string
          phone?: string | null
          postal_code: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          id?: string
          owner_email?: string
          owner_name?: string
          pharmacy_name?: string
          phone?: string | null
          postal_code?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          brand: string
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          brand?: string
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          allergies: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          is_pregnant: boolean | null
          medical_history: string | null
          qr_code_number: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          age?: number | null
          allergies?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id: string
          is_pregnant?: boolean | null
          medical_history?: string | null
          qr_code_number: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          age?: number | null
          allergies?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          is_pregnant?: boolean | null
          medical_history?: string | null
          qr_code_number?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percentage: number | null
          id: string
          image_url: string | null
          original_price: number | null
          pharmacy_id: string
          title: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          image_url?: string | null
          original_price?: number | null
          pharmacy_id: string
          title: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          image_url?: string | null
          original_price?: number | null
          pharmacy_id?: string
          title?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          product_name: string | null
          promotion_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          promotion_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          promotion_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["pharmacy_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["pharmacy_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["pharmacy_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_pharmacy_affiliation: {
        Row: {
          affiliation_type: string
          created_at: string | null
          id: string
          pharmacy_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          affiliation_type: string
          created_at?: string | null
          id?: string
          pharmacy_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          affiliation_type?: string
          created_at?: string | null
          id?: string
          pharmacy_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pharmacy_affiliation_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          must_change_password: boolean | null
          pharmacy_id: string
          role: Database["public"]["Enums"]["pharmacy_role"]
          temporary_password_set_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          pharmacy_id: string
          role: Database["public"]["Enums"]["pharmacy_role"]
          temporary_password_set_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          pharmacy_id?: string
          role?: Database["public"]["Enums"]["pharmacy_role"]
          temporary_password_set_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_pharmacy_role: {
        Args: { _pharmacy_id: string; _user_id: string }
        Returns: boolean
      }
      has_pharmacy_role: {
        Args: {
          _pharmacy_id: string
          _role: Database["public"]["Enums"]["pharmacy_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_pharmacy_activity: {
        Args: {
          _action_details?: Json
          _action_type: string
          _entity_id?: string
          _entity_type?: string
          _pharmacy_id: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      admin_role: "admin" | "super_admin"
      pharmacy_role:
        | "owner"
        | "admin"
        | "product_manager"
        | "promotion_manager"
        | "viewer"
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
    Enums: {
      admin_role: ["admin", "super_admin"],
      pharmacy_role: [
        "owner",
        "admin",
        "product_manager",
        "promotion_manager",
        "viewer",
      ],
    },
  },
} as const
