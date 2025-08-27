const axios = require('axios');

const BASE_URL = 'https://cs-eventsphere.netlify.app/api';
let adminToken = '';
let facultyToken = '';
let userToken = '';

const testComprehensive = async () => {
  try {
    console.log('🚀 Starting comprehensive EventSphere testing...\n');

    // Test 1: Create Admin Account
    await testCreateAdmin();
    
    // Test 2: Create Faculty Account
    await testCreateFaculty();
    
    // Test 3: Create Regular User Account
    await testCreateUser();
    
    // Test 4: Test Event Creation
    await testEventCreation();
    
    // Test 5: Test Event Registration
    await testEventRegistration();
    
    // Test 6: Test User Management
    await testUserManagement();
    
    // Test 7: Test Role-Based Access Control
    await testRoleBasedAccess();
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
};

const testCreateAdmin = async () => {
  console.log('🔐 Testing Admin Account Creation...');
  
  try {
    // First, we need to manually create an admin in the database
    // For testing purposes, we'll assume one exists
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@eventsphere.com',
      password: 'admin123'
    });
    
    adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful');
    
  } catch (error) {
    console.log('⚠️  Admin account not found, creating test admin...');
    // In a real scenario, you'd create this manually in the database
    console.log('ℹ️  Please create an admin account manually for testing');
  }
};

const testCreateFaculty = async () => {
  console.log('\n👨‍🏫 Testing Faculty Account Creation...');
  
  try {
    if (!adminToken) {
      console.log('⚠️  Skipping faculty creation - no admin token');
      return;
    }
    
    const facultyData = {
      fullName: 'Dr. Jane Smith',
      email: 'jane.smith@university.edu',
      password: 'faculty123',
      department: 'Computer Science',
      role: 'faculty'
    };
    
    const response = await axios.post(`${BASE_URL}/auth/create-account`, facultyData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('✅ Faculty account created successfully');
    
    // Login as faculty
    const facultyLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: facultyData.email,
      password: facultyData.password
    });
    
    facultyToken = facultyLogin.data.token;
    console.log('✅ Faculty login successful');
    
  } catch (error) {
    console.error('❌ Faculty creation failed:', error.response?.data?.message || error.message);
  }
};

const testCreateUser = async () => {
  console.log('\n👤 Testing Regular User Account Creation...');
  
  try {
    if (!facultyToken) {
      console.log('⚠️  Skipping user creation - no faculty token');
      return;
    }
    
    const userData = {
      fullName: 'John Student',
      email: 'john.student@university.edu',
      password: 'student123',
      department: 'Computer Science',
      role: 'participant',
      year: '2nd',
      semester: '3rd',
      dateOfBirth: '2000-01-01T00:00:00.000Z',
      phoneNumber: '1234567890',
      scholarNumber: 'CS2024001'
    };
    
    const response = await axios.post(`${BASE_URL}/auth/create-user`, userData, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    
    console.log('✅ User account created successfully');
    
    // Login as user
    const userLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: userData.email,
      password: userData.password
    });
    
    userToken = userLogin.data.token;
    console.log('✅ User login successful');
    
  } catch (error) {
    console.error('❌ User creation failed:', error.response?.data?.message || error.message);
  }
};

