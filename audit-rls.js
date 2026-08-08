const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc';

async function auditRLS() {
  console.log('\n📋 AUDITORÍA RLS POLICIES\n');
  console.log('====================\n');

  // 1. Conectar con admin key (sin RLS)
  const supabaseAdmin = createClient(SUPABASE_URL, ADMIN_KEY);

  console.log('1️⃣  RLS POLICIES DEFINIDAS\n');
  const { data: policies, error: policiesError } = await supabaseAdmin
    .from('pg_policies')
    .select('schemaname, tablename, policyname, qual, with_check')
    .in('tablename', ['usuarios', 'roles', 'usuarios_roles'])
    .order('tablename');

  if (policiesError) {
    console.log('   ❌ No se puede acceder a pg_policies directamente');
    console.log('   (Intentando método alternativo...)\n');
  } else if (policies) {
    policies.forEach(p => {
      console.log(`   📌 ${p.tablename}.${p.policyname}`);
      if (p.qual) console.log(`      SELECT: ${p.qual}`);
      if (p.with_check) console.log(`      INSERT/UPDATE: ${p.with_check}`);
    });
  }

  // 2. Ver schema de las tablas
  console.log('\n2️⃣  SCHEMA DE TABLAS\n');

  const tables = ['usuarios', 'roles', 'usuarios_roles'];
  for (const tableName of tables) {
    const { data: columns, error } = await supabaseAdmin
      .from(`information_schema.columns`)
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);

    if (error) {
      console.log(`   ❌ Error en tabla ${tableName}: ${error.message}`);
    } else if (columns && columns.length > 0) {
      console.log(`   📊 ${tableName}`);
      columns.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type}${col.is_nullable === 'NO' ? ', NOT NULL' : ''})`);
      });
    }
    console.log('');
  }

  // 3. Verificar RLS enable en tablas
  console.log('\n3️⃣  RLS HABILITADO EN TABLAS\n');

  const { data: tables_info, error: tables_error } = await supabaseAdmin
    .from('information_schema.tables')
    .select('table_name, table_schema')
    .eq('table_schema', 'public')
    .in('table_name', ['usuarios', 'roles', 'usuarios_roles']);

  if (tables_error) {
    console.log('   ❌ No se puede acceder a information_schema.tables');
  } else if (tables_info) {
    // No podemos ver RLS status desde information_schema, pero lo intentamos
    console.log('   ⚠️  Use Supabase Dashboard para verificar RLS enable status');
  }

  // 4. Probar queries como usuario anónimo (lo que hace el navegador)
  console.log('\n4️⃣  PRUEBA: QUERY COMO USUARIO ANÓNIMO\n');

  const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

  // Sin sesión autenticada
  console.log('   a) Sin sesión autenticada:\n');

  const { data: usersNoAuth, error: noAuthError } = await supabaseAnon
    .from('usuarios')
    .select('*');

  if (noAuthError) {
    console.log(`      ❌ usuarios: ${noAuthError.message} (${noAuthError.code})`);
  } else {
    console.log(`      ✅ usuarios: ${usersNoAuth?.length || 0} filas`);
  }

  const { data: rolesNoAuth, error: rolesNoAuthError } = await supabaseAnon
    .from('roles')
    .select('*');

  if (rolesNoAuthError) {
    console.log(`      ❌ roles: ${rolesNoAuthError.message} (${rolesNoAuthError.code})`);
  } else {
    console.log(`      ✅ roles: ${rolesNoAuth?.length || 0} filas`);
  }

  const { data: ur_NoAuth, error: ur_NoAuthError } = await supabaseAnon
    .from('usuarios_roles')
    .select('*');

  if (ur_NoAuthError) {
    console.log(`      ❌ usuarios_roles: ${ur_NoAuthError.message} (${ur_NoAuthError.code})\n`);
  } else {
    console.log(`      ✅ usuarios_roles: ${ur_NoAuth?.length || 0} filas\n`);
  }

  // 5. Datos con admin key (para comparar)
  console.log('   b) Con admin key (sin RLS):\n');

  const { data: usersAdmin, error: adminError } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, nombre, activo');

  if (adminError) {
    console.log(`      ❌ usuarios: ${adminError.message}`);
  } else {
    console.log(`      ✅ usuarios: ${usersAdmin?.length || 0} filas`);
    if (usersAdmin) {
      usersAdmin.forEach(u => console.log(`         - ${u.email}`));
    }
  }

  console.log('\n');
}

auditRLS().catch(console.error);
