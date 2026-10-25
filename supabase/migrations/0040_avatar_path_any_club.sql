-- Recov · 0040 · Multi-plantel: la foto de perfil puede estar en la carpeta de cualquier plantel
-- profiles_avatar_path_format exigía {profiles.club_id}/{id}/…, así que set_my_avatar con
-- p_club_id de un plantel secundario (0039) siempre fallaba. Ahora la carpeta del plantel
-- puede ser cualquier uuid; set_my_avatar sigue exigiendo que la persona sea miembro de
-- ese plantel y que el archivo exista, y la segunda carpeta sigue siendo su propio id.
-- Los usuarios no editan profiles directo (solo por funciones), así que no se abre nada.
alter table public.profiles drop constraint profiles_avatar_path_format;
alter table public.profiles add constraint profiles_avatar_path_format
  check (avatar_path ~ ('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' || id::text || '/.+'));
