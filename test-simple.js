const axios = require('axios');

const testManualAccountCreation = async () => {
  try {
    console.log('🔍 Testing manual account creation system...');
    
    // First, we need an admin account to create other accounts
    console.log('⚠️  Note: This test requires an existing admin account');
    console.log('   Please ensure you have an admin account with:');
    console.log('   Email: admin@eventsphere.com');
    console.log('   Password: admin123');
    
    // Test admin login
    console.log('\n📤 Testing admin login...');
    const adminLogin = await axios.post('z/api/auth/login', {
      email: 'admin@eventsphere.com',
      password: 'admin123'
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful');
    
    // Test creating a faculty account
    console.log('\n📤 Testing faculty account creation...');
    const timestamp = Date.now();
    const facultyData = {
      fullName: `Test Faculty ${timestamp}`,
      email: `faculty${timestamp}@example.com`,
      password: "faculty123",
      department: "Computer Science",
      role: "faculty"
    };
    
    const facultyResponse = await axios.post('http://localhost:5001/api/auth/create-account', facultyData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Faculty account created:', facultyResponse.data);
    
    // Test creating a participant account
    console.log('\n📤 Testing participant account creation...');
    const participantData = {
      fullName: `Test Participant ${timestamp}`,
      email: `participant${timestamp}@example.com`,
      password: "participant123",
      department: "Computer Science",
      role: "participant",
      year: "2nd",
      semester: "3rd",
      dateOfBirth: "2000-01-01T00:00:00.000Z",
      phoneNumber: "1234567890",
      scholarNumber: `TEST${timestamp}`
    };
    
    const participantResponse = await axios.post('http://localhost:5001/api/auth/create-account', participantData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Participant account created:', participantResponse.data);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('   Manual account creation system is working properly.');
    
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
};

testManualAccountCreation();
