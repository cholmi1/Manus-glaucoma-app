-- Keep SECURITY DEFINER helpers out of the exposed public schema.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_app_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()) $$;

CREATE OR REPLACE FUNCTION private.current_organization_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()) $$;

CREATE OR REPLACE FUNCTION private.can_access_patient(target_patient_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = target_patient_id
      AND p.organization_id = private.current_organization_id()
      AND (p.user_id = (SELECT auth.uid()) OR private.current_app_role() IN ('physician', 'admin'))
  )
$$;

CREATE OR REPLACE FUNCTION private.can_manage_clinical_data()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT private.current_app_role() IN ('physician', 'admin') $$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_patient(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_clinical_data() TO authenticated;

DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS patients_select_authorized ON public.patients;
DROP POLICY IF EXISTS patients_manage_clinical ON public.patients;
DROP POLICY IF EXISTS iop_targets_select_authorized ON public.iop_targets;
DROP POLICY IF EXISTS iop_targets_manage_clinical ON public.iop_targets;
DROP POLICY IF EXISTS iop_measurements_select_authorized ON public.iop_measurements;
DROP POLICY IF EXISTS iop_measurements_insert_authorized ON public.iop_measurements;
DROP POLICY IF EXISTS iop_measurements_update_clinical ON public.iop_measurements;
DROP POLICY IF EXISTS prescriptions_select_authorized ON public.prescriptions;
DROP POLICY IF EXISTS prescriptions_manage_clinical ON public.prescriptions;
DROP POLICY IF EXISTS dose_events_select_authorized ON public.dose_events;
DROP POLICY IF EXISTS dose_events_insert_authorized ON public.dose_events;
DROP POLICY IF EXISTS dose_events_update_authorized ON public.dose_events;
DROP POLICY IF EXISTS notifications_select_authorized ON public.notifications;
DROP POLICY IF EXISTS dashboard_preferences_own ON public.dashboard_preferences;
DROP POLICY IF EXISTS devices_clinical ON public.devices;
DROP POLICY IF EXISTS device_assignments_clinical ON public.device_assignments;
DROP POLICY IF EXISTS device_status_history_clinical ON public.device_status_history;
DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;

REVOKE ALL ON TABLE public.organizations, public.profiles, public.patients, public.iop_targets,
  public.iop_measurements, public.prescriptions, public.dose_events, public.devices,
  public.device_assignments, public.device_status_history, public.notifications,
  public.audit_logs, public.dashboard_preferences FROM anon, authenticated;

GRANT SELECT ON public.organizations, public.profiles, public.patients, public.iop_targets,
  public.iop_measurements, public.prescriptions, public.dose_events, public.devices,
  public.device_assignments, public.device_status_history, public.notifications,
  public.audit_logs, public.dashboard_preferences TO authenticated;
GRANT INSERT, UPDATE ON public.iop_measurements, public.dose_events, public.dashboard_preferences TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.patients, public.iop_targets, public.prescriptions TO authenticated;

CREATE POLICY organizations_select_own ON public.organizations FOR SELECT TO authenticated
  USING (id = private.current_organization_id());
CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (private.current_app_role() = 'admin' AND organization_id = private.current_organization_id()));

CREATE POLICY patients_select_authorized ON public.patients FOR SELECT TO authenticated
  USING (private.can_access_patient(id));
CREATE POLICY patients_insert_clinical ON public.patients FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_clinical_data() AND organization_id = private.current_organization_id());
CREATE POLICY patients_update_clinical ON public.patients FOR UPDATE TO authenticated
  USING (private.can_manage_clinical_data() AND organization_id = private.current_organization_id())
  WITH CHECK (private.can_manage_clinical_data() AND organization_id = private.current_organization_id());
CREATE POLICY patients_delete_clinical ON public.patients FOR DELETE TO authenticated
  USING (private.current_app_role() = 'admin' AND organization_id = private.current_organization_id());

CREATE POLICY iop_targets_select_authorized ON public.iop_targets FOR SELECT TO authenticated USING (private.can_access_patient(patient_id));
CREATE POLICY iop_targets_insert_clinical ON public.iop_targets FOR INSERT TO authenticated WITH CHECK (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));
CREATE POLICY iop_targets_update_clinical ON public.iop_targets FOR UPDATE TO authenticated USING (private.can_manage_clinical_data() AND private.can_access_patient(patient_id)) WITH CHECK (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));
CREATE POLICY iop_targets_delete_clinical ON public.iop_targets FOR DELETE TO authenticated USING (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));

CREATE POLICY iop_measurements_select_authorized ON public.iop_measurements FOR SELECT TO authenticated USING (private.can_access_patient(patient_id));
CREATE POLICY iop_measurements_insert_authorized ON public.iop_measurements FOR INSERT TO authenticated WITH CHECK (private.can_access_patient(patient_id));
CREATE POLICY iop_measurements_update_clinical ON public.iop_measurements FOR UPDATE TO authenticated USING (private.can_manage_clinical_data() AND private.can_access_patient(patient_id)) WITH CHECK (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));

CREATE POLICY prescriptions_select_authorized ON public.prescriptions FOR SELECT TO authenticated USING (private.can_access_patient(patient_id));
CREATE POLICY prescriptions_insert_clinical ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));
CREATE POLICY prescriptions_update_clinical ON public.prescriptions FOR UPDATE TO authenticated USING (private.can_manage_clinical_data() AND private.can_access_patient(patient_id)) WITH CHECK (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));
CREATE POLICY prescriptions_delete_clinical ON public.prescriptions FOR DELETE TO authenticated USING (private.can_manage_clinical_data() AND private.can_access_patient(patient_id));

CREATE POLICY dose_events_select_authorized ON public.dose_events FOR SELECT TO authenticated USING (private.can_access_patient(patient_id));
CREATE POLICY dose_events_insert_authorized ON public.dose_events FOR INSERT TO authenticated WITH CHECK (private.can_access_patient(patient_id));
CREATE POLICY dose_events_update_authorized ON public.dose_events FOR UPDATE TO authenticated USING (private.can_access_patient(patient_id)) WITH CHECK (private.can_access_patient(patient_id));

CREATE POLICY notifications_select_authorized ON public.notifications FOR SELECT TO authenticated USING (private.can_access_patient(patient_id));
CREATE POLICY dashboard_preferences_own ON public.dashboard_preferences FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY devices_clinical ON public.devices FOR SELECT TO authenticated USING (private.can_manage_clinical_data() AND organization_id = private.current_organization_id());
CREATE POLICY device_assignments_clinical ON public.device_assignments FOR SELECT TO authenticated USING (private.can_manage_clinical_data());
CREATE POLICY device_status_history_clinical ON public.device_status_history FOR SELECT TO authenticated USING (private.can_manage_clinical_data());
CREATE POLICY audit_logs_admin_only ON public.audit_logs FOR SELECT TO authenticated USING (private.current_app_role() = 'admin');

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_patient(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_clinical_data() FROM PUBLIC, anon, authenticated;
