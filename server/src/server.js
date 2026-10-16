const app = require('./app');
const {serverPORT} = require('./secret');
const connectDB = require('./config/db');

// Connect to the database
connectDB();

// Start the server


app.listen(serverPORT, () => {
    console.log(`Server is running at http://localhost:${serverPORT}`);
});