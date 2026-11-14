-- Day 12: the evidence ledger is written by the server. Users may only accept/reject a finding or edit its explanation.
revoke insert, update, delete on public.dna_findings from authenticated;
grant update (explanation, status) on public.dna_findings to authenticated;

create function private.dna_finding_user_edit() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if new.explanation is distinct from old.explanation then
      if btrim(new.explanation) = '' then raise exception 'explanation_required'; end if;
      if new.status <> 'rejected' then new.status := 'edited'; end if;
    elsif new.status = 'edited' and old.status <> 'edited' then
      raise exception 'invalid_status';
    end if;
  end if;
  return new;
end $$;
create trigger dna_findings_user_edit before update on public.dna_findings for each row execute function private.dna_finding_user_edit();
revoke all on function private.dna_finding_user_edit() from public, anon, authenticated;
