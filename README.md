# EventSphere Backend

A comprehensive backend API for the EventSphere University Event Management Portal built with Node.js, Express.js, and MongoDB.

## Features

- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Event Management**: CRUD operations for events with poster uploads
- **Registration System**: Event registration for participants and coordinators
- **Feedback System**: Post-event feedback and ratings
- **Analytics Dashboard**: Real-time analytics and reporting for admin/faculty
- **File Upload**: Multer-based file upload for event posters and profile images
- **Search & Filtering**: Advanced search and filtering capabilities
- **Pagination**: Efficient pagination for large datasets

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate Limiting
- **Email**: Nodemailer (for future email notifications)

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eventsphere2/Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `config.env.example` to `config.env`
   - Update the following variables:
     ```env
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/eventsphere
     JWT_SECRET=your_jwt_secret_key_here
     EMAIL_USER=your_email@gmail.com
     EMAIL_PASS=your_email_app_password
     NODE_ENV=development
     ```

4. **Create upload directories**
   ```bash
   mkdir -p uploads/posters uploads/profiles
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/create-faculty` - Create faculty account (Admin only)
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password

### Events
- `GET /api/events` - Get all events with filtering and pagination
- `GET /api/events/:id` - Get single event by ID
- `POST /api/events` - Create new event (Faculty/Admin only)
- `PUT /api/events/:id` - Update event (Faculty/Admin only)
- `DELETE /api/events/:id` - Delete event (Faculty/Admin only)
- `POST /api/events/:id/like` - Toggle event like
- `GET /api/events/:id/related` - Get related events
- `GET /api/events/featured/current` - Get current and upcoming featured events
- `GET /api/events/archive/previous` - Get completed events for archive

### Registrations
- `POST /api/registrations` - Register for an event
- `GET /api/registrations/my` - Get user's registrations
- `GET /api/registrations/event/:eventId` - Get event registrations (Faculty/Admin only)
- `PUT /api/registrations/:id/status` - Update registration status (Faculty/Admin only)
- `DELETE /api/registrations/:id` - Cancel registration
- `GET /api/registrations/stats/event/:eventId` - Get registration statistics (Faculty/Admin only)

### Feedback
- `POST /api/feedback` - Submit feedback for an event
- `GET /api/feedback/event/:eventId` - Get event feedback
- `GET /api/feedback/my` - Get user's feedback submissions
- `GET /api/feedback/pending` - Get pending feedback for approval (Faculty/Admin only)
- `PUT /api/feedback/:id/approve` - Approve/reject feedback (Faculty/Admin only)
- `PUT /api/feedback/:id` - Update feedback
- `DELETE /api/feedback/:id` - Delete feedback

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard analytics (Faculty/Admin only)
- `GET /api/analytics/events/trends` - Get event trends (Faculty/Admin only)
- `GET /api/analytics/registrations/trends` - Get registration trends (Faculty/Admin only)
- `GET /api/analytics/feedback/trends` - Get feedback trends (Faculty/Admin only)
- `GET /api/analytics/events/:eventId` - Get event-specific analytics (Faculty/Admin only)
- `GET /api/analytics/users/insights` - Get user insights (Faculty/Admin only)

### Users
- `GET /api/users` - Get all users (Admin/Faculty only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile
- `DELETE /api/users/:id` - Deactivate user (Admin/Faculty only)
- `POST /api/users/:id/reactivate` - Reactivate user (Admin only)
- `GET /api/users/stats/overview` - Get user statistics (Admin/Faculty only)
- `GET /api/users/search/suggestions` - Get user search suggestions (Admin/Faculty only)
- `POST /api/users/bulk/update-status` - Bulk update user status (Admin only)

## Database Models

### User
- Authentication fields (email, password)
- Profile information (fullName, department, year, semester, etc.)
- Role-based access control (admin, faculty, participant, coordinator)
- Timestamps and activity tracking

### Event
- Event details (title, description, date, venue, etc.)
- Mentor information
- Registration limits and current participants
- Like system and status tracking

### Registration
- Event registration details
- Participant information
- Status tracking (pending, confirmed, rejected, cancelled)
- Attendance tracking

### Feedback
- Event feedback and ratings
- Category-based ratings (content, organization, venue, overall)
- Approval system for public display
- Anonymous feedback support

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Granular permissions based on user roles
- **Input Validation**: Comprehensive request validation using express-validator
- **Rate Limiting**: API rate limiting to prevent abuse
- **Helmet**: Security headers for Express applications
- **CORS**: Cross-origin resource sharing configuration
- **Password Hashing**: bcrypt-based password encryption

## File Upload

- **Poster Uploads**: Event poster images (max 5MB)
- **Profile Images**: User profile pictures (max 2MB)
- **File Validation**: Image file type validation
- **Secure Storage**: Organized directory structure

## Error Handling

- **Global Error Middleware**: Centralized error handling
- **Validation Errors**: Detailed validation error messages
- **Database Errors**: Proper error handling for database operations
- **HTTP Status Codes**: Appropriate HTTP status codes for different scenarios

## Development

### Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (to be implemented)

### Code Structure
```
Backend/
├── models/          # Database models
├── routes/          # API route handlers
├── middleware/      # Custom middleware
├── uploads/         # File upload directory
├── config.env       # Environment configuration
├── server.js        # Main server file
└── package.json     # Dependencies and scripts
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/eventsphere |
| `JWT_SECRET` | JWT signing secret | Required |
| `EMAIL_USER` | Email for notifications | Optional |
| `EMAIL_PASS` | Email password | Optional |
| `NODE_ENV` | Environment mode | development |

## API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "message": "Error description",
  "errors": [ ... ]
}
```

### Pagination Response
```json
{
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Testing

API testing can be done using tools like:
- Postman
- Insomnia
- Thunder Client (VS Code extension)

## Deployment

1. **Production Environment**
   - Set `NODE_ENV=production`
   - Use strong JWT secret
   - Configure MongoDB Atlas or production database
   - Set up proper CORS origins

2. **Docker Deployment** (Optional)
   ```dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.
