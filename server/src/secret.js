require('dotenv').config();

const serverPORT = process.env.SERVER_PORT || 3001;
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/RoktoLagbeDB';

module.exports = {serverPORT, mongoURI};