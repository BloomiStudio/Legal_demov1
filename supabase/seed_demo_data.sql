-- Datos de demostración para "Notaría Demo".
--
-- CÓMO USARLO:
-- 1. Aplica todas las migraciones en el proyecto real de Supabase.
-- 2. Regístrate desde la app con el primer usuario (queda como
--    administrador general de una organización "Mi Notaría" con un
--    departamento "General" — ver handle_new_user en las migraciones).
--    Opcionalmente renombra esa organización/departamento desde la UI.
-- 3. Registra 2-3 cuentas adicionales desde /login para tener distintos
--    roles en el demo (ej. notario@demo.mx, asistente@demo.mx) y asígnales
--    rol/departamento/permisos desde Administración > Usuarios.
-- 4. Corre este script en el SQL Editor del proyecto para poblar clientes
--    y expedientes de ejemplo dentro de esa organización.
--
-- No crea usuarios ni cambia roles/permisos — eso se hace desde la app,
-- que es también la manera de probar que RLS funciona de punta a punta.

do $$
declare
  v_org_id uuid;
  v_dept_id uuid;
  v_client_a uuid;
  v_client_b uuid;
  v_client_c uuid;
  v_act_compraventa uuid;
  v_act_poder uuid;
  v_act_testamento uuid;
  v_case_1 uuid;
  v_case_2 uuid;
  v_case_3 uuid;
begin
  select id into v_org_id from public.organizations order by created_at limit 1;
  select id into v_dept_id from public.departments where organization_id = v_org_id order by created_at limit 1;

  if v_org_id is null then
    raise exception 'No hay ninguna organización todavía. Registra el primer usuario desde la app antes de correr este script.';
  end if;

  select id into v_act_compraventa from public.act_types where code = 'compraventa';
  select id into v_act_poder from public.act_types where code = 'poder';
  select id into v_act_testamento from public.act_types where code = 'testamento';

  insert into public.clients (organization_id, client_type, full_name, rfc, curp, address, phone, email)
  values
    (v_org_id, 'persona_fisica', 'María Fernanda López Ibarra', 'LOIF850312ABC', 'LOIF850312MDFRRN01', 'Av. Insurgentes Sur 1234, CDMX', '5555550101', 'maria.lopez@demo.mx')
  returning id into v_client_a;

  insert into public.clients (organization_id, client_type, full_name, rfc, curp, address, phone, email)
  values
    (v_org_id, 'persona_fisica', 'Roberto Carlos Méndez Ruiz', 'MERO780925XYZ', 'MERO780925HDFNRB02', 'Calle Reforma 56, Guadalajara', '5555550102', 'roberto.mendez@demo.mx')
  returning id into v_client_b;

  insert into public.clients (organization_id, client_type, full_name, rfc, address, phone, email)
  values
    (v_org_id, 'persona_moral', 'Constructora Alba del Norte S.A. de C.V.', 'CAN120508ABC', 'Blvd. Industrial 900, Monterrey', '5555550103', 'contacto@albadelnorte.demo.mx')
  returning id into v_client_c;

  if v_act_compraventa is not null then
    insert into public.cases (organization_id, department_id, act_type_id, title, due_date, notes)
    values (v_org_id, v_dept_id, v_act_compraventa, 'Compraventa Depto. 4B, Residencial Las Palmas', current_date + interval '10 days', 'Cliente busca cerrar antes de fin de mes.')
    returning id into v_case_1;

    insert into public.case_clients (case_id, client_id, role_in_case) values
      (v_case_1, v_client_a, 'vendedor'),
      (v_case_1, v_client_b, 'comprador');
  end if;

  if v_act_poder is not null then
    insert into public.cases (organization_id, department_id, act_type_id, title, due_date, notes)
    values (v_org_id, v_dept_id, v_act_poder, 'Poder general para actos de administración — Constructora Alba del Norte', current_date + interval '3 days', 'Urgente: apoderado viaja la próxima semana.')
    returning id into v_case_2;

    insert into public.case_clients (case_id, client_id, role_in_case) values
      (v_case_2, v_client_c, 'otorgante');
  end if;

  if v_act_testamento is not null then
    insert into public.cases (organization_id, department_id, act_type_id, title, notes)
    values (v_org_id, v_dept_id, v_act_testamento, 'Testamento público abierto — Roberto Méndez', 'Primera cita de recopilación de datos.')
    returning id into v_case_3;

    insert into public.case_clients (case_id, client_id, role_in_case) values
      (v_case_3, v_client_b, 'testador');
  end if;

  raise notice 'Datos demo insertados en la organización %', v_org_id;
end $$;
