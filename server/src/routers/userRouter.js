const Express = require('express');
const router = Express.Router();
const { getUsers } = require('../controllers/userController');

router.get('/', getUsers);

module.exports = router;
  