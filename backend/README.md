# StudyBuddy Backend API

This is the backend API for StudyBuddy, a platform for finding and managing study groups. The API is built with Node.js, Express, and MongoDB, featuring real-time chat with Socket.io, JWT authentication, and file uploads.

## Features

- **User Authentication**: Register, login, and manage user profiles with JWT
- **Study Groups**: Create, join, and manage study groups
- **Study Sessions**: Schedule and manage study sessions
- **Real-time Chat**: Group messaging with typing indicators and read receipts
- **File Sharing**: Upload and share study materials with versioning support
- **RESTful API**: Well-documented endpoints following REST principles
- **Security**: Password hashing, JWT authentication, rate limiting, and CORS protection

## Prerequisites

- Node.js (v14 or later)
- MongoDB (v4.4 or later)
- npm (v6 or later)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/studybuddy.git
   cd studybuddy/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the environment variables in `.env` with your configuration

4. Start the development server:
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/studybuddy

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME='StudyBuddy Team'

# File Uploads
MAX_FILE_UPLOAD=50 # MB
FILE_UPLOAD_PATH=./uploads

# CORS
CORS_ORIGIN=http://localhost:3000
```

## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: `http://localhost:5000/api-docs`
- Postman Collection: Import `postman/StudyBuddy-API.postman_collection.json`

## Available Scripts

- `npm start`: Start the production server
- `npm run dev`: Start the development server with nodemon
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm test`: Run tests (coming soon)

## Project Structure

```
backend/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/           # Database models
├── routes/           # Route definitions
├── utils/            # Utility functions
├── uploads/          # File uploads (not version controlled)
├── .env             # Environment variables
├── .gitignore        # Git ignore file
├── package.json      # Project dependencies
└── server.js         # Application entry point
```

## Authentication

Most routes require authentication using JWT. Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Error Handling

The API returns JSON responses with the following structure:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "data": {}
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Mongoose](https://mongoosejs.com/)
- [Socket.io](https://socket.io/)
- [JWT](https://jwt.io/)
- [Cloudinary](https://cloudinary.com/)
