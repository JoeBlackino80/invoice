export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          ico: string | null
          dic: string | null
          ic_dph: string | null
          street: string | null
          city: string | null
          zip: string | null
          country: string
          email: string | null
          phone: string | null
          web: string | null
          iban: string | null
          bic: string | null
          bank_name: string | null
          logo_url: string | null
          stamp_url: string | null
          business_type: "sro" | "as" | "szco" | "druzstvo" | "ine"
          accounting_type: "podvojne" | "jednoduche"
          size_category: "mikro" | "mala" | "stredna" | "velka"
          is_vat_payer: boolean
          vat_period: "mesacne" | "stvrtrocne" | null
          registration_court: string | null
          section_insert: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          ico?: string | null
          dic?: string | null
          ic_dph?: string | null
          street?: string | null
          city?: string | null
          zip?: string | null
          country?: string
          email?: string | null
          phone?: string | null
          web?: string | null
          iban?: string | null
          bic?: string | null
          bank_name?: string | null
          logo_url?: string | null
          stamp_url?: string | null
          business_type?: "sro" | "as" | "szco" | "druzstvo" | "ine"
          accounting_type?: "podvojne" | "jednoduche"
          size_category?: "mikro" | "mala" | "stredna" | "velka"
          is_vat_payer?: boolean
          vat_period?: "mesacne" | "stvrtrocne" | null
          registration_court?: string | null
          section_insert?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          ico?: string | null
          dic?: string | null
          ic_dph?: string | null
          street?: string | null
          city?: string | null
          zip?: string | null
          country?: string
          email?: string | null
          phone?: string | null
          web?: string | null
          iban?: string | null
          bic?: string | null
          bank_name?: string | null
          logo_url?: string | null
          stamp_url?: string | null
          business_type?: "sro" | "as" | "szco" | "druzstvo" | "ine"
          accounting_type?: "podvojne" | "jednoduche"
          size_category?: "mikro" | "mala" | "stredna" | "velka"
          is_vat_payer?: boolean
          vat_period?: "mesacne" | "stvrtrocne" | null
          registration_court?: string | null
          section_insert?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
        }
      }
      company_settings: {
        Row: {
          id: string
          company_id: string
          default_vat_rate: number
          default_currency: string
          default_language: string
          default_payment_days: number
          invoice_prefix: string
          invoice_next_number: number
          smtp_host: string | null
          smtp_port: number | null
          smtp_user: string | null
          smtp_password: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          default_vat_rate?: number
          default_currency?: string
          default_language?: string
          default_payment_days?: number
          invoice_prefix?: string
          invoice_next_number?: number
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_password?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          default_vat_rate?: number
          default_currency?: string
          default_language?: string
          default_payment_days?: number
          invoice_prefix?: string
          invoice_next_number?: number
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_password?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_company_roles: {
        Row: {
          id: string
          user_id: string
          company_id: string
          role: "admin" | "uctovnik" | "fakturant" | "mzdar" | "skladnik" | "readonly"
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          role?: "admin" | "uctovnik" | "fakturant" | "mzdar" | "skladnik" | "readonly"
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          role?: "admin" | "uctovnik" | "fakturant" | "mzdar" | "skladnik" | "readonly"
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      fiscal_years: {
        Row: {
          id: string
          company_id: string
          name: string
          start_date: string
          end_date: string
          status: "otvoreny" | "v_zavierke" | "uzavrety"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          start_date: string
          end_date: string
          status?: "otvoreny" | "v_zavierke" | "uzavrety"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          start_date?: string
          end_date?: string
          status?: "otvoreny" | "v_zavierke" | "uzavrety"
          created_at?: string
          updated_at?: string
        }
      }
      number_sequences: {
        Row: {
          id: string
          company_id: string
          type: string
          prefix: string
          current_number: number
          format: string
          fiscal_year_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type: string
          prefix: string
          current_number?: number
          format?: string
          fiscal_year_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          type?: string
          prefix?: string
          current_number?: number
          format?: string
          fiscal_year_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          company_id: string | null
          table_name: string
          record_id: string
          action: "INSERT" | "UPDATE" | "DELETE"
          old_values: Json | null
          new_values: Json | null
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          table_name: string
          record_id: string
          action: "INSERT" | "UPDATE" | "DELETE"
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          table_name?: string
          record_id?: string
          action?: "INSERT" | "UPDATE" | "DELETE"
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          company_id: string
          user_id: string
          type: string
          title: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          type: string
          title: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      business_type: "sro" | "as" | "szco" | "druzstvo" | "ine"
      accounting_type: "podvojne" | "jednoduche"
      size_category: "mikro" | "mala" | "stredna" | "velka"
      user_role: "admin" | "uctovnik" | "fakturant" | "mzdar" | "skladnik" | "readonly"
      fiscal_year_status: "otvoreny" | "v_zavierke" | "uzavrety"
      audit_action: "INSERT" | "UPDATE" | "DELETE"
      vat_period: "mesacne" | "stvrtrocne"
    }
  }
}
