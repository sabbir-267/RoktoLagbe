const express = require('express');
const seedRouter = express.Router();
const { seedUsers } = require('../controllers/seedController.js'); 

seedRouter.get('/users', seedUsers);

module.exports = seedRouter;