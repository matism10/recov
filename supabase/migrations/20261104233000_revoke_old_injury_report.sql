-- Registro de lesión v2 · después del deploy de #86: las versiones anteriores de
-- report_injury (tipo libre, 1 a 5 documentos) y complete_injury_report quedan sin
-- permisos. La app usa solo las versiones con zona (20261104230200).
-- No se borran (DROP): quedan en la base sin que nadie las pueda llamar.

revoke execute on function public.report_injury(text, date, integer, text, text, jsonb, text)
  from public, anon, authenticated;

revoke execute on function public.complete_injury_report(uuid, text, integer, text, text, jsonb)
  from public, anon, authenticated;
