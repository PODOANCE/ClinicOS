const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';

async function check() {
  const supabase = createClient(SUPABASE_URL, ADMIN_KEY);
  
  console.log('Buscando admin.test@clinicos.local...\n');
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', 'admin.test@clinicos.local');

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('✅ Usuario encontrado:');
    console.log('   ID:', data[0].id);
    console.log('   Email:', data[0].email);
    console.log('   Nombre:', data[0].nombre);
  } else {
    console.log('❌ Usuario NO encontrado en BD');
    console.log('\nIntentando insertar...\n');
    
    const { data: insertResult, error: insertError } = await supabase
      .from('usuarios')
      .insert([{
        id: '4bc4ad90-9955-4593-ac67-e71b323a1bfd',
        email: 'admin.test@clinicos.local',
        nombre: 'admin.test',
        activo: true,
        centro_id: '12345678-1234-5678-1234-567812345678',
        created_by: '00000000-0000-0000-0000-000000000000'
      }]);

    if (insertError) {
      console.log('❌ Error en insert:', insertError.message);
    } else {
      console.log('✅ Usuario insertado exitosamente');
    }
  }

  // Verificar roles
  console.log('\n\nVerificando roles...\n');
  
  const { data: roles, error: rolesError } = await supabase
    .from('usuarios_roles')
    .select('*')
    .eq('usuario_id', '4bc4ad90-9955-4593-ac67-e71b323a1bfd');

  if (rolesError) {
    console.log('❌ Error:', rolesError.message);
  } else if (roles && roles.length > 0) {
    console.log('✅ Usuario tiene roles:');
    roles.forEach(r => console.log('   -', r.rol_id));
  } else {
    console.log('❌ Usuario sin roles asignados. Asignando...\n');
    
    const { error: assignError } = await supabase
      .from('usuarios_roles')
      .insert([{
        usuario_id: '4bc4ad90-9955-4593-ac67-e71b323a1bfd',
        rol_id: '97736608-999c-4771-af7f-0326200221e3'
      }]);

    if (assignError) {
      console.log('❌ Error asignando rol:', assignError.message);
    } else {
      console.log('✅ Rol asignado exitosamente');
    }
  }
}

check().catch(console.error);
