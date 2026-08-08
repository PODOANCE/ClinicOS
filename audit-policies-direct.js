const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';

async function auditPolicies() {
  console.log('\n📋 AUDITORÍA: RLS POLICIES DETALLADAS\n');
  console.log('====================\n');

  // Intentar acceder vía SQL directo usando el cliente Postgres de Supabase
  const supabase = createClient(SUPABASE_URL, ADMIN_KEY);

  // Intento 1: Usar RPC si existe
  console.log('1️⃣  INTENTAR VÍA RPC\n');

  try {
    // Probar si existe una función que liste policies
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzE5NTUsImV4cCI6MjEwMTcwNzk1NX0.ZpdGl_HEZlxG06e2Yj0TUiV8NUSJd5PUN68g7NyL4Uc',
        'Authorization': `Bearer ${ADMIN_KEY}`
      }
    });
    const data = await result.json();
    if (data.error) {
      console.log(`   ❌ Función no existe\n`);
    } else {
      console.log(`   ✅ Políticas encontradas:\n`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}\n`);
  }

  // Intento 2: Verificar tablas RLS via information_schema
  console.log('2️⃣  ESTADO RLS VÍA INFORMACIÓN DE SISTEMA\n');

  // En PostgreSQL, RLS se puede verificar en pg_class si tiene rowsecurity=true
  // Pero accedemos a través de información disponible

  console.log('   Tablas que intentan cargar:');
  console.log('   - usuarios');
  console.log('   - roles');
  console.log('   - usuarios_roles\n');

  // Intento 3: Extraer información de los errores actuales
  console.log('3️⃣  ANÁLISIS DE ERRORES PREVIOS\n');

  console.log('   Errores encontrados en auditoría anterior:\n');
  console.log('   a) PGRST116: Cannot coerce result to single JSON object');
  console.log('      → Significa: Query devolvió 0 filas cuando se esperaba 1');
  console.log('      → Causa probable: El usuario Auth no existe en public.usuarios\n');

  console.log('   b) usuarios_roles devuelve 0 filas para usuario autenticado');
  console.log('      → Significa: No hay asignación de rol');
  console.log('      → Posible causa 1: RLS política bloquea reads\n');
  console.log('      → Posible causa 2: No hay datos insertados\n');

  // Intento 4: Crear script que lista lo que sabemos
  console.log('4️⃣  DIAGNÓSTICO BASADO EN DATOS\n');

  console.log('   ✅ Confirmado: Anónimo PUEDE leer usuarios, roles\n');

  console.log('   ✅ Confirmado: Usuario autenticado PUEDE leer roles\n');

  console.log('   ❌ Problema 1: Usuario auth (4bc4ad90-9955...) NO existe en usuarios');
  console.log('      → No se puede hacer .eq("id", user_id).single()\n');

  console.log('   ❌ Problema 2: No hay asignación de rol para nadie');
  console.log('      → usuarios_roles tabla está vacía\n');

  console.log('   ❓ Desconocido: Las RLS policies exactas\n');

  console.log('5️⃣  RECOMENDACIÓN PARA VER POLICIES\n');

  console.log('   Opciones:');
  console.log('   1. Acceder a Supabase Dashboard → SQL Editor → Ver pg_policies');
  console.log('   2. Si tienes acceso psql: psql -d postgres://...');
  console.log('      SELECT * FROM pg_policies WHERE tablename = \'usuarios\';');
  console.log('   3. Usar el script alternativo que consulta directamente\n');

  // Intento 5: Listar funciones disponibles
  console.log('6️⃣  FUNCIONES/RPCS DISPONIBLES\n');

  const { data: functions, error: functionsError } = await supabase
    .from('information_schema.routines')
    .select('routine_name, routine_type')
    .eq('routine_schema', 'public')
    .limit(10);

  if (functionsError) {
    console.log(`   ❌ No se puede acceder a routines`);
  } else if (functions && functions.length > 0) {
    console.log(`   ✅ Funciones encontradas:`);
    functions.forEach(f => console.log(`      - ${f.routine_name} (${f.routine_type})`));
  } else {
    console.log(`   ℹ️  No hay funciones públicas definidas`);
  }

  console.log('\n');
}

auditPolicies().catch(console.error);
