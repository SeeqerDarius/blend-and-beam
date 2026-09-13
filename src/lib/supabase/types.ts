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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          alternate_phone: string | null
          city: string
          created_at: string
          delivery_notes: string | null
          full_name: string
          ghana_post_gps: string | null
          id: string
          is_default: boolean
          landmark: string | null
          phone: string
          region: string
          user_id: string
        }
        Insert: {
          address_line: string
          alternate_phone?: string | null
          city: string
          created_at?: string
          delivery_notes?: string | null
          full_name: string
          ghana_post_gps?: string | null
          id?: string
          is_default?: boolean
          landmark?: string | null
          phone: string
          region: string
          user_id: string
        }
        Update: {
          address_line?: string
          alternate_phone?: string | null
          city?: string
          created_at?: string
          delivery_notes?: string | null
          full_name?: string
          ghana_post_gps?: string | null
          id?: string
          is_default?: boolean
          landmark?: string | null
          phone?: string
          region?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          slug: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          slug: string
        }
        Update: {
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          id: string
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          id?: string
          product_id: string
          quantity: number
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          id?: string
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          anonymous_token_hash: string | null
          created_at: string
          expires_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          anonymous_token_hash?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          anonymous_token_hash?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          expires_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_redemptions: number | null
          minimum_minor: number
          per_customer: number | null
          starts_at: string | null
          value: number
        }
        Insert: {
          code: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          max_redemptions?: number | null
          minimum_minor?: number
          per_customer?: number | null
          starts_at?: string | null
          value: number
        }
        Update: {
          code?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_redemptions?: number | null
          minimum_minor?: number
          per_customer?: number | null
          starts_at?: string | null
          value?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          low_stock_threshold: number
          product_id: string | null
          quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          low_stock_threshold?: number
          product_id?: string | null
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          low_stock_threshold?: number
          product_id?: string | null
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          inventory_id: string
          quantity_delta: number
          reason: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          inventory_id: string
          quantity_delta: number
          reason: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          inventory_id?: string
          quantity_delta?: number
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost_minor: number | null
          discount_minor: number
          id: string
          options: Json
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string
          total_minor: number
          unit_price_minor: number
          variant_id: string | null
        }
        Insert: {
          cost_minor?: number | null
          discount_minor?: number
          id?: string
          options?: Json
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sku: string
          total_minor: number
          unit_price_minor: number
          variant_id?: string | null
        }
        Update: {
          cost_minor?: number | null
          discount_minor?: number
          id?: string
          options?: Json
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          total_minor?: number
          unit_price_minor?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_note: string | null
          billing_address: Json | null
          checkout_fingerprint: string | null
          created_at: string
          currency: string
          customer_note: string | null
          discount_minor: number
          guest_email: string | null
          guest_phone: string | null
          id: string
          idempotency_key: string
          order_number: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipping_address: Json
          shipping_minor: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          billing_address?: Json | null
          checkout_fingerprint?: string | null
          created_at?: string
          currency?: string
          customer_note?: string | null
          discount_minor?: number
          guest_email?: string | null
          guest_phone?: string | null
          id?: string
          idempotency_key: string
          order_number: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address: Json
          shipping_minor: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor: number
          tax_minor?: number
          total_minor: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          billing_address?: Json | null
          checkout_fingerprint?: string | null
          created_at?: string
          currency?: string
          customer_note?: string | null
          discount_minor?: number
          guest_email?: string | null
          guest_phone?: string | null
          id?: string
          idempotency_key?: string
          order_number?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address?: Json
          shipping_minor?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider_event_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider_event_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_response: Json | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          verified_at: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          provider?: string
          provider_response?: Json | null
          reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          verified_at?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_response?: Json | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          id: string
          key: string
        }
        Insert: {
          id?: string
          key: string
        }
        Update: {
          id?: string
          key?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          height: number | null
          id: string
          original_path: string | null
          path: string
          preparation: Json | null
          product_id: string
          sort_order: number
          variant_id: string | null
          width: number | null
        }
        Insert: {
          alt_text: string
          height?: number | null
          id?: string
          original_path?: string | null
          path: string
          preparation?: Json | null
          product_id: string
          sort_order?: number
          variant_id?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string
          height?: number | null
          id?: string
          original_path?: string | null
          path?: string
          preparation?: Json | null
          product_id?: string
          sort_order?: number
          variant_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_upload_batches: {
        Row: {
          actor_id: string
          created_at: string
          expired: boolean
          id: string
          paths: string[]
          product_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          expired?: boolean
          id: string
          paths?: string[]
          product_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          expired?: boolean
          id?: string
          paths?: string[]
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_upload_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          name: string
          options: Json
          price_minor: number | null
          product_id: string
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          weight_grams: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          options?: Json
          price_minor?: number | null
          product_id: string
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          weight_grams?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          options?: Json
          price_minor?: number | null
          product_id?: string
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_backorder: boolean
          brand_id: string | null
          compare_at_minor: number | null
          cost_minor: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_best_seller: boolean
          is_featured: boolean
          name: string
          price_minor: number
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          track_inventory: boolean
          updated_at: string
          warranty: string | null
          weight_grams: number | null
        }
        Insert: {
          allow_backorder?: boolean
          brand_id?: string | null
          compare_at_minor?: number | null
          cost_minor?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_best_seller?: boolean
          is_featured?: boolean
          name: string
          price_minor: number
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku: string
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          track_inventory?: boolean
          updated_at?: string
          warranty?: string | null
          weight_grams?: number | null
        }
        Update: {
          allow_backorder?: boolean
          brand_id?: string | null
          compare_at_minor?: number | null
          cost_minor?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_best_seller?: boolean
          is_featured?: boolean
          name?: string
          price_minor?: number
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          track_inventory?: boolean
          updated_at?: string
          warranty?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string
          created_at: string
          id: string
          product_id: string
          rating: number
          status: string
          title: string | null
          user_id: string
          verified_purchase: boolean
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          status?: string
          title?: string | null
          user_id: string
          verified_purchase?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          user_id?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          cod_enabled: boolean
          estimate: string
          fee_minor: number
          free_shipping_threshold_minor: number | null
          id: string
          is_active: boolean
          name: string
          regions: string[]
        }
        Insert: {
          cod_enabled?: boolean
          estimate: string
          fee_minor: number
          free_shipping_threshold_minor?: number | null
          id?: string
          is_active?: boolean
          name: string
          regions: string[]
        }
        Update: {
          cod_enabled?: boolean
          estimate?: string
          fee_minor?: number
          free_shipping_threshold_minor?: number | null
          id?: string
          is_active?: boolean
          name?: string
          regions?: string[]
        }
        Relationships: []
      }
      site_content: {
        Row: {
          body: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_delta: number
          p_product: string
          p_reason: string
          p_variant?: string
        }
        Returns: undefined
      }
      admin_order: { Args: { p_order: string }; Returns: Json }
      admin_product: {
        Args: { p_id: string }
        Returns: {
          allow_backorder: boolean
          brand_id: string | null
          compare_at_minor: number | null
          cost_minor: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_best_seller: boolean
          is_featured: boolean
          name: string
          price_minor: number
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          track_inventory: boolean
          updated_at: string
          warranty: string | null
          weight_grams: number | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_products: {
        Args: never
        Returns: {
          allow_backorder: boolean
          brand_id: string | null
          compare_at_minor: number | null
          cost_minor: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_best_seller: boolean
          is_featured: boolean
          name: string
          price_minor: number
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          track_inventory: boolean
          updated_at: string
          warranty: string | null
          weight_grams: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assign_staff: {
        Args: { p_email: string; p_remove?: boolean; p_role: string }
        Returns: undefined
      }
      collect_cod_payment: {
        Args: { p_note: string; p_order: string }
        Returns: undefined
      }
      commerce_report: { Args: { p_from: string; p_to: string }; Returns: Json }
      create_product_with_images: {
        Args: {
          p_category?: string
          p_images: Json
          p_key: string
          p_product: Json
        }
        Returns: string
      }
      expire_product_uploads: {
        Args: never
        Returns: {
          id: string
          paths: string[]
        }[]
      }
      has_permission: { Args: { permission_key: string }; Returns: boolean }
      has_staff_permission: {
        Args: { permission_key: string }
        Returns: boolean
      }
      my_permissions: { Args: never; Returns: string[] }
      place_cod_order: {
        Args: { p_address: Json; p_items: Json; p_key: string; p_zone: string }
        Returns: Json
      }
      record_contact_selection: {
        Args: { p_channel: string; p_slug: string }
        Returns: undefined
      }
      register_product_upload: {
        Args: { p_key: string; p_paths: string[] }
        Returns: string
      }
      set_order_note: {
        Args: { p_note: string; p_order: string }
        Returns: undefined
      }
      set_primary_image: { Args: { p_image: string }; Returns: undefined }
      staff_membership: { Args: never; Returns: boolean }
      transition_order: {
        Args: { p_note: string; p_order: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "ready_for_dispatch"
        | "shipped"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      product_status: "draft" | "active" | "archived"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "ready_for_dispatch",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      product_status: ["draft", "active", "archived"],
    },
  },
} as const
