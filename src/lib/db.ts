// Loose-typed re-export of the supabase client.
import { supabase as typedSupabase } from "@/integrations/supabase/client";

export const supabase: any = typedSupabase;
