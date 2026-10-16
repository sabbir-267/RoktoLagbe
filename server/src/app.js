const express = require('express');
const morgan = require('morgan');
const createError = require('http-errors');
const xss = require('xss');
const rateLimit = require('express-rate-limit');
const router = require('./routers/userRouter');
const seedRouter = require('./routers/seedRouter');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many requests from this IP, please try again after a minute'
});

const sanitize = (obj) => {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = xss(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitize(obj[key]);
    }
  }
  return obj;
};

app.use((req, res, next) => {
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);   // mutates in place, no reassignment
  if (req.params) sanitize(req.params);
  next();
});

app.use(limiter);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/user', router);
app.use('/api/seed', seedRouter);


app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Home Page!'
  })
});

app.get('/test', (req, res) => {
  res.status(200).json({
    message: 'get test API is working fine'
  })
});



//client side error handling
app.use((req, res, next) => {
  createError(404, 'Route not found');
  next();
});

//server side error handling
app.use((err, req, res, next) => {
  return res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});

module.exports = app;