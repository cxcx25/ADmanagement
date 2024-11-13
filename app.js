require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const userController = require('./controllers/userController'); // Ensure this file exists in the specified folder

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// Serve static files from the "public" folder (e.g., HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Route to handle getting user info
app.post('/get-user-info', userController.getUserInfo);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
