const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

async function auditAuthenticatedQueries() {
  console.log('\n📋 AUDITORÍA: QUERIES CON SESIÓN AUTENTICADA\n');
  console.log('====================\n');

  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  // 1. Login con el usuario de prueba
  console.log('1️⃣  INTENTAR LOGIN\n');

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin.test@clinicos.local',
    password: 'TestAdmin123!@#',
  });

  if (authError) {
    console.log(`   ❌ Login fallido: ${authError.message}`);
    return;
  }

  console.log(`   ✅ Login exitoso`);
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Email: ${authData.user.email}\n`);

  // 2. Queries con sesión autenticada
  console.log('2️⃣  QUERIES CON SESIÓN AUTENTICADA\n');

  // Query 1: Obtener el usuario propio
  console.log('   a) SELECT del usuario propio (usuarios)\n');
  const { data: myUser, error: myUserError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (myUserError) {
    console.log(`      ❌ Error: ${myUserError.message}`);
    console.log(`      Código: ${myUserError.code}`);
  } else {
    console.log(`      ✅ Éxito`);
    console.log(`      Usuario encontrado:`, myUser?.email || 'N/A');
  }
  console.log('');

  // Query 2: Obtener roles del usuario
  console.log('   b) SELECT de usuarios_roles\n');
  const { data: userRoles, error: userRolesError } = await supabase
    .from('usuarios_roles')
    .select('*')
    .eq('usuario_id', authData.user.id);

  if (userRolesError) {
    console.log(`      ❌ Error: ${userRolesError.message}`);
    console.log(`      Código: ${userRolesError.code}`);
  } else {
    console.log(`      ✅ Éxito: ${userRoles?.length || 0} roles`);
    if (userRoles && userRoles.length > 0) {
      userRoles.forEach(ur => console.log(`         - rol_id: ${ur.rol_id}`));
    }
  }
  console.log('');

  // Query 3: Obtener roles (general)
  console.log('   c) SELECT de roles\n');
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*');

  if (rolesError) {
    console.log(`      ❌ Error: ${rolesError.message}`);
    console.log(`      Código: ${rolesError.code}`);
  } else {
    console.log(`      ✅ Éxito: ${roles?.length || 0} roles`);
    if (roles && roles.length > 0) {
      roles.forEach(r => console.log(`         - ${r.nombre}`));
    }
  }
  console.log('');

  // Query 4: Join usuarios + usuarios_roles + roles
  console.log('   d) JOIN: usuarios + usuarios_roles + roles\n');
  const { data: joined, error: joinError } = await supabase
    .from('usuarios_roles')
    .select(`
      usuario_id,
      rol_id,
      roles (
        id,
        nombre,
        areas_permitidas
      )
    `)
    .eq('usuario_id', authData.user.id);

  if (joinError) {
    console.log(`      ❌ Error: ${joinError.message}`);
    console.log(`      Código: ${joinError.code}`);
  } else {
    console.log(`      ✅ Éxito: ${joined?.length || 0} asignaciones de rol`);
    if (joined && joined.length > 0) {
      joined.forEach(j => {
        console.log(`         - Rol: ${j.roles?.nombre || 'N/A'}`);
        console.log(`           Areas: ${Object.keys(j.roles?.areas_permitidas || {}).join(', ') || 'ninguna'}`);
      });
    }
  }
  console.log('');

  // 3. Verificar qué está en la BD
  console.log('3️⃣  ESTADO EN BD\n');

  console.log('   a) ¿Existe el usuario en public.usuarios?\n');
  const { data: allUsers, error: allUsersError } = await supabase
    .from('usuarios')
    .select('id, email')
    .limit(100);

  if (allUsersError) {
    console.log(`      ❌ Error: ${allUsersError.message}`);
  } else {
    const found = allUsers?.find(u => u.id === authData.user.id);
    if (found) {
      console.log(`      ✅ SÍ existe - ${found.email}`);
    } else {
      console.log(`      ❌ NO existe - el usuario Auth (${authData.user.id}) no está en usuarios`);
      console.log(`      Usuarios en BD: ${allUsers?.map(u => u.email).join(', ')}`);
    }
  }
  console.log('');

  console.log('   b) ¿Existen asignaciones de rol para este usuario?\n');
  const { data: existingRoles, error: existingRolesError } = await supabase
    .from('usuarios_roles')
    .select('*');

  if (existingRolesError) {
    console.log(`      ❌ Error: ${existingRolesError.message}`);
  } else {
    console.log(`      Total de usuarios_roles en BD: ${existingRoles?.length || 0}`);
    const userHasRoles = existingRoles?.filter(ur => ur.usuario_id === authData.user.id);
    if (userHasRoles && userHasRoles.length > 0) {
      console.log(`      ✅ Este usuario tiene ${userHasRoles.length} rol(es)`);
    } else {
      console.log(`      ❌ Este usuario NO tiene ningún rol asignado`);
      if (existingRoles && existingRoles.length > 0) {
        console.log(`      Roles asignados a otros usuarios:`);
        existingRoles.forEach(ur => console.log(`         - usuario_id: ${ur.usuario_id.slice(0, 8)}... rol_id: ${ur.rol_id.slice(0, 8)}...`));
      }
    }
  }

  console.log('\n');
}

auditAuthenticatedQueries().catch(console.error);
