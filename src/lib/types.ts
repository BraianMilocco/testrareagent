export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_roles: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      test_case_roles: {
        Row: {
          app_role_id: string
          test_case_id: string
        }
        Insert: {
          app_role_id: string
          test_case_id: string
        }
        Update: {
          app_role_id?: string
          test_case_id?: string
        }
        Relationships: []
      }
      test_cases: {
        Row: {
          created_at: string
          description: string | null
          expected_result: string | null
          id: string
          order: number
          project_id: string
          steps: string | null
          title: string
          user_story_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_result?: string | null
          id?: string
          order?: number
          project_id: string
          steps?: string | null
          title: string
          user_story_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_result?: string | null
          id?: string
          order?: number
          project_id?: string
          steps?: string | null
          title?: string
          user_story_id?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          comment: string | null
          id: string
          status: string
          test_case_id: string
          test_run_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          id?: string
          status?: string
          test_case_id: string
          test_run_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          id?: string
          status?: string
          test_case_id?: string
          test_run_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          name: string
          project_id: string
          role_filter_id: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
          role_filter_id?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          role_filter_id?: string | null
          status?: string
        }
        Relationships: []
      }
      user_stories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order: number
          priority: string
          project_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          priority?: string
          project_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order?: number
          priority?: string
          project_id?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience row types
export type Project = Database['public']['Tables']['projects']['Row']
export type AppRole = Database['public']['Tables']['app_roles']['Row']
export type UserStory = Database['public']['Tables']['user_stories']['Row']
export type TestCase = Database['public']['Tables']['test_cases']['Row']
export type TestRun = Database['public']['Tables']['test_runs']['Row']
export type TestResult = Database['public']['Tables']['test_results']['Row']

export type TestStatus = 'pending' | 'pass' | 'fail' | 'blocked' | 'skipped'
export type Priority = 'high' | 'medium' | 'low'
