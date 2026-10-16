const createError = require('http-errors');



const getUsers = (req, res, next) => {
    try {
        res.status(200).json({
            message: 'Users retrieved successfully',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getUsers };