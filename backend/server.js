const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto'); // For generating a secure state parameter
const { URLSearchParams } = require('url');
const { db } = require('./firebase-setup'); // Firebase setup file


const app = express();
app.use(
    cors({
        origin: 'http://localhost:3000', // Adjust to match your frontend origin
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);



app.use(bodyParser.json());


if(process.env.NODE_ENV === 'production') {
    app.use(express.static('pinsight/build'));
}

const PORT = process.env.PORT || 5001; app.listen(PORT);
const CLIENT_ID = '1508548'; // Replace with your Pinterest Client ID
const CLIENT_SECRET = '1e4910ff2b56f8021e4b28b392ac145975bbfc60'; // Replace with your Pinterest Client Secret
const REDIRECT_URI = 'http://localhost:5000/auth/pinterest/callback';

let stateToken = ''; // To store the state parameter

// Step 1: Redirect to Pinterest OAuth
app.get('/auth/pinterest', (req, res) => {
    // Generate a secure random state parameter
    stateToken = crypto.randomBytes(16).toString('hex');

    const scope = 'user_accounts:read,pins:read'; // Required scopes for reading user info and pins
    const authUrl = `https://www.pinterest.com/oauth/?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
    )}&scope=${scope}&state=${stateToken}`; // Include the state parameter

    console.log(`Redirecting to Pinterest OAuth URL: ${authUrl}`);
    res.redirect(authUrl);
});

// Step 2: Handle Pinterest OAuth Callback and Exchange Code for Access Token
app.get('/auth/pinterest/callback', async (req, res) => {
    const { code, state } = req.query;

    // Validate the state parameter
    if (state !== stateToken) {
        console.error('Invalid state parameter. Possible CSRF attack.');
        return res.status(400).send('Invalid state parameter.');
    }

    if (!code) {
        console.error('Authorization code not found.');
        return res.status(400).send('Authorization code not found.');
    }

    console.log(`Received Authorization Code: ${code}`);

    // Properly format the request body for token exchange
    const postData = new URLSearchParams();
    postData.append('grant_type', 'authorization_code');
    postData.append('redirect_uri', REDIRECT_URI);
    postData.append('code', code);

    // Generate the Basic Authentication header
    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        console.log('Exchanging code for access token...');

        const tokenResponse = await axios.post(
            'https://api.pinterest.com/v5/oauth/token', // Correct endpoint for token exchange
            postData.toString(), // Ensure data is sent as a URL-encoded string
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded', // Correct content type for form submissions
                    Authorization: `Basic ${authHeader}`, // Basic Auth header
                },
            }
        );

        const { access_token, refresh_token } = tokenResponse.data;
        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        // Fetch user profile using the access token
        const profileResponse = await axios.get(
            'https://api.pinterest.com/v5/user_account', // Correct endpoint for fetching user profile
            {
                headers: {
                    Authorization: `Bearer ${access_token}`, // Include the access token in the authorization header
                },
            }
        );

        const profile = profileResponse.data;
        console.log('Logged-in User Profile:', profile);

        // Save user profile data to Firestore
        const userRef = db.collection('users').doc(profile.id);
        await userRef.set(profile);

        // Redirect to frontend dashboard with the access token in URL
        res.redirect(`http://localhost:3000/dashboard?accessToken=${access_token}`);
    } catch (error) {
        console.error('Error during token exchange or profile fetch:', error.response?.data || error.message);
        res.status(500).json({
            message: 'OAuth process failed',
            error: error.response?.data || error.message,
        });
    }
});

// Save analyzed data to Firestore
app.post('/save-data', async (req, res) => {
    const { userId, imageData } = req.body;

    if (!userId || !imageData) {
        return res.status(400).json({ message: 'Missing required fields: userId or imageData' });
    }

    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.collection('photos').add(imageData);

        res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving data to Firestore:', error.message);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

// Endpoint to fetch user images (pins)
app.get('/user-images', async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1]; // Extract access token from Authorization header

    if (!accessToken) {
        return res.status(401).json({ message: 'Unauthorized: No access token provided' });
    }

    try {
        // Fetch pins from the Pinterest API
        const pinsResponse = await axios.get('https://api.pinterest.com/v5/pins', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        console.log('Pinterest API Response:', pinsResponse.data); // Log the whole response

        if (pinsResponse.data.items && pinsResponse.data.items.length > 0) {
            const pins = pinsResponse.data.items.map(pin => ({
                url: pin.images?.original?.url || '', // Extract the image URL
            }));

            return res.status(200).json(pins);
        } else {
            return res.status(200).json([]);
        }
    } catch (error) {
        console.error('Error fetching user images:', error.response?.data || error.message);
        res.status(500).json({ message: 'Failed to fetch user images', error: error.response?.data || error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}. Visit http://localhost:${PORT}/auth/pinterest`);
});
