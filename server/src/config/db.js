const mongoose = require('mongoose');
const { mongoURI } = require('../secret');

const connectDB = async (options={} ) => {
    try {
        await mongoose.connect(mongoURI, options);
        console.log('Connected to DB successfully');
    } catch (error) {
        console.error('Could not connect to DB:', error.toString());
    }
};

module.exports = connectDB;