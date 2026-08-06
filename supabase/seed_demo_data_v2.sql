-- Enriquecimiento del demo: departamentos, perfiles de los usuarios reales
-- (Mercedes, Eduardo y el resto del equipo, ya creados vía Admin API),
-- más clientes/expedientes, plantillas y checklist de requisitos.
-- Requiere haber corrido antes supabase/seed_demo_data.sql y haber creado
-- las 9 cuentas nuevas (ver create_demo_users.sh).

do $$
declare
  v_org_id uuid;
  v_dept_general uuid;
  v_dept_compraventas uuid;
  v_dept_corporativo uuid;
  v_dept_testamentos uuid;
  v_act_compraventa uuid;
  v_act_poder uuid;
  v_act_testamento uuid;
  v_act_constitutiva uuid;
  v_act_fideicomiso uuid;
  v_act_donacion uuid;
  v_client_maria uuid;
  v_client_sergio uuid;
  v_client_comercializadora uuid;
  v_client_vertex uuid;
  v_client_acerosbajio uuid;
  v_client_fernando uuid;
  v_client_vistareal uuid;
  v_client_alejandro uuid;
  v_client_diana uuid;
  v_case_cv2 uuid;
  v_case_cv3 uuid;
  v_case_constitutiva uuid;
  v_case_poder2 uuid;
  v_case_testamento2 uuid;
  v_case_fideicomiso uuid;
  v_case_donacion uuid;
  v_mercedes uuid := '2db62d70-d992-4a0c-aade-a66089f93884';
  v_eduardo uuid := 'edf389bb-81c7-453f-b69f-ed4dee71e613';
  v_ana uuid := '5edcf3fe-ced5-4eb4-98e7-3c783fd0e9d2';
  v_jorge uuid := 'daa9a437-d128-4786-924b-765739c292e8';
  v_lucia uuid := '5cc910ae-55c3-4384-9739-b534b6899758';
  v_pablo uuid := '658044a4-4615-4d36-8380-d7fc099e6a39';
  v_daniela uuid := '88b7d00b-91c6-4a0f-88bf-43b10c2ea6cc';
  v_miguel uuid := '70022868-2fc9-4372-8d50-63a09657e730';
  v_sofia uuid := 'f0843aa7-ff9d-4202-a75a-94c59e694cc1';
