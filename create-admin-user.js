const SUPABASE_URL = 'https://gyusgttlwjpnwchmrjih.supabase.co';
const ADMIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXNndHRsd2pwbndjaG1yamloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEzMTk1NSwiZXhwIjoyMTAxNzA3OTU1fQ.WI8WJwz51mmdVYZmjre1A0O-I9Yip_F_0HM0vFZoRds';

const EMAIL = `admin.phase1.${Date.now()}@clinic.local`;
const PASSWORD = 'AdminPhase1!';

async function createAdminUser() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      {
        method: 'POST',
        headers: {
          'apikey': ADMIN_KEY,
          'Authorization': `Bearer ${ADMIN_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: EMAIL,
          password: PASSWORD,
          email_confirm: true,
        }),
      }
    );

    const data = await response.json();

    if (response.ok && data.user) {
      console.log('\n✅ Usuario admin creado exitosamente\n');
      console.log('📧 Email:', EMAIL);
      console.log('🔑 Contraseña:', PASSWORD);
      console.log('🆔 User ID:', data.user.id);
      console.log('\n⚠️  Guarda este User ID\n');

      return data.user.id;
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
      console.error('❌ Error:', data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createAdminUser();
