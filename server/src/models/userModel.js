 const {Schema, model} = require('mongoose');
 const bcrypt = require('bcrypt');

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 31,
        minlength: 3,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function (value) {
                // Simple email validation regex
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Invalid email format',
        },
    },
    password: {
        type: String,
        required: true,
        trim: true,
        minlength: [6, 'Password must be at least 6 characters long'],
        set: (value) => {
            // Hash the password before saving it to the database
            const saltRounds = 10;
            return bcrypt.hashSync(value, saltRounds);
        }
    },
    address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255,
        minlength: 5,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function (value) {
                // Simple phone number validation regex
                return /^\+?[1-9]\d{1,14}$/.test(value);
            },
            message: 'Invalid phone number format',
        },
    },
    dateOfBirth: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                // Ensure the date of birth is in the past
                return value < new Date();
            },
            message: 'Date of birth must be in the past',
        },
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required: true,
    },
    lastDonationDate: {
        type: Date,
        validate: {
            validator: function (value) {
                // Ensure the last donation date is in the past
                return value <= new Date();
            },
            message: 'Last donation date must be in the past',
        },
    },
    image: {
        type: String,
        trim: true,
        default: 'default-profile.png', // Default profile image
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    isBanned: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

const User = model('User', userSchema);

module.exports = User;