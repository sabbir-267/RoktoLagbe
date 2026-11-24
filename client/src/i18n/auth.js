// Login, Register, Add phone, plus the Google button and password field
export default {
  en: {
    // shared
    phoneNumber: "Phone number",
    password: "Password",
    fullName: "Full name",
    phoneInvalid: "Enter a valid Bangladeshi mobile number",
    passwordMin: "Password must be at least 8 characters",
    passwordMismatch: "Passwords do not match",
    atLeast8: "At least 8 characters.",
    googleCreated: "Account created with Google!",
    welcomeBackToast: "Welcome back!",
    showPassword: "Show password",
    hidePassword: "Hide password",
    or: "or",
    googleNotConfigured: "Google sign-in is not configured (set VITE_GOOGLE_CLIENT_ID in client/.env).",
    googleFailed: "Could not load Google sign-in. Check your connection.",

    // login
    loginTitle: "Welcome back",
    loginSubtitle: "Log in with Google, your phone number or your email.",
    identifierLabel: "Phone number or email",
    identifierPlaceholder: "01711111111 or you@example.com",
    identifierRequired: "Enter your phone number or email",
    passwordRequired: "Enter your password",
    forgotPassword: "Forgot password?",
    loggingIn: "Logging in...",
    newHere: "New here?",
    createAnAccount: "Create an account",

    // register
    registerTitle: "Create your account",
    registerSubtitle: "Sign up first, then set up your donor profile.",
    nameLength: "Name must be 2 to 80 characters",
    emailInvalidOptional: "Enter a valid email or leave it empty",
    phoneHint: "You will use this number to log in.",
    emailLabel: "Email (needed to become a donor)",
    emailHint: "We will send a link to verify it.",
    confirmPassword: "Confirm password",
    creatingAccount: "Creating account...",
    createAccount: "Create account",
    createdCheckEmail: "Account created! Check your email to verify your address.",
    createdWelcome: "Account created! Welcome to RoktoLagbe.",
    haveAccount: "Already have an account?",

    // add phone
    addPhoneTitle: "One more step",
    addPhoneSubtitle:
      "Add your mobile number so patients and blood banks can reach you. You can't change it later from here, so double-check it.",
    phoneSaved: "Phone number saved",
    savePhone: "Save phone number",
    skipForNow: "Skip for now",
  },
  bn: {
    // shared
    phoneNumber: "মোবাইল নম্বর",
    password: "পাসওয়ার্ড",
    fullName: "পূর্ণ নাম",
    phoneInvalid: "সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন",
    passwordMin: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে",
    passwordMismatch: "পাসওয়ার্ড দুটি মিলছে না",
    atLeast8: "কমপক্ষে ৮ অক্ষর।",
    googleCreated: "Google দিয়ে অ্যাকাউন্ট খোলা হয়েছে!",
    welcomeBackToast: "আবারও স্বাগতম!",
    showPassword: "পাসওয়ার্ড দেখুন",
    hidePassword: "পাসওয়ার্ড লুকান",
    or: "অথবা",
    googleNotConfigured: "Google দিয়ে লগ ইন চালু করা হয়নি (client/.env ফাইলে VITE_GOOGLE_CLIENT_ID দিন)।",
    googleFailed: "Google লগ ইন লোড করা যায়নি। আপনার ইন্টারনেট সংযোগ দেখুন।",

    // login
    loginTitle: "আবারও স্বাগতম",
    loginSubtitle: "Google, মোবাইল নম্বর বা ইমেইল দিয়ে লগ ইন করুন।",
    identifierLabel: "মোবাইল নম্বর বা ইমেইল",
    identifierPlaceholder: "01711111111 অথবা you@example.com",
    identifierRequired: "আপনার মোবাইল নম্বর বা ইমেইল লিখুন",
    passwordRequired: "আপনার পাসওয়ার্ড লিখুন",
    forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?",
    loggingIn: "লগ ইন হচ্ছে...",
    newHere: "নতুন এসেছেন?",
    createAnAccount: "অ্যাকাউন্ট খুলুন",

    // register
    registerTitle: "আপনার অ্যাকাউন্ট খুলুন",
    registerSubtitle: "প্রথমে নিবন্ধন করুন, তারপর আপনার রক্তদাতা প্রোফাইল তৈরি করুন।",
    nameLength: "নাম ২ থেকে ৮০ অক্ষরের মধ্যে হতে হবে",
    emailInvalidOptional: "সঠিক ইমেইল লিখুন অথবা ঘরটি খালি রাখুন",
    phoneHint: "এই নম্বর দিয়েই আপনি লগ ইন করবেন।",
    emailLabel: "ইমেইল (রক্তদাতা হতে প্রয়োজন)",
    emailHint: "যাচাই করার জন্য আমরা একটি লিংক পাঠাব।",
    confirmPassword: "পাসওয়ার্ড নিশ্চিত করুন",
    creatingAccount: "অ্যাকাউন্ট খোলা হচ্ছে...",
    createAccount: "অ্যাকাউন্ট খুলুন",
    createdCheckEmail: "অ্যাকাউন্ট খোলা হয়েছে! ইমেইল যাচাই করতে আপনার ইনবক্স দেখুন।",
    createdWelcome: "অ্যাকাউন্ট খোলা হয়েছে! RoktoLagbe-এ আপনাকে স্বাগতম।",
    haveAccount: "আগেই অ্যাকাউন্ট আছে?",

    // add phone
    addPhoneTitle: "আর একটি ধাপ বাকি",
    addPhoneSubtitle:
      "আপনার মোবাইল নম্বর দিন, যাতে রোগী ও ব্লাড ব্যাংক আপনার সাথে যোগাযোগ করতে পারে। পরে এখান থেকে এটি পরিবর্তন করা যাবে না, তাই ভালো করে মিলিয়ে নিন।",
    phoneSaved: "মোবাইল নম্বর সংরক্ষণ করা হয়েছে",
    savePhone: "মোবাইল নম্বর সংরক্ষণ করুন",
    skipForNow: "এখন থাক",
  },
};
