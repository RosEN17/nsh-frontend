"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Profile = {
  id:         string;
  full_name:  string;
  role:       string;
  avatar_url: string | null;
  company_id: string | null;
};

export type Company = {
  id:   string;
  name: string;
};

export function useTeam() {
  const [me,      setMe]      = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // My profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile) { setLoading(false); return; }
      setMe(profile);

      // Company
      if (profile.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profile.company_id)
          .single();
        setCompany(comp);

        // Team members
        const { data: team } = await supabase
          .from("profiles")
          .select("*")
          .eq("company_id", profile.company_id);
        setMembers(team || []);
      }

      setLoading(false);
    }
    load();
  }, []);

  return { me, members, company, loading };
}
