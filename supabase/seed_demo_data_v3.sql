-- Documentos, generaciones de IA y transcripción de ejemplo. Requiere
-- haber corrido seed_demo_data_v2.sql y haber subido los archivos
-- correspondientes a Storage (ver conversación / historial de comandos).

do $$
declare
  v_case_poder uuid := '585e0051-471f-4856-ba09-e64a71c43329';
  v_case_constitutiva uuid := '69e804b8-ffa4-40f2-8eba-5a474e5ace27';
  v_case_cv2 uuid := '2c541619-d5ca-473f-810e-5d62bd688559';
  v_case_testamento uuid := '968bbb05-67da-4c13-affe-e05936405043';
  v_req_identificacion_cv uuid := 'bbeb6281-9cf1-41a6-8f8e-76d3ef4c2191';
  v_mercedes uuid := '2db62d70-d992-4a0c-aade-a66089f93884';
  v_jorge uuid := 'daa9a437-d128-4786-924b-765739c292e8';
  v_ana uuid := '5edcf3fe-ced5-4eb4-98e7-3c783fd0e9d2';
  v_lucia uuid := '5cc910ae-55c3-4384-9739-b534b6899758';
  v_tpl_poder uuid;
  v_doc_poder uuid;
  v_doc_constitutiva uuid;
  v_poder_text text := 'ESCRITURA NÚMERO 4,812. En la Ciudad de México, ante mí, Lic. Mercedes, Notaria Titular, comparece el señor JORGE RAMÍREZ en representación de ACEROS DEL BAJÍO S.A. DE C.V., quien otorga PODER GENERAL PARA PLEITOS Y COBRANZAS en los términos del artículo 2554 del Código Civil Federal.';
  v_constitutiva_text text := 'ESCRITURA NÚMERO 4,905. Se constituye GRUPO VERTEX TECNOLOGÍA, S.A.P.I. DE C.V. El capital social es de [FALTA: monto_capital_social], representado por [FALTA: numero_de_acciones] acciones. La administración estará a cargo de [FALTA: nombre_administrador_unico_o_consejo].';
begin
  select id into v_tpl_poder from templates where name = 'Poder general para pleitos y cobranzas' limit 1;

  -- Documento 1: poder ya aprobado (historial)
  insert into documents (case_id, document_type, version, review_status, storage_path, storage_path_pdf, generated_by_ai, uploaded_by, approved_by, approved_at)
  values (v_case_poder, 'Poder general para pleitos y cobranzas', 1, 'approved',
          v_case_poder || '/poder_aceros.docx', v_case_poder || '/poder_aceros.pdf',
          true, v_jorge, v_mercedes, now() - interval '44 days')
  returning id into v_doc_poder;

  insert into ai_generations (case_id, document_id, template_id, input_data, prompt_used, output, approval_status, requested_by, approved_by, approved_at)
  values (v_case_poder, v_doc_poder, v_tpl_poder,
          jsonb_build_object('otorgante', 'Aceros del Bajío S.A. de C.V.', 'apoderado', 'Jorge Ramírez'),
          'Genera un poder general para pleitos y cobranzas a partir de la plantilla y los datos del expediente.',
          v_poder_text, 'approved', v_jorge, v_mercedes, now() - interval '44 days');

  insert into audit_log (actor_id, action, entity_type, entity_id, metadata) values
    (v_jorge, 'ai_generate', 'ai_generations', v_doc_poder, jsonb_build_object('case_id', v_case_poder, 'document_id', v_doc_poder)),
    (v_mercedes, 'ai_approve', 'documents', v_doc_poder, jsonb_build_object('case_id', v_case_poder, 'decision', 'approved'));

  -- Documento 2: constitutiva pendiente de revisión (cola de aprobación)
  insert into documents (case_id, document_type, version, review_status, storage_path, storage_path_pdf, generated_by_ai, uploaded_by)
  values (v_case_constitutiva, 'Acta Constitutiva', 1, 'ai_draft',
          v_case_constitutiva || '/constitutiva_vertex.docx', v_case_constitutiva || '/constitutiva_vertex.pdf',
          true, v_jorge)
  returning id into v_doc_constitutiva;

  insert into ai_generations (case_id, document_id, template_id, input_data, prompt_used, output, approval_status, requested_by)
  values (v_case_constitutiva, v_doc_constitutiva, null,
          jsonb_build_object('sociedad', 'Grupo Vertex Tecnología S.A.P.I. de C.V.'),
          'Genera un acta constitutiva a partir de los datos del expediente; faltan datos de capital social y administración.',
          v_constitutiva_text, 'pending', v_jorge);

  insert into audit_log (actor_id, action, entity_type, entity_id, metadata) values
    (v_jorge, 'ai_generate', 'ai_generations', v_doc_constitutiva, jsonb_build_object('case_id', v_case_constitutiva, 'document_id', v_doc_constitutiva));

  -- Documento 3: identificación subida manualmente, satisface un requisito
  -- del checklist (el trigger fulfill_case_requirement la marca cumplida).
  insert into documents (case_id, document_type, version, review_status, storage_path, generated_by_ai, uploaded_by, requirement_id)
  values (v_case_cv2, 'identificacion', 1, 'approved', v_case_cv2 || '/identificacion_sergio.pdf', false, v_ana, v_req_identificacion_cv);

  -- Transcripción de ejemplo (acta de nacimiento escaneada)
  insert into transcriptions (case_id, source_storage_path, status, extracted_text, requested_by)
  values (v_case_testamento, v_case_testamento || '/acta_nacimiento_castaneda.pdf', 'completed',
          jsonb_build_array(jsonb_build_object('page', 1, 'text',
            'ACTA DE NACIMIENTO. Registro Civil de la Ciudad de México, Libro 3, Acta número 00512. Nombre: FERNANDO CASTAÑEDA RUIZ. Fecha de nacimiento: 30 de noviembre de 1955. Lugar de nacimiento: Ciudad de México.')),
          v_lucia);

  raise notice 'Documentos, generaciones de IA y transcripción insertados correctamente.';
end $$;
