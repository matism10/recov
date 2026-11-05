-- Registro de lesión v2 · zona y lateralidad de la lesión, y borrar un documento
-- propio antes de la revisión.
--
-- 1. injuries.body_zone e injuries.laterality: opcionales (las lesiones antiguas y
--    las que marca el kine no tienen zona), pero van juntas: ambas nulas o ambas
--    con valor.
-- 2. delete_own_draft_document(document_id): el jugador quita un documento suyo
--    mientras está en 'borrador' y la lesión no tiene reviewed_at. Devuelve el
--    storage_path para que el servidor borre el archivo de Storage (el jugador no
--    tiene DELETE sobre el bucket medical-docs). No se toca ninguna política RLS.

alter table public.injuries
  add column body_zone  public.body_zone,
  add column laterality public.injury_laterality,
  add constraint injuries_body_zone_laterality_together
    check ((body_zone is null) = (laterality is null));

create function public.delete_own_draft_document(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  doc public.documents%rowtype;
  inj public.injuries%rowtype;
begin
  if uid is null then
    raise exception 'No autorizado';
  end if;

  select * into doc from public.documents where id = p_document_id for update;
  -- Solo documentos propios: jugador confirmado del plantel del documento y su ficha.
  if not found
     or not private.has_role(doc.club_id, 'jugador')
     or doc.player_id is distinct from private.current_player_id(doc.club_id) then
    raise exception 'Documento no encontrado';
  end if;

  if doc.status <> 'borrador' or doc.injury_id is null then
    raise exception 'El kinesiólogo ya revisó este documento: ya no puedes cambiarlo';
  end if;

  -- Bloquea la lesión para que no se revise mientras se borra.
  select * into inj from public.injuries
   where id = doc.injury_id and club_id = doc.club_id
   for update;
  if not found
     or inj.reviewed_at is not null
     or inj.status not in ('en_evaluacion', 'activa') then
    raise exception 'El kinesiólogo ya revisó esta lesión: ya no puedes cambiar sus documentos';
  end if;

  delete from public.documents where id = p_document_id;

  return doc.storage_path;
end $$;

revoke all on function public.delete_own_draft_document(uuid) from public, anon;
grant execute on function public.delete_own_draft_document(uuid) to authenticated;
