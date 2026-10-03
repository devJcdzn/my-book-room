import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401 });

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceRoleKey) {
    return new Response('Server configuration unavailable', { status: 500 });
  }

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response('Unauthorized', { status: 401 });

  const adminClient = createClient(url, serviceRoleKey);
  // Storage objects must be removed before deleting their owning auth user.
  for (const bucket of ['profile-avatars', 'room-photos']) {
    while (true) {
      const { data: files, error: listError } = await adminClient.storage.from(bucket).list(user.id, { limit: 100 });
      if (listError) return new Response('Avatar cleanup failed', { status: 500 });
      if (!files?.length) break;
      const { error: removeError } = await adminClient.storage.from(bucket).remove(files.map(file => `${user.id}/${file.name}`));
      if (removeError) return new Response('Avatar cleanup failed', { status: 500 });
    }
  }
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) return new Response('Account deletion failed', { status: 500 });

  return Response.json({ deleted: true });
});
