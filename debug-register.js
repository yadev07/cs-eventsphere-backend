const axios = require('axios');

const testManualAccountCreation = async () => {
  try {
    console.log('🔍 Testing manual account creation endpoint...');
    
    // First, we need an admin account to create other accounts
    console.log('⚠️  Note: This test requires an existing admin account');
    console.log('   Please ensure you have an admin account with:');
    console.log('   Email: admin@eventsphere.com');
    console.log('   Password: admin123');
    
    // Test admin login
    console.log('\n📤 Testing admin login...');
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@eventsphere.com',
      password: 'admin123'
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful');
    
    // Test creating a participant account
    console.log('\n📤 Testing participant account creation...');
    const testUser = {
      fullName: "Test User",
      email: "test@example.com",
      password: "password123",
      department: "Computer Science",
      role: "participant",
      year: "2nd",
      semester: "3rd",
      dateOfBirth: "2000-01-01T00:00:00.000Z",
      phoneNumber: "1234567890",
      scholarNumber: "TEST001"
    };

    console.log('📤 Sending account creation data:', testUser);
    
    const response = await axios.post('http://localhost:5001/api/auth/create-account', testUser, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Account creation successful:', response.data);
  } catch (error) {
    console.error('❌ Account creation failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the server running?');
    } else {
      console.error('Error:', error.message);
    }
  }
};

// Test server connection first
const testServerConnection = async () => {
  try {
    console.log('🔍 Testing server connection...');
    const response = await axios.get('http://localhost:5001/api/auth/me');
    console.log('✅ Server is running');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server is not running. Start it with: npm start');
    } else {
      console.log('✅ Server is running (auth endpoint responded)');
    }
  }
};

const runTests = async () => {
  await testServerConnection();
  console.log('\n' + '='.repeat(50) + '\n');
  await testManualAccountCreation();
};

runTests();
