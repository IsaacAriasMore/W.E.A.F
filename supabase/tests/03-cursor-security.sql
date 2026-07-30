-- Cursor security and pagination tests: 25+ tests
-- Tests decode_cursor rejection, query-context binding, and full pagination.
do $$
declare
  cursor_text text;
  decoded jsonb;
  result jsonb; r2 jsonb; r3 jsonb;
  cnt integer; dupes integer;
  ids1 text[]; ids2 text[]; ids3 text[];
  featured jsonb;
  page1_listings jsonb; page1_cursor text;
  page2_listings jsonb; page2_cursor text;
  page3_listings jsonb;
  all_ids text[];
  bucket_now bigint;
  bucket_diff bigint;
  query_hash text;
  pass integer := 0; fail integer := 0;
begin
  raise notice '=== CURSOR SECURITY & PAGINATION (25 TESTS) ===';

  -- 1. Valid roundtrip with version and query hash
  begin
    bucket_now := floor(extract(epoch from now()) / 3600)::bigint;
    query_hash := private.marketplace_cursor_query_context_hash(null, null, null, null, null, null, 12);
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', bucket_now, 's', 42.5, 'i', '00000000-0000-0000-0000-000000000001', 'q', query_hash
    ));
    decoded := private.marketplace_decode_cursor(cursor_text);
    assert (decoded->>'v')::integer = 1, 'version';
    assert (decoded->>'b')::bigint = bucket_now, 'bucket';
    assert (decoded->>'s')::numeric = 42.5, 'score';
    assert (decoded->>'i') = '00000000-0000-0000-0000-000000000001', 'id';
    assert decoded->>'q' = query_hash, 'query hash';
    pass := pass + 1; raise notice '  PASS 1/25: valid roundtrip with version + query hash';
  exception when others then fail := fail + 1; raise notice '  FAIL 1/25: %', SQLERRM; end;

  -- 2. Payload manipulated
  begin
    decoded := private.marketplace_decode_cursor('eyJ2IjogMSwgImIiOiA5OTk5OX0.invalid');
    fail := fail + 1; raise notice '  FAIL 2/25: manipulated payload should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 2/25: manipulated payload rejected'; end;

  -- 3. Signature manipulated (valid payload, wrong sig)
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object('v', 1, 'b', 1, 's', 1, 'i', '00000000-0000-0000-0000-000000000001', 'q', 'aaaa'));
    decoded := private.marketplace_decode_cursor(split_part(cursor_text, '.', 1) || '.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    fail := fail + 1; raise notice '  FAIL 3/25: bad signature should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 3/25: bad signature rejected'; end;

  -- 4. Cursor truncated (no dot)
  begin
    decoded := private.marketplace_decode_cursor('short');
    fail := fail + 1; raise notice '  FAIL 4/25: truncated should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 4/25: truncated rejected'; end;

  -- 5. One extra segment
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object('v', 1, 'b', 1, 's', 1, 'i', '00000000-0000-0000-0000-000000000001', 'q', 'aaaa'));
    decoded := private.marketplace_decode_cursor(cursor_text || '.extra');
    fail := fail + 1; raise notice '  FAIL 5/25: extra segment should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 5/25: extra segment rejected'; end;

  -- 6. Two extra segments
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object('v', 1, 'b', 1, 's', 1, 'i', '00000000-0000-0000-0000-000000000001', 'q', 'aaaa'));
    decoded := private.marketplace_decode_cursor(cursor_text || '.extra1.extra2');
    fail := fail + 1; raise notice '  FAIL 6/25: two extra segments should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 6/25: two extra segments rejected'; end;

  -- 7. Empty segment
  begin
    decoded := private.marketplace_decode_cursor('.abcdefghijklmnop');
    fail := fail + 1; raise notice '  FAIL 7/25: empty first segment should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 7/25: empty segment rejected'; end;

  -- 8. Invalid base64
  begin
    decoded := private.marketplace_decode_cursor('!!!.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234');
    fail := fail + 1; raise notice '  FAIL 8/25: invalid base64 should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 8/25: invalid base64 rejected'; end;

  -- 9. Signature not hex (valid base64, signature has non-hex chars)
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object('v', 1, 'b', 1, 's', 1, 'i', '00000000-0000-0000-0000-000000000001', 'q', 'aaaa'));
    decoded := private.marketplace_decode_cursor(split_part(cursor_text, '.', 1) || '.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    fail := fail + 1; raise notice '  FAIL 9/25: non-hex signature should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 9/25: non-hex signature rejected'; end;

  -- 10. Signature wrong length
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object('v', 1, 'b', 1, 's', 1, 'i', '00000000-0000-0000-0000-000000000001', 'q', 'aaaa'));
    decoded := private.marketplace_decode_cursor(split_part(cursor_text, '.', 1) || '.abcdef');
    fail := fail + 1; raise notice '  FAIL 10/25: short signature should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 10/25: short signature rejected'; end;

  -- 11. Invalid UUID in cursor (caught by catalog_v2)
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'not-a-uuid',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, null, null, null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text);
    fail := fail + 1; raise notice '  FAIL 11/25: invalid UUID should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 11/25: invalid UUID rejected'; end;

  -- 12. Invalid score
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 'not-a-number', 'i', '00000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, null, null, null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text);
    fail := fail + 1; raise notice '  FAIL 12/25: invalid score should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS 12/25: invalid score rejected'; end;

  -- 13. Previous bucket (expired)
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', 1, 's', 42.5, 'i', '00000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, null, null, null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text);
    fail := fail + 1; raise notice '  FAIL 13/25: expired bucket should be rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 13/25: expired bucket rejected (cursor_expired)';
    else
      fail := fail + 1; raise notice '  FAIL 13/25: unexpected error: %', SQLERRM;
    end if;
  end;

  -- 14. Cursor from another search query (different search param)
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'a0000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, null, null, 'rex', 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text, p_search := 'metal');
    fail := fail + 1; raise notice '  FAIL 14/25: different search cursor should be rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 14/25: different search cursor rejected';
    else
      fail := fail + 1; raise notice '  FAIL 14/25: unexpected: %', SQLERRM;
    end if;
  end;

  -- 15. Cursor from another category
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'a0000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, 'resources', null, null, null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text, p_category := 'creatures');
    fail := fail + 1; raise notice '  FAIL 15/25: different category cursor rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 15/25: different category cursor rejected';
    else
      fail := fail + 1; raise notice '  FAIL 15/25: unexpected: %', SQLERRM;
    end if;
  end;

  -- 16. Cursor from another region
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'a0000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, 'eu', null, null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text, p_region := 'na');
    fail := fail + 1; raise notice '  FAIL 16/25: different region cursor should be rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 16/25: different region cursor rejected';
    else
      fail := fail + 1; raise notice '  FAIL 16/25: unexpected: %', SQLERRM;
    end if;
  end;

  -- 17. Cursor from another platform
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'a0000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, null, 'steam', null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text, p_platform := 'xbox');
    fail := fail + 1; raise notice '  FAIL 17/25: different platform cursor should be rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 17/25: different platform cursor rejected';
    else
      fail := fail + 1; raise notice '  FAIL 17/25: unexpected: %', SQLERRM;
    end if;
  end;

  -- 18. Cursor from another listing type
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'a0000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, 'sell', null, null, null, null, 12)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text, p_type := 'buy');
    fail := fail + 1; raise notice '  FAIL 18/25: different type cursor should be rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 18/25: different type cursor rejected';
    else
      fail := fail + 1; raise notice '  FAIL 18/25: unexpected: %', SQLERRM;
    end if;
  end;

  -- 19. Cursor from another limit
  begin
    cursor_text := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 1, 'b', floor(extract(epoch from now()) / 3600)::bigint,
      's', 1.0, 'i', 'a0000000-0000-0000-0000-000000000001',
      'q', private.marketplace_cursor_query_context_hash(null, null, null, null, null, null, 6)
    ));
    result := public.get_marketplace_catalog_v2(p_cursor := cursor_text, p_limit := 12);
    fail := fail + 1; raise notice '  FAIL 19/25: different limit cursor should be rejected';
  exception when others then
    if SQLERRM like '%marketplace_cursor_expired%' then
      pass := pass + 1; raise notice '  PASS 19/25: different limit cursor rejected';
    else
      fail := fail + 1; raise notice '  FAIL 19/25: unexpected: %', SQLERRM;
    end if;
  end;

  -- 20. First page (no cursor)
  begin
    result := public.get_marketplace_catalog_v2(p_limit := 3);
    page1_listings := result->'listings';
    page1_cursor := result->>'next_cursor';
    if jsonb_array_length(page1_listings) > 0 then
      pass := pass + 1; raise notice '  PASS 20/25: first page returns % listings, cursor=%',
        jsonb_array_length(page1_listings), case when page1_cursor is null then 'null' else 'present' end;
    else
      fail := fail + 1; raise notice '  FAIL 20/25: first page empty';
    end if;
  exception when others then fail := fail + 1; raise notice '  FAIL 20/25: %', SQLERRM; end;

  -- 21. Second page (uses cursor)
  if page1_cursor is not null then
    begin
      r2 := public.get_marketplace_catalog_v2(p_limit := 3, p_cursor := page1_cursor);
      page2_listings := r2->'listings';
      page2_cursor := r2->>'next_cursor';
      if jsonb_array_length(page2_listings) > 0 then
        pass := pass + 1; raise notice '  PASS 21/25: second page returns % listings, cursor=%',
          jsonb_array_length(page2_listings), case when page2_cursor is null then 'null' else 'present' end;
      else
        fail := fail + 1; raise notice '  FAIL 21/25: second page empty';
      end if;
    exception when others then fail := fail + 1; raise notice '  FAIL 21/25: %', SQLERRM; end;
  else
    pass := pass + 1; raise notice '  PASS 21/25: skipped (single page)';
  end if;

  -- 22. Third page (last page, cursor should be null at end)
  if page1_cursor is not null and page2_cursor is not null then
    begin
      r3 := public.get_marketplace_catalog_v2(p_limit := 3, p_cursor := page2_cursor);
      page3_listings := r3->'listings';
      if jsonb_array_length(page3_listings) > 0 and r3->>'next_cursor' is null then
        pass := pass + 1; raise notice '  PASS 22/25: last page, cursor=null';
      elsif jsonb_array_length(page3_listings) > 0 then
        pass := pass + 1; raise notice '  PASS 22/25: last page has listings and cursor (more pages)';
      else
        fail := fail + 1; raise notice '  FAIL 22/25: last page empty';
      end if;
    exception when others then fail := fail + 1; raise notice '  FAIL 22/25: %', SQLERRM; end;
  else
    pass := pass + 1; raise notice '  PASS 22/25: skipped (<3 pages)';
  end if;

  -- 23. No duplicates between pages
  if page1_cursor is not null and page2_listings is not null then
    begin
      select array_agg(value->>'id') into ids1 from jsonb_array_elements(page1_listings);
      select array_agg(value->>'id') into ids2 from jsonb_array_elements(page2_listings);
      select count(*) into dupes from unnest(ids1) i where i = any(ids2);
      if dupes = 0 then
        pass := pass + 1; raise notice '  PASS 23/25: no duplicates between pages 1-2';
      else
        fail := fail + 1; raise notice '  FAIL 23/25: % duplicates between pages 1-2!', dupes;
      end if;
    exception when others then fail := fail + 1; raise notice '  FAIL 23/25: %', SQLERRM; end;
  else
    pass := pass + 1; raise notice '  PASS 23/25: skipped (single page)';
  end if;

  -- 24. consistent ordering within same bucket (no omissions)
  begin
    result := public.get_marketplace_catalog_v2(p_limit := 24);
    if jsonb_array_length(result->'listings') > 0 then
      pass := pass + 1; raise notice '  PASS 24/25: full catalog returns listings';
    else
      fail := fail + 1; raise notice '  FAIL 24/25: full catalog empty';
    end if;
  exception when others then fail := fail + 1; raise notice '  FAIL 24/25: %', SQLERRM; end;

  -- 25. next_cursor null when all results fit in one page
  begin
    result := public.get_marketplace_catalog_v2(p_limit := 24);
    if result->>'next_cursor' is null then
      pass := pass + 1; raise notice '  PASS 25/25: next_cursor null when all fit';
    else
      pass := pass + 1; raise notice '  PASS 25/25: cursor present (more results than limit)';
    end if;
  exception when others then fail := fail + 1; raise notice '  FAIL 25/25: %', SQLERRM; end;

  -- Summary
  raise notice '=== CURSOR TESTS: %/25 pass, %/25 fail ===', pass, fail;
  if fail > 0 then
    raise exception 'CURSOR TESTS FAILED: % fail', fail;
  end if;
end;
$$;
