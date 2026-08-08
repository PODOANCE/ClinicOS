const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';

const testUser = {
  email: 'admin.test@clinicos.local',
  password: 'TestAdmin123!@#',
  email_confirm: true
};

async function createAuthUser() {
  try {
    console.log('\n🔧 Creando usuario en Auth...\n');

    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_KEY}`,
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
        email_confirm: testUser.email_confirm,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error.error_description || error.message);
      return;
    }

    const data = await response.json();
    console.log(`✅ Usuario creado exitosamente\n`);
    console.log(`📧 Email: ${testUser.email}`);
    console.log(`🔑 Password: ${testUser.password}\n`);
    console.log(`ID: ${data.id}\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createAuthUser();
