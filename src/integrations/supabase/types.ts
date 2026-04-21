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
      agent_runs: {
        Row: {
          agente: Database["public"]["Enums"]["agent_tipo"]
          conversacion_id: string | null
          created_at: string
          duracion_ms: number | null
          error: string | null
          herramientas_usadas: Json
          id: string
          input: Json
          modelo: string
          output: Json | null
          status: Database["public"]["Enums"]["run_status"]
          tokens_in: number | null
          tokens_out: number | null
          trigger: string
          user_id: string | null
        }
        Insert: {
          agente: Database["public"]["Enums"]["agent_tipo"]
          conversacion_id?: string | null
          created_at?: string
          duracion_ms?: number | null
          error?: string | null
          herramientas_usadas?: Json
          id?: string
          input?: Json
          modelo: string
          output?: Json | null
          status?: Database["public"]["Enums"]["run_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          trigger: string
          user_id?: string | null
        }
        Update: {
          agente?: Database["public"]["Enums"]["agent_tipo"]
          conversacion_id?: string | null
          created_at?: string
          duracion_ms?: number | null
          error?: string | null
          herramientas_usadas?: Json
          id?: string
          input?: Json
          modelo?: string
          output?: Json | null
          status?: Database["public"]["Enums"]["run_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          trigger?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas: {
        Row: {
          agent_run_id: string | null
          created_at: string
          depto_code: string | null
          descripcion: string | null
          fuente: string | null
          id: string
          muni_code: string | null
          payload: Json
          severidad: Database["public"]["Enums"]["severidad"]
          tipo: Database["public"]["Enums"]["alerta_tipo"]
          titulo: string
          url_fuente: string | null
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          depto_code?: string | null
          descripcion?: string | null
          fuente?: string | null
          id?: string
          muni_code?: string | null
          payload?: Json
          severidad: Database["public"]["Enums"]["severidad"]
          tipo: Database["public"]["Enums"]["alerta_tipo"]
          titulo: string
          url_fuente?: string | null
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          depto_code?: string | null
          descripcion?: string | null
          fuente?: string | null
          id?: string
          muni_code?: string | null
          payload?: Json
          severidad?: Database["public"]["Enums"]["severidad"]
          tipo?: Database["public"]["Enums"]["alerta_tipo"]
          titulo?: string
          url_fuente?: string | null
        }
        Relationships: []
      }
      conversaciones: {
        Row: {
          created_at: string
          entidad_id: string | null
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entidad_id?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entidad_id?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidades: {
        Row: {
          api_key_hash: string | null
          contacto_email: string | null
          created_at: string
          depto_code: string | null
          id: string
          muni_code: string | null
          nombre: string
          tipo: Database["public"]["Enums"]["entidad_tipo"]
          updated_at: string
        }
        Insert: {
          api_key_hash?: string | null
          contacto_email?: string | null
          created_at?: string
          depto_code?: string | null
          id?: string
          muni_code?: string | null
          nombre: string
          tipo: Database["public"]["Enums"]["entidad_tipo"]
          updated_at?: string
        }
        Update: {
          api_key_hash?: string | null
          contacto_email?: string | null
          created_at?: string
          depto_code?: string | null
          id?: string
          muni_code?: string | null
          nombre?: string
          tipo?: Database["public"]["Enums"]["entidad_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      irca_snapshots: {
        Row: {
          componentes: Json
          created_at: string
          depto_code: string
          depto_nombre: string
          fecha: string
          id: string
          irca_score: number
          muni_code: string
          muni_nombre: string
          nivel: Database["public"]["Enums"]["riesgo_nivel"]
          pipeline_version: string
        }
        Insert: {
          componentes?: Json
          created_at?: string
          depto_code: string
          depto_nombre: string
          fecha: string
          id?: string
          irca_score: number
          muni_code: string
          muni_nombre: string
          nivel: Database["public"]["Enums"]["riesgo_nivel"]
          pipeline_version?: string
        }
        Update: {
          componentes?: Json
          created_at?: string
          depto_code?: string
          depto_nombre?: string
          fecha?: string
          id?: string
          irca_score?: number
          muni_code?: string
          muni_nombre?: string
          nivel?: Database["public"]["Enums"]["riesgo_nivel"]
          pipeline_version?: string
        }
        Relationships: []
      }
      mensajes: {
        Row: {
          content: string
          conversacion_id: string
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["mensaje_role"]
          tool_calls: Json | null
          tool_name: string | null
        }
        Insert: {
          content: string
          conversacion_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["mensaje_role"]
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Update: {
          content?: string
          conversacion_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["mensaje_role"]
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      normativa_chunks: {
        Row: {
          articulo: string | null
          contenido: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          norma: string
          search_tsv: unknown
          titulo: string
          tokens: number | null
          url_fuente: string | null
        }
        Insert: {
          articulo?: string | null
          contenido: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          norma: string
          search_tsv?: unknown
          titulo: string
          tokens?: number | null
          url_fuente?: string | null
        }
        Update: {
          articulo?: string | null
          contenido?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          norma?: string
          search_tsv?: unknown
          titulo?: string
          tokens?: number | null
          url_fuente?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          entidad_id: string | null
          full_name: string | null
          id: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          entidad_id?: string | null
          full_name?: string | null
          id: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          entidad_id?: string | null
          full_name?: string | null
          id?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes: {
        Row: {
          agent_run_id: string | null
          created_at: string
          depto_code: string | null
          entidad_id: string | null
          generado_por: string | null
          id: string
          metadata: Json
          muni_code: string | null
          pdf_url: string | null
          tipo: Database["public"]["Enums"]["reporte_tipo"]
          titulo: string
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          depto_code?: string | null
          entidad_id?: string | null
          generado_por?: string | null
          id?: string
          metadata?: Json
          muni_code?: string | null
          pdf_url?: string | null
          tipo?: Database["public"]["Enums"]["reporte_tipo"]
          titulo: string
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          depto_code?: string | null
          entidad_id?: string | null
          generado_por?: string | null
          id?: string
          metadata?: Json
          muni_code?: string | null
          pdf_url?: string | null
          tipo?: Database["public"]["Enums"]["reporte_tipo"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reportes_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripciones: {
        Row: {
          activa: boolean
          created_at: string
          depto_filter: string[] | null
          email_destino: string
          entidad_id: string | null
          id: string
          muni_filter: string[] | null
          severidad_minima: Database["public"]["Enums"]["severidad"]
          tipo_alerta: Database["public"]["Enums"]["alerta_tipo"] | null
          umbral_irca: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          depto_filter?: string[] | null
          email_destino: string
          entidad_id?: string | null
          id?: string
          muni_filter?: string[] | null
          severidad_minima?: Database["public"]["Enums"]["severidad"]
          tipo_alerta?: Database["public"]["Enums"]["alerta_tipo"] | null
          umbral_irca?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          depto_filter?: string[] | null
          email_destino?: string
          entidad_id?: string | null
          id?: string
          muni_filter?: string[] | null
          severidad_minima?: Database["public"]["Enums"]["severidad"]
          tipo_alerta?: Database["public"]["Enums"]["alerta_tipo"] | null
          umbral_irca?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validaciones: {
        Row: {
          agent_run_id: string | null
          created_at: string
          depto_code: string | null
          descripcion: string
          fuente: string
          id: string
          metadata: Json
          muni_code: string | null
          resuelta: boolean
          severidad: Database["public"]["Enums"]["severidad"]
          tipo_anomalia: string
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string
          depto_code?: string | null
          descripcion: string
          fuente: string
          id?: string
          metadata?: Json
          muni_code?: string | null
          resuelta?: boolean
          severidad?: Database["public"]["Enums"]["severidad"]
          tipo_anomalia: string
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string
          depto_code?: string | null
          descripcion?: string
          fuente?: string
          id?: string
          metadata?: Json
          muni_code?: string | null
          resuelta?: boolean
          severidad?: Database["public"]["Enums"]["severidad"]
          tipo_anomalia?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_normativa_fts: {
        Args: {
          filter_norma?: string
          match_count?: number
          query_text: string
        }
        Returns: {
          articulo: string
          contenido: string
          id: string
          norma: string
          rank: number
          titulo: string
          url_fuente: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_normativa: {
        Args: {
          filter_norma?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          articulo: string
          contenido: string
          id: string
          norma: string
          similarity: number
          titulo: string
          url_fuente: string
        }[]
      }
    }
    Enums: {
      agent_tipo: "vigia" | "analista" | "reportero" | "validador"
      alerta_tipo:
        | "delta_irca"
        | "evento_ungrd"
        | "brote_sivigila"
        | "clima_ideam"
        | "manual"
      app_role: "admin" | "entidad" | "analista" | "ciudadano"
      entidad_tipo: "nacional" | "departamental" | "municipal"
      mensaje_role: "user" | "assistant" | "tool" | "system"
      reporte_tipo: "ejecutivo" | "tecnico" | "mensual"
      riesgo_nivel: "Bajo" | "Medio" | "Alto" | "Crítico"
      run_status: "running" | "success" | "error" | "timeout"
      severidad: "info" | "baja" | "media" | "alta" | "critica"
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
      agent_tipo: ["vigia", "analista", "reportero", "validador"],
      alerta_tipo: [
        "delta_irca",
        "evento_ungrd",
        "brote_sivigila",
        "clima_ideam",
        "manual",
      ],
      app_role: ["admin", "entidad", "analista", "ciudadano"],
      entidad_tipo: ["nacional", "departamental", "municipal"],
      mensaje_role: ["user", "assistant", "tool", "system"],
      reporte_tipo: ["ejecutivo", "tecnico", "mensual"],
      riesgo_nivel: ["Bajo", "Medio", "Alto", "Crítico"],
      run_status: ["running", "success", "error", "timeout"],
      severidad: ["info", "baja", "media", "alta", "critica"],
    },
  },
} as const