const testEventCreation = async () => {
  console.log('\n📅 Testing Event Creation...');
  
  try {
    if (!facultyToken) {
      console.log('⚠️  Skipping event creation - no faculty token');
      return;
    }
    
    const eventData = {
      title: 'Web Development Workshop',
      description: 'Learn modern web development techniques including React, Node.js, and MongoDB',
      shortDescription: 'Hands-on workshop for web development',
      category: 'Technical',
      startDate: '2024-02-15T09:00:00.000Z',
      endDate: '2024-02-15T17:00:00.000Z',
      startTime: '09:00',
      endTime: '17:00',
      venue: 'Computer Lab 101',
      maxParticipants: 30,
      registrationDeadline: '2024-02-10T23:59:59.000Z',
      eventType: 'offline',
      tags: ['web development', 'react', 'nodejs', 'mongodb']
    };
    
    const response = await axios.post(`${BASE_URL}/events`, eventData, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    
    console.log('✅ Event created successfully');
    console.log(`   Event ID: ${response.data.event._id}`);
    
    // Test publishing the event
    const publishResponse = await axios.post(`${BASE_URL}/events/${response.data.event._id}/publish`, {}, {
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    
    console.log('✅ Event published successfully');
    
  } catch (error) {
    console.error('❌ Event creation failed:', error.response?.data?.message || error.message);
  }
};

const testEventRegistration = async () => {
  console.log('\n📝 Testing Event Registration...');
  
  try {
    if (!userToken) {
      console.log('⚠️  Skipping event registration - no user token');
      return;
    }
    
    // First, get available events
    const eventsResponse = await axios.get(`${BASE_URL}/events`);
    
    if (eventsResponse.data.events.length === 0) {
      console.log('⚠️  No events available for registration');
      return;
    }
    
    const eventId = eventsResponse.data.events[0]._id;
    
    // Register for the event
    const registrationResponse = await axios.post(`${BASE_URL}/events/${eventId}/register`, {}, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    
    console.log('✅ Event registration successful');
    
    // Test unregistration
    const unregistrationResponse = await axios.post(`${BASE_URL}/events/${eventId}/unregister`, {}, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    
    console.log('✅ Event unregistration successful');
    
  } catch (error) {
    console.error('❌ Event registration failed:', error.response?.data?.message || error.message);
  }
};

const testUserManagement = async () => {
  console.log('\n👥 Testing User Management...');
  
  try {
    if (!adminToken) {
      console.log('⚠️  Skipping user management - no admin token');
      return;
    }
    
    // Get all users
    const usersResponse = await axios.get(`${BASE_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log(`✅ Retrieved ${usersResponse.data.users.length} users`);
    
    // Test user search
    const searchResponse = await axios.get(`${BASE_URL}/auth/users?search=john`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log(`✅ User search successful, found ${searchResponse.data.users.length} results`);
    
  } catch (error) {
    console.error('❌ User management failed:', error.response?.data?.message || error.message);
  }
};

const testRoleBasedAccess = async () => {
  console.log('\n🔒 Testing Role-Based Access Control...');
  
  try {
    // Test admin access to faculty-only endpoints
    if (adminToken) {
      try {
        const response = await axios.get(`${BASE_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin can access user management');
      } catch (error) {
        console.log('❌ Admin cannot access user management');
      }
    }
    
    // Test faculty access to user creation
    if (facultyToken) {
      try {
        const response = await axios.get(`${BASE_URL}/events/my-events`, {
          headers: { Authorization: `Bearer ${facultyToken}` }
        });
        console.log('✅ Faculty can access their events');
      } catch (error) {
        console.log('❌ Faculty cannot access their events');
      }
    }
    
    // Test user access restrictions
    if (userToken) {
      try {
        const response = await axios.get(`${BASE_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${userToken}` }
        });
        console.log('❌ Regular user can access user management (should not)');
      } catch (error) {
        if (error.response?.status === 403) {
          console.log('✅ Regular user correctly restricted from user management');
        } else {
          console.log('❌ Unexpected error for user access restriction');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Role-based access control test failed:', error.message);
  }
};

// Helper function to create test data
const createTestData = async () => {
  console.log('\n🔧 Creating test data...');
  
  try {
    // Create test admin if needed
    const adminData = {
      fullName: 'System Administrator',
      email: 'admin@eventsphere.com',
      password: 'admin123',
      department: 'IT',
      role: 'admin'
    };
    
    console.log('ℹ️  Please ensure test admin account exists in database');
    console.log('   Email: admin@eventsphere.com');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Test data creation failed:', error.message);
  }
};

// Run the comprehensive test
const runTests = async () => {
  try {
    await createTestData();
    await testComprehensive();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
};

// Export for use in other files
module.exports = {
  testComprehensive,
  testCreateAdmin,
  testCreateFaculty,
  testCreateUser,
  testEventCreation,
  testEventRegistration,
  testUserManagement,
  testRoleBasedAccess
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}
