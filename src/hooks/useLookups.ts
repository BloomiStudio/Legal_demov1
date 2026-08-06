import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ActType, Department, Profile } from "@/lib/database.types";

export function useActTypes() {
  const [actTypes, setActTypes] = useState<ActType[]>([]);
  useEffect(() => {
    supabase
      .from("act_types")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setActTypes((data as ActType[]) ?? []));
  }, []);
  return actTypes;
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);

  const refetch = () =>
    supabase
      .from("departments")
      .select("*")
      .order("name")
      .then(({ data }) => setDepartments((data as Department[]) ?? []));

  useEffect(() => {
    refetch();
  }, []);

  return { departments, refetch };
}

export function useOrgProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data }) => setProfiles((data as Profile[]) ?? []));
  }, []);
  return profiles;
}