begin
  select id into v_org_id from organizations order by created_at limit 1;
  select id into v_dept_general from departments where organization_id = v_org_id and name = 'General' limit 1;

  update organizations set name = 'Notaría Pública No. 118, CDMX' where id = v_org_id;

  insert into departments (organization_id, name) values (v_org_id, 'Compraventas') returning id into v_dept_compraventas;
  insert into departments (organization_id, name) values (v_org_id, 'Corporativo') returning id into v_dept_corporativo;
  insert into departments (organization_id, name) values (v_org_id, 'Testamentos y Sucesiones') returning id into v_dept_testamentos;

  select id into v_act_compraventa from act_types where code = 'compraventa';
  select id into v_act_poder from act_types where code = 'poder';
  select id into v_act_testamento from act_types where code = 'testamento';
  select id into v_act_constitutiva from act_types where code = 'constitutiva';
  select id into v_act_fideicomiso from act_types where code = 'fideicomiso';
  select id into v_act_donacion from act_types where code = 'donacion';

  -- Perfiles: rol, departamento y permisos de cada persona.
  update profiles set organization_id = v_org_id, department_id = v_dept_general, role = 'administrador', document_permission = 'edit', can_comment = true, case_visibility_scope = 'organization' where id = v_mercedes;
  update profiles set organization_id = v_org_id, department_id = v_dept_general, role = 'administrador', document_permission = 'edit', can_comment = true, case_visibility_scope = 'organization' where id = v_eduardo;
  update profiles set organization_id = v_org_id, department_id = v_dept_compraventas, role = 'notario', is_department_admin = true, document_permission = 'edit', can_comment = true, case_visibility_scope = 'department' where id = v_ana;
  update profiles set organization_id = v_org_id, department_id = v_dept_corporativo, role = 'abogado', is_department_admin = true, document_permission = 'edit', can_comment = true, case_visibility_scope = 'department' where id = v_jorge;
  update profiles set organization_id = v_org_id, department_id = v_dept_testamentos, role = 'notario', document_permission = 'edit', can_comment = true, case_visibility_scope = 'department' where id = v_lucia;
  update profiles set organization_id = v_org_id, department_id = v_dept_compraventas, role = 'abogado', document_permission = 'create', can_comment = true, case_visibility_scope = 'department' where id = v_pablo;
  update profiles set organization_id = v_org_id, department_id = v_dept_compraventas, role = 'asistente', document_permission = 'create', can_comment = false, case_visibility_scope = 'own' where id = v_daniela;
  update profiles set organization_id = v_org_id, department_id = v_dept_corporativo, role = 'asistente', document_permission = 'read', can_comment = false, case_visibility_scope = 'own' where id = v_miguel;
  update profiles set organization_id = v_org_id, department_id = v_dept_testamentos, role = 'asistente', document_permission = 'comment', can_comment = true, case_visibility_scope = 'department' where id = v_sofia;

  select id into v_client_maria from clients where full_name = 'María Fernanda López Ibarra' and organization_id = v_org_id;

  insert into clients (organization_id, client_type, full_name, rfc, curp, address, phone, email) values
    (v_org_id, 'persona_fisica', 'Sergio Iván Delgado Paredes', 'DEPS900615ABC', 'DEPS900615HDFLRR03', 'Calle Horacio 234, Polanco, CDMX', '5555550104', 'sergio.delgado@demo.mx')
  returning id into v_client_sergio;

  insert into clients (organization_id, client_type, full_name, rfc, address, phone, email) values
    (v_org_id, 'persona_moral', 'Comercializadora Rubí del Valle S.A. de C.V.', 'CRV150211XYZ', 'Av. Presidente Masaryk 111, CDMX', '5555550105', 'contacto@rubidelvalle.demo.mx')
  returning id into v_client_comercializadora;

  insert into clients (organization_id, client_type, full_name, rfc, address, phone, email) values
    (v_org_id, 'persona_moral', 'Grupo Vertex Tecnología S.A.P.I. de C.V.', 'GVT210903ABC', 'Torre Reforma, Paseo de la Reforma 483, CDMX', '5555550106', 'legal@vertextech.demo.mx')
  returning id into v_client_vertex;

  insert into clients (organization_id, client_type, full_name, rfc, address, phone, email) values
    (v_org_id, 'persona_moral', 'Aceros del Bajío S.A. de C.V.', 'ADB080417XYZ', 'Parque Industrial Bajío, León, Guanajuato', '5555550107', 'contacto@acerosdelbajio.demo.mx')
  returning id into v_client_acerosbajio;

  insert into clients (organization_id, client_type, full_name, rfc, curp, address, phone, email) values
    (v_org_id, 'persona_fisica', 'Fernando Castañeda Ruiz', 'CARF551130ABC', 'CARF551130HDFSZR04', 'Calle Amores 89, Del Valle, CDMX', '5555550108', 'fernando.castaneda@demo.mx')
  returning id into v_client_fernando;

  insert into clients (organization_id, client_type, full_name, rfc, address, phone, email) values
    (v_org_id, 'persona_moral', 'Desarrollo Vista Real S.A. de C.V.', 'DVR170622XYZ', 'Blvd. Manuel Ávila Camacho 24, CDMX', '5555550109', 'contacto@vistareal.demo.mx')
  returning id into v_client_vistareal;

  insert into clients (organization_id, client_type, full_name, rfc, curp, address, phone, email) values
    (v_org_id, 'persona_fisica', 'Alejandro Gómez Salinas', 'GOSA630219ABC', 'GOSA630219HDFMLR05', 'Cerrada de Palmas 12, Lomas de Chapultepec, CDMX', '5555550110', 'alejandro.gomez@demo.mx')
  returning id into v_client_alejandro;

  insert into clients (organization_id, client_type, full_name, rfc, curp, address, phone, email) values
    (v_org_id, 'persona_fisica', 'Diana Patricia Gómez Salinas', 'GOSD920804ABC', 'GOSD920804MDFMLN06', 'Cerrada de Palmas 12, Lomas de Chapultepec, CDMX', '5555550111', 'diana.gomez@demo.mx')
  returning id into v_client_diana;

  insert into templates (organization_id, act_type_id, name, content, created_by) values
    (v_org_id, v_act_compraventa, 'Compraventa estándar',
     'ESCRITURA NÚMERO {{numero}}. En la Ciudad de México, ante mí, {{notario}}, Notario Público, comparecen {{vendedor}} en su carácter de VENDEDOR y {{comprador}} en su carácter de COMPRADOR, quienes otorgan el presente CONTRATO DE COMPRAVENTA respecto del inmueble ubicado en {{domicilio_inmueble}}, bajo las siguientes cláusulas: PRIMERA. El VENDEDOR transmite la propiedad del inmueble descrito al COMPRADOR por la cantidad de {{precio}}.',
     v_mercedes);

  insert into templates (organization_id, act_type_id, name, content, created_by) values
    (v_org_id, v_act_testamento, 'Testamento público abierto',
     'ESCRITURA NÚMERO {{numero}}. En la Ciudad de México, ante mí, {{notario}}, comparece {{testador}}, quien en pleno uso de sus facultades otorga su TESTAMENTO PÚBLICO ABIERTO en los siguientes términos: PRIMERA. Instituye como heredero(s) a {{herederos}}.',
     v_lucia);

  insert into templates (organization_id, act_type_id, name, content, created_by) values
    (v_org_id, v_act_poder, 'Poder general para pleitos y cobranzas',
     'ESCRITURA NÚMERO {{numero}}. En la Ciudad de México, ante mí, {{notario}}, comparece {{otorgante}}, quien otorga PODER GENERAL PARA PLEITOS Y COBRANZAS a favor de {{apoderado}}, en los términos del artículo 2554 del Código Civil Federal.',
     v_jorge);

  insert into document_requirements (organization_id, act_type_id, label, description, is_required, status, source, created_by) values
    (v_org_id, v_act_compraventa, 'Identificación oficial de comprador y vendedor', 'INE, pasaporte o cédula profesional vigente.', true, 'approved', 'ai', v_mercedes),
    (v_org_id, v_act_compraventa, 'Certificado de libertad de gravamen', 'Expedido por el Registro Público de la Propiedad, vigencia no mayor a 30 días.', true, 'approved', 'ai', v_mercedes),
    (v_org_id, v_act_compraventa, 'Boleta predial al corriente', null, true, 'approved', 'ai', v_mercedes),
    (v_org_id, v_act_compraventa, 'Avalúo del inmueble', 'Recomendado para fijar el valor catastral, no siempre obligatorio.', false, 'approved', 'ai', v_mercedes),
    (v_org_id, v_act_compraventa, 'Constancia de no adeudo de agua', null, true, 'suggested', 'ai', null);

  insert into document_requirements (organization_id, act_type_id, label, description, is_required, status, source, created_by) values
    (v_org_id, v_act_testamento, 'Identificación oficial del testador', null, true, 'approved', 'ai', v_lucia),
    (v_org_id, v_act_testamento, 'Acta de nacimiento', null, true, 'approved', 'ai', v_lucia),
    (v_org_id, v_act_testamento, 'Relación de bienes', 'Listado de bienes que se incluirán en el testamento.', true, 'approved', 'admin', v_lucia);

  insert into document_requirements (organization_id, act_type_id, label, description, is_required, status, source, created_by) values
    (v_org_id, v_act_poder, 'Identificación oficial del otorgante', null, true, 'approved', 'ai', v_jorge),
    (v_org_id, v_act_poder, 'Acta constitutiva de la sociedad (si aplica)', null, true, 'approved', 'ai', v_jorge),
    (v_org_id, v_act_poder, 'Poder previo a revocar (si aplica)', null, false, 'approved', 'ai', v_jorge);

  -- Backfill: a los expedientes que ya existían de la primera siembra les
  -- copiamos los requisitos que apenas quedaron aprobados (el trigger
  -- seed_case_requirements sólo corre al CREAR un expediente nuevo).
  insert into case_requirement_status (case_id, requirement_id)
  select c.id, dr.id
  from cases c
  join document_requirements dr on dr.act_type_id = c.act_type_id and dr.status = 'approved'
  where c.organization_id = v_org_id
  on conflict (case_id, requirement_id) do nothing;

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, due_date, notes) values
    (v_org_id, v_dept_compraventas, v_act_compraventa, 'Compraventa Casa Jardines del Pedregal', 'in_progress', v_ana, current_date - interval '12 days', current_date + interval '15 days', 'Falta certificado de libertad de gravamen, ya se solicitó al RPP.')
  returning id into v_case_cv2;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_cv2, v_client_maria, 'vendedor'),
    (v_case_cv2, v_client_sergio, 'comprador');

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, due_date, notes) values
    (v_org_id, v_dept_compraventas, v_act_compraventa, 'Compraventa Local Comercial Polanco', 'open', v_pablo, current_date - interval '3 days', current_date + interval '20 days', null)
  returning id into v_case_cv3;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_cv3, v_client_comercializadora, 'vendedor'),
    (v_case_cv3, v_client_sergio, 'comprador');

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, due_date, notes) values
    (v_org_id, v_dept_corporativo, v_act_constitutiva, 'Constitución de sociedad — Grupo Vertex Tecnología', 'in_progress', v_jorge, current_date - interval '20 days', current_date + interval '8 days', 'Pendiente firma de socios extranjeros vía apoderado.')
  returning id into v_case_constitutiva;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_constitutiva, v_client_vertex, 'otorgante');

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, due_date, notes) values
    (v_org_id, v_dept_corporativo, v_act_poder, 'Poder especial para pleitos y cobranzas — Aceros del Bajío', 'closed', v_jorge, current_date - interval '60 days', current_date - interval '45 days', 'Firmado y entregado.')
  returning id into v_case_poder2;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_poder2, v_client_acerosbajio, 'otorgante');

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, due_date, notes) values
    (v_org_id, v_dept_testamentos, v_act_testamento, 'Testamento público abierto — Familia Castañeda', 'open', v_lucia, current_date - interval '5 days', current_date + interval '30 days', null)
  returning id into v_case_testamento2;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_testamento2, v_client_fernando, 'testador');

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, due_date, notes) values
    (v_org_id, v_dept_corporativo, v_act_fideicomiso, 'Fideicomiso de administración — Desarrollo Vista Real', 'open', v_jorge, current_date - interval '2 days', current_date + interval '25 days', null)
  returning id into v_case_fideicomiso;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_fideicomiso, v_client_vistareal, 'fideicomitente');

  insert into cases (organization_id, department_id, act_type_id, title, status, responsible_user_id, opened_at, notes) values
    (v_org_id, v_dept_general, v_act_donacion, 'Donación de inmueble entre padre e hija', 'cancelled', v_mercedes, current_date - interval '40 days', 'El cliente decidió no continuar con la donación por ahora.')
  returning id into v_case_donacion;
  insert into case_clients (case_id, client_id, role_in_case) values
    (v_case_donacion, v_client_alejandro, 'donante'),
    (v_case_donacion, v_client_diana, 'donataria');

  insert into case_comments (case_id, author_id, body) values
    (v_case_cv2, v_ana, 'Ya hablé con el Registro Público, el certificado de libertad de gravamen llega la próxima semana.'),
    (v_case_cv2, v_mercedes, 'Perfecto, en cuanto llegue avísame para revisar la escritura completa.'),
    (v_case_constitutiva, v_jorge, 'Los socios extranjeros firmarán vía poder notarial desde Madrid, ya está en trámite.'),
    (v_case_testamento2, v_lucia, 'Primera cita agendada, el testador quiere incluir a sus tres hijos como herederos.');

  raise notice 'Datos demo v2 insertados correctamente en la organización %', v_org_id;
end $$;
