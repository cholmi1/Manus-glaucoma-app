-- Supabase Auth user UUIDs and role-aware Row Level Security.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_auth_user_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_profile_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT organization_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.can_access_patient(target_patient_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = target_patient_id
      AND p.organization_id = public.current_organization_id()
      AND (p.user_id = auth.uid() OR public.current_app_role() IN ('physician', 'admin'))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_clinical_data()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_app_role() IN ('physician', 'admin') $$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iop_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iop_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_own ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_organization_id());

CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (public.current_app_role() = 'admin' AND organization_id = public.current_organization_id()));

CREATE POLICY patients_select_authorized ON public.patients FOR SELECT TO authenticated
  USING (public.can_access_patient(id));
CREATE POLICY patients_manage_clinical ON public.patients FOR ALL TO authenticated
  USING (public.can_manage_clinical_data() AND organization_id = public.current_organization_id())
  WITH CHECK (public.can_manage_clinical_data() AND organization_id = public.current_organization_id());

CREATE POLICY iop_targets_select_authorized ON public.iop_targets FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY iop_targets_manage_clinical ON public.iop_targets FOR ALL TO authenticated
  USING (public.can_manage_clinical_data() AND public.can_access_patient(patient_id))
  WITH CHECK (public.can_manage_clinical_data() AND public.can_access_patient(patient_id));

CREATE POLICY iop_measurements_select_authorized ON public.iop_measurements FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY iop_measurements_insert_authorized ON public.iop_measurements FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY iop_measurements_update_clinical ON public.iop_measurements FOR UPDATE TO authenticated
  USING (public.can_manage_clinical_data() AND public.can_access_patient(patient_id))
  WITH CHECK (public.can_manage_clinical_data() AND public.can_access_patient(patient_id));

CREATE POLICY prescriptions_select_authorized ON public.prescriptions FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY prescriptions_manage_clinical ON public.prescriptions FOR ALL TO authenticated
  USING (public.can_manage_clinical_data() AND public.can_access_patient(patient_id))
  WITH CHECK (public.can_manage_clinical_data() AND public.can_access_patient(patient_id));

CREATE POLICY dose_events_select_authorized ON public.dose_events FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));
CREATE POLICY dose_events_insert_authorized ON public.dose_events FOR INSERT TO authenticated
  WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY dose_events_update_authorized ON public.dose_events FOR UPDATE TO authenticated
  USING (public.can_access_patient(patient_id)) WITH CHECK (public.can_access_patient(patient_id));

CREATE POLICY notifications_select_authorized ON public.notifications FOR SELECT TO authenticated
  USING (public.can_access_patient(patient_id));

CREATE POLICY dashboard_preferences_own ON public.dashboard_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY devices_clinical ON public.devices FOR SELECT TO authenticated
  USING (public.can_manage_clinical_data() AND organization_id = public.current_organization_id());
CREATE POLICY device_assignments_clinical ON public.device_assignments FOR SELECT TO authenticated
  USING (public.can_manage_clinical_data());
CREATE POLICY device_status_history_clinical ON public.device_status_history FOR SELECT TO authenticated
  USING (public.can_manage_clinical_data());
CREATE POLICY audit_logs_admin_only ON public.audit_logs FOR SELECT TO authenticated
  USING (public.current_app_role() = 'admin');
