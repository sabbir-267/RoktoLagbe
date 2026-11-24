// Voice input (mic button) and the speech recognition error codes it shows
export default {
  en: {
    starting: "Starting microphone…",
    stop: "Stop and fill form",
    speak: "Speak your request",
    voiceLanguage: "Voice language",
    allowMic: "If your browser asks, allow the microphone.",
    listening: "Listening…",
    sayHint: "Say the blood group, bags, hospital, district, when it's needed and a phone number.",

    // voiceBlocker() codes
    block_unsupported:
      "Voice input isn't available in this browser. Use Google Chrome, Microsoft Edge or Safari, or type the request.",
    block_insecure:
      "The microphone only works on secure pages (https://) or on localhost. This page was opened at {origin}, so the browser blocks it.",
    block_brave:
      "Brave blocks the speech service voice input depends on. Use Google Chrome or Microsoft Edge, or type the request.",

    // useSpeechRecognition error codes
    "err_not-allowed":
      "Microphone access is blocked. Click the lock or camera icon in the address bar, allow the microphone, then try again.",
    "err_service-not-allowed":
      "This browser isn't allowing its speech service. Try Google Chrome or Microsoft Edge, or type the request.",
    "err_audio-capture": "No microphone was found. Check that one is connected and not used by another app.",
    err_network:
      "The speech service couldn't be reached. Voice input needs an internet connection (in Brave it never works).",
    "err_language-not-supported": "Your browser can't recognise this language. Switch to English or type instead.",
    "err_no-speech": "Didn't hear anything. Check your microphone, tap the button, then speak.",
    "err_start-failed": "Could not start voice input. Reload the page and try again.",
    err_other: "Voice input stopped ({code}). Please try again or type the request.",
  },
  bn: {
    starting: "মাইক্রোফোন চালু হচ্ছে…",
    stop: "থামুন ও ফর্ম পূরণ করুন",
    speak: "মুখে অনুরোধ বলুন",
    voiceLanguage: "কথা বলার ভাষা",
    allowMic: "ব্রাউজার অনুমতি চাইলে মাইক্রোফোন ব্যবহারের অনুমতি দিন।",
    listening: "শুনছি…",
    sayHint: "রক্তের গ্রুপ, কত ব্যাগ, হাসপাতাল, জেলা, কখন প্রয়োজন এবং একটি ফোন নম্বর বলুন।",

    // voiceBlocker() codes
    block_unsupported:
      "এই ব্রাউজারে ভয়েস ইনপুট ব্যবহার করা যায় না। Google Chrome, Microsoft Edge বা Safari ব্যবহার করুন, অথবা অনুরোধটি লিখে দিন।",
    block_insecure:
      "মাইক্রোফোন শুধু নিরাপদ পাতায় (https://) বা localhost-এ কাজ করে। এই পাতাটি {origin} থেকে খোলা হয়েছে, তাই ব্রাউজার এটি বন্ধ রেখেছে।",
    block_brave:
      "ভয়েস ইনপুট যে স্পিচ সার্ভিসের উপর নির্ভর করে, Brave সেটি বন্ধ রাখে। Google Chrome বা Microsoft Edge ব্যবহার করুন, অথবা অনুরোধটি লিখে দিন।",

    // useSpeechRecognition error codes
    "err_not-allowed":
      "মাইক্রোফোন ব্যবহারের অনুমতি বন্ধ আছে। ঠিকানা বারের তালা বা ক্যামেরা আইকনে ক্লিক করে মাইক্রোফোনের অনুমতি দিন, তারপর আবার চেষ্টা করুন।",
    "err_service-not-allowed":
      "এই ব্রাউজার তার স্পিচ সার্ভিস ব্যবহার করতে দিচ্ছে না। Google Chrome বা Microsoft Edge ব্যবহার করে দেখুন, অথবা অনুরোধটি লিখে দিন।",
    "err_audio-capture": "কোনো মাইক্রোফোন পাওয়া যায়নি। মাইক্রোফোন সংযুক্ত আছে কিনা এবং অন্য কোনো অ্যাপ সেটি ব্যবহার করছে কিনা দেখুন।",
    err_network:
      "স্পিচ সার্ভিসের সাথে সংযোগ করা যায়নি। ভয়েস ইনপুটের জন্য ইন্টারনেট সংযোগ প্রয়োজন (Brave-এ এটি কখনো কাজ করে না)।",
    "err_language-not-supported": "আপনার ব্রাউজার এই ভাষা চিনতে পারে না। English বেছে নিন অথবা লিখে দিন।",
    "err_no-speech": "কিছু শোনা যায়নি। মাইক্রোফোন ঠিক আছে কিনা দেখুন, বোতামে চাপ দিন, তারপর কথা বলুন।",
    "err_start-failed": "ভয়েস ইনপুট চালু করা যায়নি। পাতাটি রিলোড করে আবার চেষ্টা করুন।",
    err_other: "ভয়েস ইনপুট থেমে গেছে ({code})। অনুগ্রহ করে আবার চেষ্টা করুন অথবা অনুরোধটি লিখে দিন।",
  },
};
