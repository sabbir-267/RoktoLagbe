// server/src/chatbot/knowledge.js
//
// The assistant's training data. Each intent has:
//   id        unique name
//   examples  ways people ask it (English, Bangla and Banglish). More varied examples = better matching.
//   answer    { en, bn } reply text. Light formatting: **bold**, "- " bullet lines, blank line = new paragraph.
//             Intents with an `action` build their reply from live data instead (see actions.js / engine.js).
//   action    optional live-data skill: find_donors | bank_stock | open_requests | my_eligibility | compatibility
//   links     optional buttons [{ to: "/path", label: { en, bn } }]
//   chip      optional { en, bn } short question shown as a suggestion button
//   follow    optional intent ids offered as suggestions after this answer
//
// Medical answers are general information only; the blood bank's doctor always decides.
// After editing, run `npm run chatbot:train` to retrain and check accuracy.

const link = (to, en, bn) => ({ to, label: { en, bn } });

export default [
  // ---------------------------------------------------------------- core
  {
    id: "greeting",
    examples: [
      "hello everyone", "hi there", "hey bot", "good afternoon", "নমস্কার", "হ্যালো, কেউ আছেন?", "hello ke acho", "hi, kemon achen apni",
      "hi", "hello", "hey there", "assalamualaikum", "salam", "good morning", "good evening", "hello bhai",
      "kemon acho", "kemon achen", "hi apu", "hey", "yo", "হ্যালো", "আসসালামু আলাইকুম", "শুভ সকাল", "কেমন আছেন",
      "হাই ভাইয়া", "slm", "asalamu alaikum bhaiya",
    ],
    answer: {
      en: "Hello! I'm the **RoktoLagbe assistant**. I can help you find donors or blood bank stock, explain who can donate, and guide you through using the site. What do you need?",
      bn: "হ্যালো! আমি **RoktoLagbe সহকারী**। রক্তদাতা বা ব্লাড ব্যাংকের মজুদ খুঁজতে, কারা রক্ত দিতে পারেন তা জানাতে এবং সাইট ব্যবহারে সাহায্য করতে পারি। কী জানতে চান?",
    },
    follow: ["find_donors_example", "who_can_donate", "post_request", "my_eligibility"],
  },
  {
    id: "fallback",
    examples: [],
    answer: {
      en: "Sorry, I didn't quite understand. You can ask me things like **\"O+ donors in Dhaka\"**, **\"who can donate blood?\"** or **\"how do I post a request?\"**.",
      bn: "দুঃখিত, ঠিক বুঝতে পারিনি। আমাকে জিজ্ঞেস করতে পারেন যেমন **\"ঢাকায় O+ রক্তদাতা\"**, **\"কারা রক্ত দিতে পারেন?\"** অথবা **\"কীভাবে অনুরোধ পোস্ট করব?\"**।",
    },
    follow: ["find_donors_example", "who_can_donate", "post_request"],
    links: [link("/complaints", "Contact the team", "টিমের সাথে যোগাযোগ")],
  },
  {
    id: "emergency",
    examples: [],
    answer: {
      en: "**This sounds like a medical emergency. Call 999 now** (National Emergency Service) or go to the nearest hospital emergency department. Don't wait for a chat reply.\n\nOnce the patient is with doctors, I can help you find blood donors.",
      bn: "**এটি জরুরি চিকিৎসার অবস্থা মনে হচ্ছে। এখনই ৯৯৯-এ কল করুন** (জাতীয় জরুরি সেবা) অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যান। চ্যাটের উত্তরের জন্য অপেক্ষা করবেন না।\n\nরোগী চিকিৎসকের কাছে পৌঁছালে আমি রক্তদাতা খুঁজতে সাহায্য করতে পারি।",
    },
    follow: ["find_donors_example", "post_request"],
  },

  // ---------------------------------------------------------------- live-data actions
  {
    id: "find_donors",
    action: "find_donors",
    examples: [
      "ab plus blood needed", "o plus rokto lagbe", "b plus donor chai",
      "need 2 bags of B+ blood for my father in Gazipur", "my sister needs A- blood after delivery in Narayanganj", "O+ blood needed for an accident patient", "patient er jonno AB+ rokto lagbe jessore", "আমার বাবার জন্য দুই ব্যাগ ও নেগেটিভ রক্ত লাগবে", "রাজশাহীতে এ পজিটিভ রক্তদাতা দরকার", "bogra te b negative blood lagbe", "o- blood chai kurigram", "donor lagbe A plus noakhali", "find me an o positive donor in cumilla", "need blood for surgery tomorrow, group B+", "বরিশালে এবি নেগেটিভ ডোনার খুঁজছি", "ma er jonno 3 bag O+ rokto dorkar", "searching for a negative donor in dinajpur", "AB positive er donor lagbe tangail e",
      "I need O+ blood", "find B- donors in Dhaka", "AB+ donor", "need blood donor urgently", "need A positive blood in Khulna",
      "looking for O negative donor in Rajshahi", "my mother needs B+ blood at Dhaka Medical", "any AB- donor in Sylhet?",
      "ঢাকায় ও পজিটিভ রক্তদাতা", "রক্তদাতা খুঁজছি", "চট্টগ্রামে বি নেগেটিভ রক্ত লাগবে", "ঢাকায় এবি পজিটিভ রক্ত দরকার",
      "এ পজিটিভ রক্তের ডোনার চাই", "o positive rokto lagbe", "b+ donor lagbe chittagong", "B negative lagbe sylhet",
      "a+ rakto dorkar comilla", "ab negative donor khujchi", "urgent O- blood needed in Mymensingh", "o+ blood lagbo barishal e",
    ],
    chip: { en: "Find donors", bn: "রক্তদাতা খুঁজুন" },
  },
  {
    id: "find_donors_example",
    action: "find_donors",
    examples: [
      "donors close to me", "are there any donors in my locality", "how many donors are in my area", "koyjon donor available", "আমার আশেপাশে কতজন ডোনার আছে", "donor count near my location", "elakar donor der list", "available donor koto jon",
      "donors near me", "how many donors are available", "available donors", "show me donors in my area",
      "how many donors do you have", "kotojon donor ache", "kache kono donor ache", "আমার এলাকায় রক্তদাতা",
      "কতজন রক্তদাতা প্রস্তুত আছে", "nearby blood donors", "ekhon kara rokto dite prostut",
    ],
    chip: { en: "O+ donors in Dhaka", bn: "ঢাকায় O+ রক্তদাতা" },
  },
  {
    id: "bank_stock",
    action: "bank_stock",
    examples: [
      "does any blood bank have B negative in stock", "blood bank stock for O- in Khulna", "which blood banks have AB- units", "blood bank e a negative er stock ache ki", "ব্লাড ব্যাংকে এবি পজিটিভ রক্ত আছে কি না", "is O positive available at blood banks in Sylhet", "blood bank theke B+ rokto pabo kothay", "কোন ব্লাড ব্যাংকে ও নেগেটিভ পাওয়া যাবে",
      "which blood bank has O+", "blood bank stock A-", "ব্লাড ব্যাংকে বি পজিটিভ আছে", "blood bank e o negative ache",
      "kono blood bank e A+ ache?", "is AB+ available in any blood bank in Dhaka", "check B- stock at blood banks",
      "where can I get O+ blood bag from a blood bank", "কোন ব্লাড ব্যাংকে এ নেগেটিভ রক্ত মজুদ আছে", "চট্টগ্রামের ব্লাড ব্যাংকে ও পজিটিভ পাওয়া যাবে",
      "blood bank a b positive stock koto", "rajshahi blood bank e ab- pawa jabe", "ব্লাড ব্যাংকের মজুদ দেখাও", "blood bank stock",
      "kon blood bank e rokto ache", "sylhet e kono blood bank e O+ blood ache",
    ],
    chip: { en: "Blood bank stock", bn: "ব্লাড ব্যাংকের মজুদ" },
  },
  {
    id: "open_requests",
    action: "open_requests",
    examples: [
      "কার রক্ত দরকার", "kader rokto dorkar ekhon",
      "list of patients who need blood", "which patients need blood right now", "who is asking for blood today", "aj karo rokto lagbe?", "ajker request gulo dekhao", "আজ কোন রোগীর রক্ত লাগবে", "any open requests near Chittagong", "kothay kothay rokto chai ekhon", "show open requests for B+",
      "who needs blood", "open blood requests", "কার রক্ত লাগবে", "rokto lagbe emon request", "show current blood requests",
      "any O+ requests in Dhaka today", "I want to donate, who needs blood near me", "কোথায় এখন রক্ত দরকার",
      "ঢাকায় কারো বি পজিটিভ রক্ত লাগবে?", "kar kar rokto dorkar ache", "latest requests dekhao", "urgent blood requests list",
      "kono rogir ki A+ lagbe", "চট্টগ্রামে খোলা অনুরোধ", "anyone needing blood in Sylhet",
    ],
    chip: { en: "Who needs blood now?", bn: "এখন কার রক্ত লাগবে?" },
  },
  {
    id: "my_eligibility",
    action: "my_eligibility",
    examples: [
      "has enough time passed since my last donation", "can I give blood again now", "is it time for my next donation", "am I eligible again", "ami ki abar rokto dite pari", "আমি কি আজ রক্ত দিতে পারব", "আমার পরবর্তী রক্তদানের তারিখ কবে", "aj donate kora jabe amar", "when will i be eligible to donate", "check if I can donate today",
      "can I donate now", "when can I donate again", "আমি কবে আবার রক্ত দিতে পারব", "ami ki ekhon rokto dite parbo",
      "am I eligible to donate today", "when is my next donation date", "check my eligibility", "ami abar kobe rokto dite parbo",
      "আমি কি এখন রক্ত দিতে পারব", "amar next donation kobe", "my donation status", "am i allowed to give blood now",
      "ekhon ki ami donate korte parbo",
    ],
    chip: { en: "Can I donate now?", bn: "আমি কি এখন রক্ত দিতে পারি?" },
  },
  {
    id: "compatibility",
    action: "compatibility",
    examples: [
      "kon group er sathe match kore", "which group matches with B-",
      "can O- be given to an A+ patient", "which donors can give blood to AB- patient", "can A+ receive O- blood", "O+ রোগী কোন কোন গ্রুপের রক্ত নিতে পারে", "b positive rogi ke ki A positive dewa jabe", "is B- blood compatible with AB+", "a negative patient er jonno kon group er rokto chole", "which groups match with O+",
      "who can receive A+ blood", "which group can give to B+", "এ পজিটিভ কাকে রক্ত দিতে পারে", "o negative ke dite pare",
      "can O+ donate to AB+", "B- patient can take which blood", "AB+ patient ke kon group dite parbe",
      "বি নেগেটিভ রোগী কোন গ্রুপের রক্ত নিতে পারে", "is A- compatible with O+", "o positive kon kon group e dite pare",
      "compatible groups for AB-", "ও পজিটিভ কাদের রক্ত নিতে পারে", "a+ er sathe kon group mile",
    ],
    chip: { en: "Blood group compatibility", bn: "রক্তের গ্রুপ মিল" },
  },

  // ---------------------------------------------------------------- donor rules
  {
    id: "who_can_donate",
    examples: [
      "কারা রক্ত দিতে পারবেন", "who qualifies as a donor", "donor hote ki ki joggota lage",
      "basic requirements for blood donors", "who is eligible to donate blood", "can anyone donate blood", "rokto donate korte ki lage", "কারা রক্তদান করতে পারেন", "রক্তদাতা হওয়ার শর্ত", "blood donor howar joggota", "kara rokto dan korte pare", "general rules for giving blood",
      "who can donate blood", "requirements to donate blood", "কারা রক্ত দিতে পারে", "rokto dite ki ki lage",
      "eligibility criteria for blood donation", "what are the rules to be a blood donor", "am I fit to donate blood",
      "rokto deyar shorto ki", "kara rakto dite parbe", "রক্তদানের যোগ্যতা কী", "রক্ত দিতে কী কী শর্ত",
      "blood donate korar niyom", "conditions for donating blood", "who is allowed to give blood", "ke ke donor hote pare",
    ],
    answer: {
      en: "Most healthy adults can donate:\n- Age **18–65**\n- Weight **45 kg** or more\n- At least **4 months (120 days)** since your last donation\n- Feeling well today (no fever or infection)\n\nThe blood bank's doctor makes the final decision on the day.",
      bn: "বেশিরভাগ সুস্থ প্রাপ্তবয়স্ক রক্ত দিতে পারেন:\n- বয়স **১৮–৬৫**\n- ওজন **৪৫ কেজি** বা তার বেশি\n- শেষ রক্তদানের পর অন্তত **৪ মাস (১২০ দিন)**\n- আজ সুস্থ বোধ করছেন (জ্বর বা সংক্রমণ নেই)\n\nরক্তদানের দিন ব্লাড ব্যাংকের চিকিৎসক চূড়ান্ত সিদ্ধান্ত নেন।",
    },
    links: [link("/eligibility", "Full donor guide", "পূর্ণ রক্তদাতা নির্দেশিকা")],
    chip: { en: "Who can donate?", bn: "কারা রক্ত দিতে পারেন?" },
    follow: ["my_eligibility", "before_donating", "become_donor", "cant_donate"],
  },
  {
    id: "donation_gap",
    examples: [
      "how many months between donations", "gap needed before next donation", "months gap after last donation", "koto mash por por rokto deya jay", "ekbar donate korle abar kobe", "রক্ত দেওয়ার কত মাস পর আবার দেওয়া যায়", "donated 2 months ago can i donate again", "4 mash na hole ki rokto deya jay", "waiting time between two donations",
      "how often can I donate", "how many days gap between donations", "minimum gap between two blood donations",
      "how long should I wait after donating to donate again", "koto din por por rokto deya jay", "koydin por abar rokto dite parbo",
      "কত দিন পরপর রক্ত দেওয়া যায়", "এক বার রক্ত দেওয়ার পর কত দিন অপেক্ষা করতে হয়", "is 3 months gap enough", "120 days rule",
      "2 mash por ki rokto deya jabe", "rokto deyar majhe koto gap lage", "দুইবার রক্তদানের মাঝে বিরতি কত",
    ],
    answer: {
      en: "Wait at least **4 months (120 days)** between whole-blood donations. That's how long your body needs to fully replace the red cells.\n\nIf you log in, I can tell you your own next eligible date. While you're within the 120 days, you're hidden from \"available\" donor searches.",
      bn: "পূর্ণ রক্তদানের মাঝে অন্তত **৪ মাস (১২০ দিন)** বিরতি দিন। লোহিত রক্তকণিকা পুরোপুরি পূরণ হতে শরীরের এতটা সময় লাগে।\n\nলগ ইন করলে আপনার পরবর্তী রক্তদানের তারিখ জানাতে পারব। ১২০ দিন পূর্ণ না হওয়া পর্যন্ত আপনাকে \"প্রস্তুত\" রক্তদাতার তালিকায় দেখানো হয় না।",
    },
    links: [link("/eligibility", "Donor guide", "রক্তদাতা নির্দেশিকা")],
    chip: { en: "How often can I donate?", bn: "কত দিন পরপর রক্ত দেওয়া যায়?" },
    follow: ["my_eligibility", "donations_per_year", "after_donating"],
  },
  {
    id: "donations_per_year",
    examples: [
      "times a year to donate safely", "annual blood donation count", "how often per year is safe to donate", "bochore koyta donation kora jay", "এক বছরে কয়বার রক্তদান নিরাপদ", "can I donate every month", "proti mash e rokto deya jay?",
      "how many times a year can I donate blood", "how many times can i give blood in a year", "max donations per year",
      "বছরে কতবার রক্ত দেওয়া যায়", "ek bochore koybar rokto deya jay", "bochore koto bar donate kora jay",
      "can I donate 4 times a year", "yearly blood donation limit", "বছরে চারবার রক্ত দেওয়া কি ঠিক", "saal e koybar blood dibo",
    ],
    answer: {
      en: "With the **4-month (120-day)** gap, a healthy donor can give whole blood about **3 times a year**. Regular donors are a lifeline for patients like those with thalassemia, so thank you if you donate regularly!",
      bn: "**৪ মাস (১২০ দিন)** বিরতির নিয়মে একজন সুস্থ রক্তদাতা বছরে প্রায় **৩ বার** পূর্ণ রক্ত দিতে পারেন। নিয়মিত রক্তদাতারা থ্যালাসেমিয়ার মতো রোগীদের জন্য ভরসা, তাই নিয়মিত রক্ত দিলে আপনাকে ধন্যবাদ!",
    },
    chip: { en: "How many times a year?", bn: "বছরে কতবার?" },
    follow: ["donation_gap", "my_eligibility", "leaderboard"],
  },
  {
    id: "age_limit",
    examples: [
      "am I too young to donate blood", "am I too old to give blood", "I'm 70, can I still donate", "is 18 the minimum age", "koto boyose rokto deya jay", "boyos 16 hole rokto deya jabe", "বয়স ১৭ হলে কি রক্ত দেওয়া যায়", "রক্তদানের সর্বোচ্চ বয়স কত", "boyosh beshi hole rokto dite parbo", "age requirement for blood donors",
      "what is the age limit for blood donation", "minimum age to donate blood", "can a 17 year old donate", "I am 16 can I give blood",
      "max age for donating blood", "can a 66 year old donate", "rokto dite boyos koto lage", "koto boyosh theke rokto deya jay",
      "রক্ত দিতে কত বছর বয়স লাগে", "৬০ বছর বয়সে কি রক্ত দেওয়া যায়", "boyosh 17, rokto dite parbo?", "is there an upper age limit",
      "amar age 62, donate korte parbo",
    ],
    answer: {
      en: "Donors must be **18 to 65 years old**. If you're over 60 and donating for the first time, talk to the blood bank's doctor first.\n\nYour date of birth on your donor profile is used to check this, and it can't be changed later.",
      bn: "রক্তদাতার বয়স হতে হবে **১৮ থেকে ৬৫ বছর**। ৬০ বছরের বেশি বয়সে প্রথমবার রক্ত দিতে চাইলে আগে ব্লাড ব্যাংকের চিকিৎসকের সাথে কথা বলুন।\n\nরক্তদাতা প্রোফাইলের জন্মতারিখ দিয়ে এটি যাচাই হয়, পরে তা বদলানো যায় না।",
    },
    chip: { en: "Age limit?", bn: "বয়সসীমা কত?" },
    follow: ["weight_limit", "who_can_donate", "become_donor"],
  },
  {
    id: "weight_limit",
    examples: [
      "কম ওজন হলে রক্তদান", "too light to donate?",
      "underweight donor", "ওজন ৪০ কেজি, রক্তদাতা হওয়া যাবে?", "kom ojoner manush donor hote pare?",
      "i weigh 40 kilos, can i donate", "is my weight too low to donate", "minimum kg to give blood", "ojon kom, rokto dite parbo", "45 kg er kom hole rokto deya jay", "ওজন কত হলে রক্ত দেওয়া যায়", "কম ওজনে রক্তদান করা যাবে কি", "body weight rule for donors", "amar weight 42 kg",
      "minimum weight for blood donation", "how much should I weigh to donate", "I weigh 42 kg can I donate", "is 45 kg enough to donate blood",
      "weight koto lage rokto dite", "ojon koto hote hobe", "রক্ত দিতে কত কেজি ওজন লাগে", "আমার ওজন ৪৪ কেজি, রক্ত দিতে পারব?",
      "underweight can donate blood?", "amar ojon 50 kg", "ওজন কম হলে কি রক্ত দেওয়া যায়", "weight requirement",
    ],
    answer: {
      en: "You need to weigh **at least 45 kg**. With lower body weight, a standard donation (about 450 ml) would take too large a share of your blood, so it isn't safe.",
      bn: "রক্ত দিতে ওজন **কমপক্ষে ৪৫ কেজি** হতে হবে। ওজন কম হলে স্বাভাবিক পরিমাণ রক্তদান (প্রায় ৪৫০ মিলি) শরীরের রক্তের তুলনায় অনেক বেশি হয়ে যায়, তাই তা নিরাপদ নয়।",
    },
    chip: { en: "Minimum weight?", bn: "সর্বনিম্ন ওজন কত?" },
    follow: ["age_limit", "blood_amount", "who_can_donate"],
  },
  {
    id: "cant_donate",
    examples: [
      "which illnesses stop me from donating", "diseases that prevent blood donation", "can a hepatitis patient give blood", "can people with hiv donate", "kon rog thakle rokto deya jay na", "hepatitis b hole rokto dite parbo", "যেসব রোগে রক্তদান করা যায় না", "ক্যান্সার রোগী কি রক্ত দিতে পারে", "had jaundice before, am i allowed", "heart disease thakle donate kora jay",
      "who cannot donate blood", "which diseases stop you from donating blood", "can someone with hepatitis b donate", "HIV positive can donate blood?",
      "can a cancer patient donate blood", "heart patient rokto dite parbe", "kara rokto dite parbe na", "কারা রক্ত দিতে পারবে না",
      "কোন রোগ থাকলে রক্ত দেওয়া যায় না", "jondis hoyechilo rokto dite parbo", "permanent deferral reasons", "drug user can donate?",
      "haemophilia thakle rokto deya jay", "জন্ডিস বা হেপাটাইটিস থাকলে রক্ত দেওয়া যাবে",
    ],
    answer: {
      en: "You usually **cannot** donate if you have or had:\n- HIV, hepatitis B or hepatitis C\n- Heart disease or uncontrolled high blood pressure\n- Cancer, or a blood disorder like thalassemia major or haemophilia\n- Insulin-dependent diabetes\n- Ever injected drugs not prescribed by a doctor\n\nThis is general information; the blood bank's doctor decides.",
      bn: "সাধারণত রক্ত দিতে **পারবেন না** যদি আপনার থাকে বা ছিল:\n- এইচআইভি, হেপাটাইটিস বি বা সি\n- হৃদরোগ বা অনিয়ন্ত্রিত উচ্চ রক্তচাপ\n- ক্যান্সার, অথবা থ্যালাসেমিয়া মেজর বা হিমোফিলিয়ার মতো রক্তের রোগ\n- ইনসুলিন-নির্ভর ডায়াবেটিস\n- কখনো চিকিৎসকের ব্যবস্থাপত্র ছাড়া ইনজেকশনে মাদক নিয়েছেন\n\nএটি সাধারণ তথ্য; চূড়ান্ত সিদ্ধান্ত ব্লাড ব্যাংকের চিকিৎসকের।",
    },
    links: [link("/eligibility", "Donor guide", "রক্তদাতা নির্দেশিকা")],
    chip: { en: "Who can't donate?", bn: "কারা রক্ত দিতে পারবেন না?" },
    follow: ["chronic_conditions", "waiting_periods", "illness_wait"],
  },
  {
    id: "waiting_periods",
    examples: [
      "অস্ত্রোপচার হয়েছে, কবে রক্ত দিতে পারব", "surgery hoyeche kobe donate korbo", "after a tattoo how many months",
      "how long after a tattoo can I give blood", "had my ears pierced, when can I donate", "wait time after operation", "after surgery when can I donate", "operation korsi 3 mash age, rokto dibo?", "বড় অপারেশনের পর রক্ত দেওয়ার নিয়ম", "ট্যাটু করলে রক্ত দেওয়া যায়?", "piercing korle koto mash wait", "daat tolar por rokto deya", "after root canal can i donate",
      "can I donate after getting a tattoo", "I got a piercing last month can I donate", "how long to wait after surgery to donate blood",
      "tattoo korle koto din por rokto deya jay", "nak fora / kan fora korle rokto dite parbo", "operation er por koto din por donate",
      "ট্যাটু করার পর কত দিন পর রক্ত দেওয়া যায়", "অপারেশনের পর রক্ত দিতে কত দিন অপেক্ষা", "দাঁত তোলার পর রক্ত দেওয়া যাবে",
      "tooth extraction then blood donation", "daat tulsi gotokal, rokto dite parbo?", "waiting period after major surgery",
      "can I donate after a dental procedure", "had an operation 2 months ago",
    ],
    answer: {
      en: "Common waiting periods before donating:\n- **Tattoo or piercing:** 6 months\n- **Major surgery:** 6 months\n- **Tooth extraction or minor procedure:** 1 week\n\nRules can differ a little between blood banks, so the doctor there makes the final call.",
      bn: "রক্তদানের আগে সাধারণ অপেক্ষার সময়:\n- **ট্যাটু বা পিয়ার্সিং:** ৬ মাস\n- **বড় অস্ত্রোপচার:** ৬ মাস\n- **দাঁত তোলা বা ছোট চিকিৎসা-প্রক্রিয়া:** ১ সপ্তাহ\n\nব্লাড ব্যাংকভেদে নিয়ম কিছুটা ভিন্ন হতে পারে, তাই সেখানকার চিকিৎসকই চূড়ান্ত সিদ্ধান্ত নেন।",
    },
    links: [link("/eligibility", "All waiting periods", "সব অপেক্ষার সময়")],
    chip: { en: "Tattoo or surgery wait?", bn: "ট্যাটু/অপারেশনের পর কত দিন?" },
    follow: ["illness_wait", "women_donors", "cant_donate"],
  },
  {
    id: "illness_wait",
    examples: [
      "সর্দি-জ্বরের পর কত দিন অপেক্ষা", "jor er por koto din wait korbo", "fever er moddhe donate kora jay",
      "I have a fever today, can I donate", "can I donate while taking medicine for infection", "recovered from malaria, can I donate", "flu hoyeche, rokto deya jabe?", "jor sere geche, kobe donate korbo", "জ্বর নিয়ে রক্ত দেওয়া ঠিক?", "অসুস্থ অবস্থায় রক্ত দেওয়া যায়?", "antibiotic course sesh hole kobe rokto dibo", "cold and cough, should I donate", "ম্যালেরিয়া থেকে সুস্থ হয়েছি",
      "can I donate blood if I have fever", "I have a cold, can I give blood", "taking antibiotics can I donate", "had malaria can I donate blood",
      "jor hoyeche rokto dite parbo", "antibiotic khacchi rokto deya jabe", "ম্যালেরিয়া হলে কত দিন পর রক্ত দেওয়া যায়",
      "জ্বর থাকলে কি রক্ত দেওয়া যায়", "ঠান্ডা সর্দি নিয়ে রক্ত দেওয়া যাবে", "flu er por koto din por donate", "after antibiotics how long to wait",
      "sordi kashi niye rokto deya", "অ্যান্টিবায়োটিক খাওয়ার পর রক্তদান", "i am sick today, should i donate",
    ],
    answer: {
      en: "If you're unwell, wait:\n- **Fever, cold or flu:** until you've fully recovered\n- **Antibiotics:** 1 week after the last dose\n- **Malaria:** 3 months after full recovery\n\nDonate only when you feel healthy. The blood bank's doctor will check you on the day.",
      bn: "অসুস্থ থাকলে অপেক্ষা করুন:\n- **জ্বর, সর্দি বা ফ্লু:** পুরোপুরি সুস্থ না হওয়া পর্যন্ত\n- **অ্যান্টিবায়োটিক:** শেষ ডোজের ১ সপ্তাহ পর\n- **ম্যালেরিয়া:** সম্পূর্ণ সুস্থ হওয়ার ৩ মাস পর\n\nসুস্থ বোধ করলেই রক্ত দিন। রক্তদানের দিন ব্লাড ব্যাংকের চিকিৎসক আপনাকে পরীক্ষা করবেন।",
    },
    links: [link("/eligibility", "Donor guide", "রক্তদাতা নির্দেশিকা")],
    chip: { en: "Fever or antibiotics?", bn: "জ্বর বা অ্যান্টিবায়োটিক?" },
    follow: ["waiting_periods", "chronic_conditions", "who_can_donate"],
  },
  {
    id: "women_donors",
    examples: [
      "দুধ খাওয়ানো মা কি রক্ত দিতে পারেন", "pregnancy er por kobe donate", "can a woman donate after childbirth",
      "can girls donate blood", "is it safe for women to donate", "pregnant women donate blood?", "can a nursing mother donate blood", "breastfeeding mother rokto dite parbe", "মা হওয়ার পর কবে রক্ত দিতে পারব", "পিরিয়ডের সময় রক্ত দেওয়া কি ঠিক", "মেয়েদের রক্তদানের নিয়ম", "mayera rokto dite pare ki", "after giving birth can i donate",
      "can women donate blood", "can I donate during my period", "can a pregnant woman donate blood", "can I donate while breastfeeding",
      "meyera ki rokto dite pare", "period cholakalin rokto deya jabe", "pregnant obosthay rokto deya", "মেয়েরা কি রক্ত দিতে পারে",
      "মাসিকের সময় রক্ত দেওয়া যায়", "সন্তান হওয়ার পর কত দিন পর রক্ত দেওয়া যায়", "after delivery when can I donate",
      "bacha ke dudh khawacchi, rokto dite parbo", "গর্ভবতী অবস্থায় রক্তদান", "female donor rules",
    ],
    answer: {
      en: "Yes, women can donate if they meet the usual rules (18–65, 45 kg+, feeling well).\n- **Pregnancy:** don't donate while pregnant; wait **6 months after delivery**\n- **Breastfeeding:** not while breastfeeding\n- **Period:** many women donate normally; if you feel weak or bleeding is heavy, wait a few days\n\nThe blood bank checks your haemoglobin, and its doctor decides.",
      bn: "হ্যাঁ, স্বাভাবিক শর্ত পূরণ করলে (১৮–৬৫ বছর, ৪৫ কেজি+, সুস্থ) নারীরাও রক্ত দিতে পারেন।\n- **গর্ভাবস্থা:** গর্ভাবস্থায় নয়; **প্রসবের ৬ মাস পর**\n- **বুকের দুধ খাওয়ানো:** এ সময় নয়\n- **মাসিক:** অনেকেই স্বাভাবিকভাবে দেন; দুর্বল লাগলে বা রক্তপাত বেশি হলে কয়েক দিন অপেক্ষা করুন\n\nব্লাড ব্যাংক হিমোগ্লোবিন পরীক্ষা করে, চিকিৎসকই সিদ্ধান্ত নেন।",
    },
    chip: { en: "Women and donation", bn: "নারী ও রক্তদান" },
    follow: ["who_can_donate", "before_donating", "waiting_periods"],
  },
  {
    id: "chronic_conditions",
    examples: [
      "I'm diabetic, can I donate blood", "blood pressure patient donate korte parbe", "I take daily medication, can I give blood", "high bp thakle rokto deya jay", "sugar thakle rokto dewa jay", "প্রেশারের রোগী কি রক্ত দিতে পারে", "ডায়াবেটিসের ওষুধ খাই, রক্ত দেব?", "i am on insulin, can i donate", "medicine khele donate kora jabe", "regular oshudh khai",
      "can diabetic people donate blood", "I have high blood pressure can I donate", "can I donate if I take medicine",
      "diabetes thakle rokto deya jay", "pressure er rogi rokto dite parbe", "ami protidin oshudh khai, rokto dite parbo",
      "ডায়াবেটিস থাকলে কি রক্ত দেওয়া যায়", "উচ্চ রক্তচাপ থাকলে রক্তদান", "ঔষধ খেলে রক্ত দেওয়া যাবে", "low blood pressure donate",
      "thyroid medicine khai donate kora jabe", "I am on blood pressure tablets", "sugar er oshukh ache rokto dibo",
      "asthma patient can donate blood",
    ],
    answer: {
      en: "It depends on the condition and how well it's controlled:\n- **Diabetes:** often fine if controlled by diet or tablets; **insulin-dependent** diabetes usually can't donate\n- **Blood pressure:** controlled BP is often fine; **uncontrolled** BP is not\n- **Medicines:** many are fine, some need a wait\n\nAlways tell the blood bank's doctor about your conditions and medicines. They decide; don't stop any medicine to donate.",
      bn: "রোগ কী এবং কতটা নিয়ন্ত্রণে আছে তার ওপর নির্ভর করে:\n- **ডায়াবেটিস:** খাদ্য বা ট্যাবলেটে নিয়ন্ত্রিত হলে প্রায়ই সমস্যা নেই; **ইনসুলিন-নির্ভর** হলে সাধারণত নয়\n- **রক্তচাপ:** নিয়ন্ত্রিত হলে প্রায়ই চলে; **অনিয়ন্ত্রিত** হলে নয়\n- **ওষুধ:** অনেক ওষুধে সমস্যা নেই, কিছুতে অপেক্ষা লাগে\n\nব্লাড ব্যাংকের চিকিৎসককে আপনার রোগ ও ওষুধের কথা জানান, তিনিই সিদ্ধান্ত নেবেন। রক্ত দেওয়ার জন্য কোনো ওষুধ বন্ধ করবেন না।",
    },
    chip: { en: "Diabetes or BP?", bn: "ডায়াবেটিস বা প্রেশার?" },
    follow: ["cant_donate", "illness_wait", "who_can_donate"],
  },

  // ---------------------------------------------------------------- donation day
  {
    id: "before_donating",
    examples: [
      "kal rokto dite jabo, age ki korbo", "night before donation tips",
      "what should I do the night before donating", "pre-donation tips", "things to remember before giving blood", "rokto dite jawar age ki korbo", "রক্তদানের আগের প্রস্তুতি", "রক্ত দেওয়ার আগে কী খাব", "donate er age ki khawa uchit", "is it okay to donate without eating", "khali pete rokto deya jay?",
      "what to do before donating", "how to prepare for blood donation", "tips before giving blood", "should I eat before donating blood",
      "rokto deyar age ki korbo", "donate korar age ki khabo", "রক্তদানের আগে কী করা উচিত", "রক্ত দেওয়ার আগে খালি পেটে যাব",
      "can I donate on an empty stomach", "kal rokto dibo, ki prostuti nibo", "preparation for blood donation tomorrow",
      "রক্ত দেওয়ার আগের রাতে কী করব", "should i sleep well before donating",
    ],
    answer: {
      en: "Before you donate:\n- Eat a proper meal 2–3 hours before; **don't go on an empty stomach**\n- Drink plenty of water\n- Sleep well the night before\n- Avoid very oily food, smoking and alcohol\n- Bring an ID and wear a shirt with loose sleeves\n\nTell the blood bank about any illness or medicines.",
      bn: "রক্ত দেওয়ার আগে:\n- ২–৩ ঘণ্টা আগে ভালোভাবে খেয়ে নিন; **খালি পেটে যাবেন না**\n- প্রচুর পানি পান করুন\n- আগের রাতে ভালো ঘুমান\n- বেশি তেলেভাজা খাবার, ধূমপান ও মদ এড়িয়ে চলুন\n- পরিচয়পত্র নিন এবং ঢিলা হাতার জামা পরুন\n\nকোনো অসুখ বা ওষুধ থাকলে ব্লাড ব্যাংককে জানান।",
    },
    chip: { en: "Tips before donating", bn: "রক্তদানের আগে করণীয়" },
    follow: ["after_donating", "what_to_eat", "donation_duration"],
  },
  {
    id: "after_donating",
    examples: [
      "rokto deya hoye gele ki korbo", "after donation what should I avoid",
      "rokto dewar por rest koto khon", "donate kore ashar por ki korbo", "রক্ত দেওয়ার পর কী মানতে হবে",
      "precautions after donating blood", "what not to do after giving blood", "after donating can I drive", "rokto dewar por ki ki korbo na", "donate er por kotokkhon rest", "রক্তদানের পর কী কী করা যাবে না", "রক্ত দেওয়ার পর ব্যায়াম করা যাবে?", "donation sesh hole ki korbo",
      "what to do after donating blood", "care after blood donation", "can I go to gym after donating", "rokto deyar por ki korbo",
      "donate korar por ki kora uchit", "রক্ত দেওয়ার পর কী করা উচিত", "রক্তদানের পর বিশ্রাম কতক্ষণ", "after donation can I play football",
      "rokto diye ki office e jete parbo", "how long to rest after giving blood", "can I smoke after donating", "bandage kokhon khulbo",
      "রক্ত দেওয়ার পর মাথা ঘুরলে কী করব",
    ],
    answer: {
      en: "After donating:\n- Rest 10–15 minutes and have the snack/drink offered\n- Drink extra water for the next day or two\n- Avoid heavy lifting and hard exercise for the rest of the day\n- Keep the bandage on for a few hours\n- If you feel dizzy, lie down with your legs raised\n\nMost people go back to normal work the same day.",
      bn: "রক্ত দেওয়ার পর:\n- ১০–১৫ মিনিট বিশ্রাম নিন এবং দেওয়া নাস্তা/পানীয় খান\n- পরের এক-দুই দিন বেশি পানি পান করুন\n- সেদিন ভারী জিনিস তোলা ও কঠোর ব্যায়াম এড়িয়ে চলুন\n- কয়েক ঘণ্টা ব্যান্ডেজ রাখুন\n- মাথা ঘুরলে শুয়ে পা একটু উঁচু করে রাখুন\n\nবেশিরভাগ মানুষ একই দিনে স্বাভাবিক কাজে ফিরতে পারেন।",
    },
    chip: { en: "Care after donating", bn: "রক্তদানের পর করণীয়" },
    follow: ["what_to_eat", "side_effects", "donation_gap"],
  },
  {
    id: "what_to_eat",
    examples: [
      "রক্তদাতাদের জন্য কোন খাবার ভালো", "rokto deyar por ki khele bhalo",
      "রক্ত দিয়ে কী খাব", "কী খেলে শরীর দ্রুত সেরে ওঠে", "ki khabo donation er por", "best food after giving blood",
      "foods that raise blood count", "foods to recover after donating", "what to eat to increase hemoglobin", "iron er jonno ki khabo", "rokto barar khabar", "রক্তদাতাদের খাদ্যতালিকা", "হিমোগ্লোবিন বাড়ানোর খাবার", "diet after blood donation", "ki khele rokto bare",
      "what should I eat after donating blood", "food to increase blood", "iron rich food for donors", "rokto barate ki khabo",
      "rokto deyar por ki khawa uchit", "রক্ত বাড়াতে কী খাওয়া উচিত", "রক্ত দেওয়ার পর কী খাব", "best diet for blood donors",
      "hemoglobin barate ki khete hobe", "what to eat to recover after donation", "আয়রনযুক্ত খাবার কোনগুলো", "donor der khabar",
    ],
    answer: {
      en: "Eat well before and after donating, with **iron-rich food**:\n- Fish, eggs, meat and liver\n- Dal (lentils), spinach and other green leafy vegetables\n- Dates and nuts\n- Vitamin C fruits like guava, lemon or orange help absorb iron\n\nAnd drink plenty of water. Avoid tea or coffee right with meals.",
      bn: "রক্তদানের আগে ও পরে ভালোভাবে খান, বিশেষ করে **আয়রনসমৃদ্ধ খাবার**:\n- মাছ, ডিম, মাংস ও কলিজা\n- ডাল, পালং ও অন্যান্য সবুজ শাক\n- খেজুর ও বাদাম\n- পেয়ারা, লেবু বা কমলার মতো ভিটামিন সি-যুক্ত ফল আয়রন শোষণে সাহায্য করে\n\nপ্রচুর পানি পান করুন। খাবারের সাথে সাথেই চা বা কফি এড়িয়ে চলুন।",
    },
    chip: { en: "What should I eat?", bn: "কী খাব?" },
    follow: ["after_donating", "before_donating"],
  },
  {
    id: "donation_duration",
    examples: [
      "how long will the donation take", "how much time to give one bag", "how many minutes does it take to donate", "time needed for blood donation", "rokto dite koto shomoy lage", "donate korte kotokkhon lagbe", "রক্তদানে কত মিনিট লাগে", "পুরো প্রক্রিয়া কতক্ষণ",
      "how long does blood donation take", "how much time does it take to donate blood", "koto khon lage rokto dite", "রক্ত দিতে কতক্ষণ সময় লাগে",
      "is donating blood quick", "rokto dite koto minute lage", "total time at the blood bank", "রক্তদান প্রক্রিয়ায় কত মিনিট",
      "how many minutes for one bag", "donation e koto time lagbe", "what happens during donation process",
    ],
    answer: {
      en: "The whole visit usually takes **30–45 minutes**: registration, a short health check (weight, blood pressure, haemoglobin), the donation itself and a short rest.\n\nThe actual blood collection takes only about **8–10 minutes**.",
      bn: "পুরো প্রক্রিয়ায় সাধারণত **৩০–৪৫ মিনিট** লাগে: নিবন্ধন, ছোট স্বাস্থ্য পরীক্ষা (ওজন, রক্তচাপ, হিমোগ্লোবিন), রক্তদান এবং অল্প বিশ্রাম।\n\nআসল রক্ত নেওয়ায় লাগে মাত্র **৮–১০ মিনিট**।",
    },
    chip: { en: "How long does it take?", bn: "কতক্ষণ লাগে?" },
    follow: ["does_it_hurt", "blood_amount", "before_donating"],
  },
  {
    id: "does_it_hurt",
    examples: [
      "will it hurt", "is giving blood painful", "betha pabo ki rokto dite", "রক্ত দিতে কি ব্যথা লাগে", "সুই ফোটাতে ব্যথা হয়?", "I am afraid of pain", "needle e voy lage",
      "does donating blood hurt", "is blood donation painful", "rokto dite ki betha lage", "ব্যথা লাগে কি রক্ত দিতে",
      "I'm scared of needles", "suich e voy pai", "is the needle big", "সুইয়ে ভয় পাই, রক্ত দিতে কষ্ট হয়?", "does it pain much",
      "rokto dile ki kosto hoy", "first time donor and nervous",
    ],
    answer: {
      en: "Most people feel only a **quick pinch** when the needle goes in, and maybe slight soreness afterwards. During the donation you'll hardly feel anything.\n\nIf you're nervous, tell the staff: they're used to first-time donors. Look away, breathe slowly and chat with them.",
      bn: "সুই ঢোকানোর সময় বেশিরভাগ মানুষ শুধু **একটু চিমটির মতো** অনুভব করেন, পরে হয়তো সামান্য ব্যথা থাকে। রক্ত নেওয়ার সময় প্রায় কিছুই টের পাবেন না।\n\nভয় লাগলে কর্মীদের বলুন, তাঁরা প্রথমবারের রক্তদাতাদের সাথে অভ্যস্ত। অন্যদিকে তাকান, ধীরে শ্বাস নিন।",
    },
    chip: { en: "Does it hurt?", bn: "ব্যথা লাগে?" },
    follow: ["side_effects", "donation_duration", "before_donating"],
  },
  {
    id: "side_effects",
    examples: [
      "রক্তদানের ক্ষতিকর দিক", "any harm in giving blood", "rokto dile kono problem hoy?",
      "is donating blood bad for health", "risks of blood donation", "will donating make me weak", "can giving blood harm me", "rokto dile shorirer khoti hoy ki", "rokto dile durbol lage", "রক্তদান স্বাস্থ্যের জন্য ঝুঁকিপূর্ণ?", "রক্তদানের পর মাথা ঘোরা কি স্বাভাবিক", "dizziness after donation normal?", "rokto dile matha ghore keno",
      "side effects of donating blood", "is blood donation harmful", "will I feel weak after donating", "rokto dile ki shorir durbol hoy",
      "rokto deyar kuprobhab", "রক্ত দিলে কি শরীর দুর্বল হয়", "রক্তদানের পার্শ্বপ্রতিক্রিয়া", "is it safe to donate blood",
      "felt dizzy after donating", "bruise on arm after donation", "rokto dile ki khoti hoy", "can donating blood make you sick",
    ],
    answer: {
      en: "Donating is **safe** for healthy people, and a new sterile needle is used every time. Some people get mild, short-lived effects:\n- Light dizziness or tiredness\n- A small bruise or soreness on the arm\n\nRest, drink fluids and eat well. If you feel unwell for more than a day, contact a doctor.",
      bn: "সুস্থ মানুষের জন্য রক্তদান **নিরাপদ**, আর প্রতিবার নতুন জীবাণুমুক্ত সুই ব্যবহার করা হয়। কারো কারো সামান্য ও অল্প সময়ের সমস্যা হতে পারে:\n- হালকা মাথা ঘোরা বা ক্লান্তি\n- হাতে ছোট কালশিটে বা ব্যথা\n\nবিশ্রাম নিন, পানি পান করুন ও ভালোভাবে খান। এক দিনের বেশি খারাপ লাগলে চিকিৎসকের সাথে যোগাযোগ করুন।",
    },
    chip: { en: "Any side effects?", bn: "কোনো পার্শ্বপ্রতিক্রিয়া?" },
    follow: ["after_donating", "what_to_eat", "does_it_hurt"],
  },
  {
    id: "blood_amount",
    examples: [
      "how much blood do you lose when donating", "how many ml do they take", "volume of one blood donation", "koto ml rokto ney", "rokto deyar shomoy koto tuku ney", "এক ব্যাগ রক্তের পরিমাণ কত", "রক্তদানে কত মিলি নেয়", "one bag means how much blood",
      "how much blood is taken", "how many ml in one bag of blood", "how much blood do they take from a donor", "ek bag e koto ml rokto",
      "koto tuku rokto ney", "এক ব্যাগে কত মিলি রক্ত", "রক্তদানে কতটুকু রক্ত নেওয়া হয়", "what is one unit of blood",
      "1 unit blood means how much", "450 ml or 350 ml", "shorir theke koto rokto ney", "how long to replace donated blood",
    ],
    answer: {
      en: "A standard donation is **one bag (one unit), about 450 ml** (some blood banks use 350 ml bags). That's roughly a tenth of an adult's blood.\n\nYour body replaces the fluid within a day or two and the red cells over the following weeks, which is why there's a 4-month gap.",
      bn: "সাধারণ রক্তদান হলো **এক ব্যাগ (এক ইউনিট), প্রায় ৪৫০ মিলি** (কিছু ব্লাড ব্যাংক ৩৫০ মিলির ব্যাগ ব্যবহার করে)। এটি একজন প্রাপ্তবয়স্কের মোট রক্তের প্রায় দশ ভাগের এক ভাগ।\n\nশরীর এক-দুই দিনে তরল অংশ এবং পরের কয়েক সপ্তাহে লোহিত কণিকা পূরণ করে নেয়, তাই ৪ মাসের বিরতি।",
    },
    chip: { en: "How much blood is taken?", bn: "কতটুকু রক্ত নেওয়া হয়?" },
    follow: ["donation_gap", "donation_duration", "weight_limit"],
  },
  {
    id: "why_donate",
    examples: [
      "why do people donate blood", "রক্ত দিলে উপকার কী", "what's the point of donating blood",
      "why donate blood", "benefits of giving blood", "what good does donating do", "why is blood donation important", "rokto dan keno koro", "rokto dile ki upokar hoy", "রক্তদান কেন গুরুত্বপূর্ণ", "রক্তদানের সুফল", "does donating blood help my health",
      "why should I donate blood", "benefits of donating blood", "is donating blood good for health", "rokto deyar upokarita",
      "keno rokto dibo", "রক্তদানের উপকারিতা কী", "কেন রক্ত দেওয়া উচিত", "how many lives does one donation save",
      "rokto dile ki labh", "what are the advantages of being a blood donor", "motivate me to donate blood",
    ],
    answer: {
      en: "One donation can help **up to three patients**, because it can be separated into red cells, platelets and plasma. Accident victims, mothers in childbirth, surgery, cancer and thalassemia patients all depend on donors.\n\nYou also get a free mini check-up (blood pressure, haemoglobin, blood group) and the joy of saving a life.",
      bn: "এক ব্যাগ রক্ত **তিনজন পর্যন্ত রোগীর** কাজে লাগতে পারে, কারণ তা থেকে লোহিত কণিকা, প্লাটিলেট ও প্লাজমা আলাদা করা যায়। দুর্ঘটনার রোগী, প্রসূতি মা, অস্ত্রোপচার, ক্যান্সার ও থ্যালাসেমিয়ার রোগীরা রক্তদাতাদের ওপর নির্ভর করেন।\n\nসাথে বিনা খরচে ছোট স্বাস্থ্য পরীক্ষা (রক্তচাপ, হিমোগ্লোবিন, গ্রুপ) এবং একটি জীবন বাঁচানোর আনন্দ।",
    },
    chip: { en: "Why donate?", bn: "কেন রক্ত দেব?" },
    follow: ["become_donor", "who_can_donate", "blood_components"],
  },

  // ---------------------------------------------------------------- blood basics
  {
    id: "blood_groups",
    examples: [
      "how do I know which blood group I have", "list all blood groups", "what blood types exist", "amar rokter group jani na", "rokter group test kivabe kori", "রক্তের গ্রুপ জানব কীভাবে", "blood group koyta ache",
      "what are the blood groups", "how many blood groups are there", "how do I know my blood group", "blood group test kothay korbo",
      "amar blood group ki kivabe jante parbo", "রক্তের গ্রুপ কয়টি", "আমার রক্তের গ্রুপ কীভাবে জানব", "types of blood",
      "ABO system explained", "rokter group koyta", "I don't know my blood group", "blood group ki jinis",
    ],
    answer: {
      en: "There are **8 main blood groups**: A+, A−, B+, B−, AB+, AB−, O+ and O−. The letter is the ABO type and +/− is the Rh factor.\n\nTo know yours, get a simple blood grouping test at any hospital or diagnostic centre. Blood banks also test it when you donate.",
      bn: "রক্তের প্রধান গ্রুপ **৮টি**: A+, A−, B+, B−, AB+, AB−, O+ ও O−। অক্ষরটি ABO ধরন, আর +/− হলো Rh ফ্যাক্টর।\n\nনিজের গ্রুপ জানতে যেকোনো হাসপাতাল বা ডায়াগনস্টিক সেন্টারে সাধারণ ব্লাড গ্রুপিং পরীক্ষা করান। রক্ত দিলে ব্লাড ব্যাংকও এটি পরীক্ষা করে।",
    },
    chip: { en: "Blood groups explained", bn: "রক্তের গ্রুপ পরিচিতি" },
    follow: ["universal_donor", "negative_rare", "compatibility"],
  },
  {
    id: "universal_donor",
    examples: [
      "which blood type can be given to everyone", "which group can donate to all", "universal recipient blood type", "kon group shob group ke rokto dite pare", "সব গ্রুপকে রক্ত দিতে পারে কোন গ্রুপ", "ইউনিভার্সাল রিসিপিয়েন্ট কোন গ্রুপ", "universal donor ke", "o negative sobai ke dite pare?",
      "universal donor", "which blood group is the universal donor", "who is the universal recipient", "universal donor kon group",
      "sobai ke rokto dite pare kon group", "সর্বজনীন রক্তদাতা কোন গ্রুপ", "কোন গ্রুপ সবার কাছ থেকে রক্ত নিতে পারে",
      "is O negative universal", "AB positive universal recipient?", "best blood group to give everyone", "sob group er rokto ke nite pare",
    ],
    answer: {
      en: "For red cells:\n- **O−** is the universal donor: it can be given to any group in an emergency\n- **AB+** is the universal recipient: they can receive any group\n\nFor plasma it's the other way round (AB plasma suits everyone). Hospitals still cross-match before every transfusion.",
      bn: "লোহিত কণিকার ক্ষেত্রে:\n- **O−** সর্বজনীন রক্তদাতা: জরুরি অবস্থায় যেকোনো গ্রুপকে দেওয়া যায়\n- **AB+** সর্বজনীন গ্রহীতা: যেকোনো গ্রুপের রক্ত নিতে পারেন\n\nপ্লাজমার ক্ষেত্রে উল্টো (AB প্লাজমা সবাইকে দেওয়া যায়)। তবু প্রতিবার রক্ত দেওয়ার আগে হাসপাতাল ক্রস-ম্যাচ করে।",
    },
    chip: { en: "Who is the universal donor?", bn: "সর্বজনীন রক্তদাতা কে?" },
    follow: ["compatibility", "negative_rare", "cross_matching"],
  },
  {
    id: "negative_rare",
    examples: [
      "what is rh negative", "what does negative mean in blood group", "why is negative blood hard to find", "rare blood group", "negative group keno kom", "নেগেটিভ মানে কী", "নেগেটিভ রক্ত পাওয়া কঠিন কেন", "negative rokto rare keno", "positive and negative difference",
      "why is negative blood rare", "what does rh negative mean", "is O negative rare in Bangladesh", "negative group pawa jay na keno",
      "rh factor ki", "নেগেটিভ গ্রুপের রক্ত কেন কম পাওয়া যায়", "আরএইচ নেগেটিভ মানে কী", "rare blood group bangladesh",
      "negative patient can take positive blood?", "negative rokto khuje pacchi na", "which blood group is rarest",
    ],
    answer: {
      en: "**Rh-negative** groups (A−, B−, AB−, O−) are rare: only a small share of people in Bangladesh have them, so they're hard to find quickly.\n\nRh-negative patients usually need Rh-negative blood. If you have a negative group, registering as a donor really matters. When searching, also post a request so matching donors get notified.",
      bn: "**Rh-নেগেটিভ** গ্রুপ (A−, B−, AB−, O−) বিরল: বাংলাদেশে খুব কম মানুষের এই গ্রুপ, তাই দ্রুত পাওয়া কঠিন।\n\nRh-নেগেটিভ রোগীদের সাধারণত নেগেটিভ রক্তই লাগে। আপনার গ্রুপ নেগেটিভ হলে রক্তদাতা হিসেবে নিবন্ধন খুবই জরুরি। খোঁজার সময় একটি অনুরোধও পোস্ট করুন, যাতে উপযুক্ত রক্তদাতারা বিজ্ঞপ্তি পান।",
    },
    chip: { en: "Why is negative blood rare?", bn: "নেগেটিভ রক্ত কেন বিরল?" },
    follow: ["compatibility", "become_donor", "post_request"],
  },
  {
    id: "blood_components",
    examples: [
      "platelet shelf life", "how long is blood good for", "what is plasma", "what are platelets used for", "platelet koydin rakha jay", "rokto koto din store kora jay", "প্লাজমা কী", "রক্তের উপাদান কী কী", "red cell er meyad", "blood expiry date",
      "what is the difference between platelets and plasma", "how long can blood be stored", "shelf life of platelets", "what are red cells",
      "platelet ki", "plasma kototin rakha jay", "রক্ত কতদিন সংরক্ষণ করা যায়", "প্লাটিলেট আর প্লাজমার পার্থক্য",
      "whole blood expiry", "dengue te platelet lage keno", "blood components explained", "rokto koydin bhalo thake",
      "প্লাটিলেট কত দিন ভালো থাকে",
    ],
    answer: {
      en: "Donated blood can be split into components, each with its own shelf life:\n- **Whole blood:** about 35 days\n- **Red cells:** about 42 days (carry oxygen)\n- **Platelets:** only 5 days (stop bleeding, often needed in dengue)\n- **Plasma:** about 1 year frozen\n\nBlood banks track expiry for every bag.",
      bn: "দান করা রক্ত বিভিন্ন উপাদানে ভাগ করা যায়, প্রতিটির মেয়াদ আলাদা:\n- **পূর্ণ রক্ত:** প্রায় ৩৫ দিন\n- **লোহিত কণিকা:** প্রায় ৪২ দিন (অক্সিজেন বহন করে)\n- **প্লাটিলেট:** মাত্র ৫ দিন (রক্তপাত থামায়, ডেঙ্গুতে প্রায়ই লাগে)\n- **প্লাজমা:** জমিয়ে রাখলে প্রায় ১ বছর\n\nব্লাড ব্যাংক প্রতিটি ব্যাগের মেয়াদ নজরে রাখে।",
    },
    chip: { en: "Platelets vs plasma", bn: "প্লাটিলেট বনাম প্লাজমা" },
    follow: ["universal_donor", "thalassemia", "cross_matching"],
  },
  {
    id: "thalassemia",
    examples: [
      "thalassemia patient needs blood every month", "thalassemia major transfusion", "what is thalassemia disease", "thalassemia ki rog", "thalassemia rogi koto din por por rokto ney", "থ্যালাসেমিয়া রোগীর জন্য নিয়মিত রক্ত", "থ্যালাসেমিয়া বাহক মানে কী", "my son is a thalassemia patient",
      "what is thalassemia", "how often do thalassemia patients need blood", "thalassemia rogir rokto lage koto din por",
      "থ্যালাসেমিয়া রোগীর কত দিন পরপর রক্ত লাগে", "থ্যালাসেমিয়া কী", "can thalassemia carrier donate blood",
      "my child has thalassemia need regular donor", "thalassemia te niyomito rokto", "thalassemia trait donate korte parbe",
      "regular donor for thalassemia patient", "থ্যালাসেমিয়া বাহক কি রক্ত দিতে পারে",
    ],
    answer: {
      en: "**Thalassemia** is an inherited blood disorder. Patients with thalassemia major need **regular transfusions**, often every 2–4 weeks, for life, so regular donors are a huge help.\n\nOn RoktoLagbe you can post a request each time and message donors who helped before. People with thalassemia major can't donate; carriers (trait) should ask the blood bank's doctor.",
      bn: "**থ্যালাসেমিয়া** একটি বংশগত রক্তের রোগ। থ্যালাসেমিয়া মেজর রোগীদের সারাজীবন **নিয়মিত রক্ত** লাগে, প্রায়ই ২–৪ সপ্তাহ পরপর, তাই নিয়মিত রক্তদাতারা বড় ভরসা।\n\nRoktoLagbe-এ প্রতিবার অনুরোধ পোস্ট করতে পারেন এবং আগে সাহায্য করা রক্তদাতাদের মেসেজ দিতে পারেন। থ্যালাসেমিয়া মেজর রোগীরা রক্ত দিতে পারেন না; বাহকরা (ট্রেইট) ব্লাড ব্যাংকের চিকিৎসকের পরামর্শ নিন।",
    },
    chip: { en: "About thalassemia", bn: "থ্যালাসেমিয়া সম্পর্কে" },
    follow: ["post_request", "donations_per_year", "messaging"],
  },
  {
    id: "cross_matching",
    examples: [
      "test korar por rogike rokto dey?", "how do they check blood is safe for the patient",
      "lab tests before transfusion", "blood screening tests", "রক্ত পরীক্ষা করে নেয়?",
      "what is a crossmatch test", "why is cross matching needed", "is blood tested before transfusion", "infection screening of blood bags", "cross match ki", "rokto deyar age ki test kore", "দান করা রক্তে কী কী পরীক্ষা হয়", "ক্রস ম্যাচ কেন লাগে", "blood test for hiv hepatitis before transfusion",
      "what is cross matching", "why do hospitals do crossmatch", "same group hole o cross match lage keno", "ক্রস ম্যাচিং কী",
      "রক্ত দেওয়ার আগে কী কী পরীক্ষা করা হয়", "screening tests on donated blood", "is donated blood tested for HIV",
      "crossmatch e koto time lage", "rokto test kore ney ki", "blood compatibility test before transfusion", "ক্রসম্যাচ কেন করতে হয়",
    ],
    answer: {
      en: "**Cross-matching** is a lab test where the donor's blood is mixed with the patient's sample to make sure they're compatible, even when the groups match. The hospital or blood bank does it before every transfusion.\n\nDonated blood is also screened for infections such as HIV, hepatitis B and C, syphilis and malaria.",
      bn: "**ক্রস-ম্যাচিং** একটি ল্যাব পরীক্ষা, যেখানে রক্তদাতার রক্ত রোগীর নমুনার সাথে মিলিয়ে দেখা হয় মিলে কি না, গ্রুপ এক হলেও। প্রতিবার রক্ত দেওয়ার আগে হাসপাতাল বা ব্লাড ব্যাংক এটি করে।\n\nদান করা রক্তে এইচআইভি, হেপাটাইটিস বি ও সি, সিফিলিস ও ম্যালেরিয়ার মতো সংক্রমণও পরীক্ষা করা হয়।",
    },
    chip: { en: "What is cross-matching?", bn: "ক্রস-ম্যাচিং কী?" },
    follow: ["compatibility", "universal_donor", "blood_components"],
  },

  // ---------------------------------------------------------------- account
  {
    id: "become_donor",
    examples: [
      "sign up to give blood", "নতুন ডোনার হিসেবে সাইন আপ", "donor account khulbo",
      "how can I join as a blood donor", "steps to become a donor", "sign me up as a donor", "I want to donate blood regularly, how to register", "donor howar niyom", "kivabe blood donor hote pari", "ডোনার হতে চাই কী করব", "রক্তদাতা হওয়ার উপায়", "donor registration process",
      "how do I become a donor", "I want to be a blood donor", "register as a donor", "sign up as blood donor", "how to join as donor",
      "ami donor hote chai", "donor hisebe nibondhon kivabe korbo", "kibhabe donor hobo", "রক্তদাতা হতে চাই", "কীভাবে রক্তদাতা হিসেবে নিবন্ধন করব",
      "add me to the donor list", "create donor profile", "donor list e naam dite chai", "how can i list myself as donor",
      "রক্তদাতা তালিকায় নাম লেখাতে চাই",
    ],
    answer: {
      en: "Becoming a donor takes a few minutes:\n- **Create an account** with your phone number\n- **Add and verify your email** (required for donors)\n- **Create your donor profile**: blood group, date of birth, weight and location\n\nChoose your blood group and date of birth carefully; they can't be changed later. Then people nearby can find you.",
      bn: "রক্তদাতা হতে কয়েক মিনিট লাগে:\n- ফোন নম্বর দিয়ে **অ্যাকাউন্ট খুলুন**\n- **ইমেইল যোগ করে যাচাই করুন** (রক্তদাতাদের জন্য আবশ্যক)\n- **রক্তদাতা প্রোফাইল তৈরি করুন**: রক্তের গ্রুপ, জন্মতারিখ, ওজন ও এলাকা\n\nরক্তের গ্রুপ ও জন্মতারিখ সাবধানে দিন, পরে বদলানো যায় না। তারপর কাছের মানুষ আপনাকে খুঁজে পাবেন।",
    },
    links: [link("/register", "Create account", "অ্যাকাউন্ট খুলুন"), link("/donor-profile", "Donor profile", "রক্তদাতা প্রোফাইল")],
    chip: { en: "Become a donor", bn: "রক্তদাতা হোন" },
    follow: ["verify_email", "who_can_donate", "availability_switch"],
  },
  {
    id: "login_options",
    examples: [
      "ways to log in", "login with phone or email", "google sign in", "sign in kivabe korbo", "login option ki ki", "লগ ইনের উপায় কী", "গুগল দিয়ে লগইন করা যাবে?", "can I log in using gmail",
      "how do I log in", "can I login with google", "login with email", "can I sign in with my phone number", "login kivabe korbo",
      "google diye login kora jay", "লগ ইন কীভাবে করব", "ইমেইল দিয়ে লগইন করা যায়", "i signed up with google, how to login with phone",
      "login korte parchi na", "sign in options", "ফোন নম্বর দিয়ে লগইন", "how to create an account", "account khulbo kivabe",
    ],
    answer: {
      en: "You can log in three ways: **Google**, your **phone number** or your **email**, with your password.\n\nNew here? Create an account with your phone number. If you joined with Google, set a password in **Account settings** to also log in with phone or email.",
      bn: "তিনভাবে লগ ইন করা যায়: **Google**, আপনার **ফোন নম্বর** অথবা **ইমেইল** ও পাসওয়ার্ড দিয়ে।\n\nনতুন? ফোন নম্বর দিয়ে অ্যাকাউন্ট খুলুন। Google দিয়ে যোগ দিলে **অ্যাকাউন্ট সেটিংস**-এ পাসওয়ার্ড সেট করুন, তাহলে ফোন বা ইমেইল দিয়েও লগ ইন করতে পারবেন।",
    },
    links: [link("/login", "Log in", "লগ ইন"), link("/register", "Create account", "অ্যাকাউন্ট খুলুন")],
    chip: { en: "How do I log in?", bn: "কীভাবে লগ ইন করব?" },
    follow: ["forgot_password", "become_donor", "session_timeout"],
  },
  {
    id: "forgot_password",
    examples: [
      "I lost my password", "recover my password", "forgot my login password", "password mone nai", "password reset code", "পাসওয়ার্ড মনে নেই", "পাসওয়ার্ড হারিয়ে ফেলেছি", "how to get a new password", "reset link not received",
      "I forgot my password", "reset password", "how to recover my account", "password bhule gechi", "password reset kivabe korbo",
      "পাসওয়ার্ড ভুলে গেছি", "পাসওয়ার্ড রিসেট করব কীভাবে", "reset code not coming", "didn't get the reset email",
      "otp ashche na password reset", "can't remember password", "pass vule gesi ki korbo", "forgot pass",
    ],
    answer: {
      en: "Go to **Forgot password** on the login page and choose:\n- **Phone:** we text you a 6-digit code, then you set a new password\n- **Email:** we send a reset link that works for **10 minutes** (your email must be verified)\n\nNo email? Check spam or use your phone number instead.",
      bn: "লগ ইন পেজে **পাসওয়ার্ড ভুলে গেছেন?**-এ যান এবং বেছে নিন:\n- **ফোন:** আমরা ৬ অঙ্কের কোড এসএমএস করব, তারপর নতুন পাসওয়ার্ড দিন\n- **ইমেইল:** একটি রিসেট লিংক পাঠাব, যা **১০ মিনিট** কাজ করবে (ইমেইল যাচাই করা থাকতে হবে)\n\nইমেইল না পেলে স্প্যাম ফোল্ডার দেখুন অথবা ফোন নম্বর ব্যবহার করুন।",
    },
    links: [link("/forgot-password", "Reset password", "পাসওয়ার্ড রিসেট")],
    chip: { en: "Forgot password", bn: "পাসওয়ার্ড ভুলে গেছি" },
    follow: ["login_options", "verify_email", "account_settings"],
  },
  {
    id: "verify_email",
    examples: [
      "email confirmation", "how to confirm my email address", "email verify hocche na", "verification link pai nai", "ইমেইল ভেরিফাই কীভাবে করব", "ইমেইল যাচাই না করলে কী হবে", "need to verify email to become donor", "verification email resend",
      "how do I verify my email", "email verification link not received", "why do I need to verify email", "email verify kivabe korbo",
      "verification mail ashe nai", "ইমেইল যাচাই কীভাবে করব", "ভেরিফিকেশন লিংক পাইনি", "resend verification email",
      "it says verify your email first", "email confirm korte hobe keno", "verify link expired", "email add korbo kothay",
    ],
    answer: {
      en: "Donors must have a **verified email** before they can be listed (it's also used for account recovery).\n- Open your **Dashboard** or **Account settings**\n- Add your email and tap **Send verification link**\n- Open the link in the email, then tap **I've verified it**\n\nNot there? Check spam, or resend after the countdown.",
      bn: "তালিকায় আসার আগে রক্তদাতাদের **ইমেইল যাচাই** করা আবশ্যক (অ্যাকাউন্ট পুনরুদ্ধারেও লাগে)।\n- **ড্যাশবোর্ড** বা **অ্যাকাউন্ট সেটিংস** খুলুন\n- ইমেইল দিয়ে **যাচাই লিংক পাঠান** চাপুন\n- ইমেইলের লিংক খুলে **যাচাই করেছি** চাপুন\n\nনা পেলে স্প্যাম ফোল্ডার দেখুন, অথবা কাউন্টডাউন শেষে আবার পাঠান।",
    },
    links: [link("/settings", "Account settings", "অ্যাকাউন্ট সেটিংস")],
    chip: { en: "Verify my email", bn: "ইমেইল যাচাই" },
    follow: ["become_donor", "add_phone", "forgot_password"],
  },
  {
    id: "add_phone",
    examples: [
      "add mobile number", "why is a phone number required", "where to add my phone", "phone number vul diyechi", "mobile number add korte hobe keno", "মোবাইল নম্বর কোথায় দেব", "ফোন নম্বর ভুল দিয়েছি", "can't post request without phone", "update phone number",
      "how do I add my phone number", "it says add phone to post a request", "why do you need my phone number", "phone number add korbo kivabe",
      "mobile number dite hobe keno", "ফোন নম্বর যোগ করব কীভাবে", "নম্বর ছাড়া কি অনুরোধ পোস্ট করা যায়", "change my phone number",
      "wrong phone number dilam ki korbo", "phone number poriborton", "ফোন নম্বর পরিবর্তন করতে চাই", "google account has no phone",
    ],
    answer: {
      en: "A **phone number is required** to become a donor and to post blood requests, so patients and blood banks can reach you. Add it from the **Add phone** prompt on your dashboard.\n\nDouble-check it: you can't change it yourself later. If it's wrong, send us a note through the **Complaint box** (\"A problem with the app\").",
      bn: "রক্তদাতা হতে এবং রক্তের অনুরোধ পোস্ট করতে **ফোন নম্বর আবশ্যক**, যাতে রোগী ও ব্লাড ব্যাংক যোগাযোগ করতে পারে। ড্যাশবোর্ডের **ফোন যোগ করুন** থেকে নম্বর দিন।\n\nভালো করে মিলিয়ে নিন, পরে নিজে বদলানো যায় না। ভুল হলে **অভিযোগ বাক্সে** (\"অ্যাপের সমস্যা\") জানান।",
    },
    links: [link("/add-phone", "Add phone", "ফোন যোগ করুন")],
    chip: { en: "Add my phone", bn: "ফোন নম্বর যোগ" },
    follow: ["phone_privacy", "post_request", "become_donor"],
  },
  {
    id: "account_settings",
    examples: [
      "where to change password in settings", "নাম ভুল হয়েছে, বদলাব", "password update korbo",
      "change my account password", "নাম পরিবর্তন করব", "account er naam change",
      "change password", "edit my name", "account settings page", "password bodlabo kivabe", "settings e jabo kivabe", "পাসওয়ার্ড বদলাব কীভাবে", "অ্যাকাউন্ট সেটিংস কোথায়", "change email address",
      "how do I change my password", "change my name", "where are account settings", "password change korbo kivabe",
      "nam poriborton kivabe", "পাসওয়ার্ড পরিবর্তন করব কীভাবে", "আমার নাম বদলাতে চাই", "set a password for google account",
      "update my email address", "settings page kothay", "account e naam vul ache",
    ],
    answer: {
      en: "Open **Account settings** from the menu to:\n- Change your **name**\n- **Change your password** (other devices get logged out), or set one if you use Google\n- Add, change or verify your **email**\n\nYour blood group and other donor details are edited on the **Donor profile** page.",
      bn: "মেনু থেকে **অ্যাকাউন্ট সেটিংস** খুলে:\n- **নাম** বদলান\n- **পাসওয়ার্ড পরিবর্তন** করুন (অন্য ডিভাইস থেকে লগ আউট হবে), Google ব্যবহার করলে নতুন পাসওয়ার্ড সেট করুন\n- **ইমেইল** যোগ, পরিবর্তন বা যাচাই করুন\n\nরক্তদাতার তথ্য বদলাতে **রক্তদাতা প্রোফাইল** পেজে যান।",
    },
    links: [link("/settings", "Account settings", "অ্যাকাউন্ট সেটিংস")],
    chip: { en: "Account settings", bn: "অ্যাকাউন্ট সেটিংস" },
    follow: ["edit_donor_profile", "forgot_password", "delete_account"],
  },
  {
    id: "edit_donor_profile",
    examples: [
      "update my donor profile", "edit my profile details", "change my upazila", "update location in donor profile", "profile update korbo", "jela change korbo", "প্রোফাইলে জেলা পরিবর্তন", "শেষ রক্তদানের তারিখ আপডেট", "change blood group in profile", "update last donated date",
      "how do I edit my donor profile", "update my last donation date", "change my district in profile", "I moved to another city, update location",
      "profile edit kivabe korbo", "last donation date update korbo", "রক্তদাতা প্রোফাইল এডিট করব কীভাবে", "আমার ঠিকানা বদলাতে চাই",
      "can I change my blood group", "wrong blood group diyechi", "date of birth vul", "ওজন আপডেট করব", "update my weight and upazila",
    ],
    answer: {
      en: "Open **Donor profile** to update your weight, division/district, upazila, area, campus, group, last donation date and privacy options.\n\n**Blood group and date of birth can't be changed** after the profile is created. If they're wrong, tell us through the **Complaint box** so the team can fix it.",
      bn: "**রক্তদাতা প্রোফাইল** খুলে ওজন, বিভাগ/জেলা, উপজেলা, এলাকা, ক্যাম্পাস, গ্রুপ, শেষ রক্তদানের তারিখ ও গোপনীয়তার অপশন বদলান।\n\nপ্রোফাইল তৈরির পর **রক্তের গ্রুপ ও জন্মতারিখ বদলানো যায় না**। ভুল হলে **অভিযোগ বাক্সে** জানান, টিম ঠিক করে দেবে।",
    },
    links: [link("/donor-profile", "Edit donor profile", "রক্তদাতা প্রোফাইল এডিট")],
    chip: { en: "Edit donor profile", bn: "প্রোফাইল এডিট" },
    follow: ["availability_switch", "phone_privacy", "donation_history"],
  },
  {
    id: "availability_switch",
    examples: [
      "available off kore dibo", "kichu din rokto dite parbo na", "I can't donate for a few weeks, hide me",
      "stop showing me as available", "hide me as donor for a while", "turn availability on", "available hide korbo", "kisu din er jonno unavailable korbo", "আমাকে কিছুদিনের জন্য অপ্রস্তুত দেখাতে চাই", "প্রাপ্যতার সুইচ কোথায়", "set myself unavailable", "pause my donor status", "available switch off",
      "how do I turn off availability", "I'm sick, hide me from donor search", "availability switch kothay", "available off korbo kivabe",
      "ami ekhon rokto dite parbo na, list theke sorao", "প্রাপ্যতা বন্ধ করব কীভাবে", "আমাকে প্রস্তুত তালিকা থেকে সরাতে চাই",
      "why am I shown unavailable", "what does available mean", "I donated last week why still listed", "make me available again",
      "unavailable dekhacche keno", "toggle availability",
    ],
    answer: {
      en: "Use the **availability switch** on your **Dashboard**. Turn it off when you're sick or travelling.\n\nYou appear as **available** only when the switch is on **and** you're eligible (120 days since your last donation). If you donated recently, you'll show as available automatically once you're eligible again.",
      bn: "**ড্যাশবোর্ডের** **প্রাপ্যতার সুইচ** ব্যবহার করুন। অসুস্থ থাকলে বা বাইরে গেলে বন্ধ রাখুন।\n\nসুইচ চালু **এবং** আপনি যোগ্য (শেষ রক্তদানের পর ১২০ দিন) হলেই কেবল **প্রস্তুত** দেখাবে। সম্প্রতি রক্ত দিলে যোগ্য হওয়ার পর স্বয়ংক্রিয়ভাবে আবার প্রস্তুত দেখাবে।",
    },
    links: [link("/dashboard", "Open dashboard", "ড্যাশবোর্ড খুলুন")],
    chip: { en: "Availability switch", bn: "প্রাপ্যতার সুইচ" },
    follow: ["my_eligibility", "edit_donor_profile", "phone_privacy"],
  },
  {
    id: "phone_privacy",
    examples: [
      "আমার নম্বর লুকানো যায়?", "কে আমার ফোন নম্বর দেখতে পায়", "make my number public or private", "number ta sobai dekhe naki",
      "who can view my mobile number", "mobile number dekhte pabe ke", "my number should not be visible",
      "is my phone visible to everyone", "who sees my phone number", "keep my number private", "number hide korte chai", "amar phone number gopon thakbe", "আমার নম্বর কি সবাই দেখে", "ফোন নম্বর গোপন রাখব কীভাবে", "show my phone number option", "number public kora", "is my contact info safe",
      "how do I hide my phone number", "who can see my phone number", "is my number public", "amar number ki sobai dekhte pabe",
      "phone number hide korbo kivabe", "আমার নম্বর কে দেখতে পায়", "নম্বর গোপন রাখতে চাই", "privacy of my contact details",
      "donor number private keno", "show phone number setting", "will my number be on leaderboard", "strangers calling me, stop showing my number",
    ],
    answer: {
      en: "Your number is **private by default**.\n- It's shown to logged-in users only if you turn on **\"Show my phone number\"** in your donor profile (change it any time)\n- When you tap **\"Yes, I can donate\"** on a request, that requester sees it for that request only\n- It's **never** shown on the leaderboard\n\nPeople can still reach you through private messages.",
      bn: "আপনার নম্বর **স্বাভাবিকভাবে গোপন** থাকে।\n- রক্তদাতা প্রোফাইলে **\"আমার ফোন নম্বর দেখান\"** চালু করলেই শুধু লগ-ইন করা ব্যবহারকারীরা দেখেন (যেকোনো সময় বদলানো যায়)\n- কোনো অনুরোধে **\"হ্যাঁ, আমি রক্ত দিতে পারব\"** চাপলে শুধু সেই অনুরোধকারী দেখেন\n- লিডারবোর্ডে **কখনো** দেখানো হয় না\n\nতবু মানুষ আপনাকে মেসেজে যোগাযোগ করতে পারেন।",
    },
    links: [link("/donor-profile", "Privacy settings", "গোপনীয়তা সেটিংস")],
    chip: { en: "Who sees my number?", bn: "আমার নম্বর কে দেখে?" },
    follow: ["messaging", "availability_switch", "how_to_respond"],
  },
  {
    id: "session_timeout",
    examples: [
      "বারবার লগআউট হচ্ছে", "logout hoye jacche bar bar", "signed out after being idle",
      "logged out automatically", "it signed me out suddenly", "session timeout", "auto sign out", "keno sign out hoye gelo", "লগ আউট হয়ে যায় কেন", "স্বয়ংক্রিয়ভাবে লগআউট", "kicked out of my account after some time",
      "why was I logged out", "I keep getting logged out automatically", "session expired", "auto logout keno hoy",
      "hothat logout hoye gelo", "কেন লগ আউট হয়ে গেলাম", "সেশন শেষ হয়ে গেছে বলছে", "stay signed in", "how long before automatic logout",
      "logout hoye jay bar bar", "inactivity logout time",
    ],
    answer: {
      en: "For your security, you're **logged out after 30 minutes of inactivity**. Shortly before that you'll see **\"Are you still there?\"**; tap **Stay signed in** to continue.\n\nIf it already happened, just log in again.",
      bn: "নিরাপত্তার জন্য **৩০ মিনিট কোনো কাজ না করলে স্বয়ংক্রিয়ভাবে লগ আউট** হয়ে যায়। তার একটু আগে **\"আপনি কি এখনো আছেন?\"** দেখাবে; চালিয়ে যেতে **সাইন ইন থাকুন** চাপুন।\n\nলগ আউট হয়ে গেলে আবার লগ ইন করুন।",
    },
    links: [link("/login", "Log in", "লগ ইন")],
    chip: { en: "Why was I logged out?", bn: "কেন লগ আউট হলাম?" },
    follow: ["login_options", "forgot_password"],
  },
  {
    id: "delete_account",
    examples: [
      "delete account", "remove my data", "i want to leave roktolagbe", "account muche felte chai", "account delete", "অ্যাকাউন্ট বন্ধ করতে চাই", "আমার অ্যাকাউন্ট মুছে দিন", "deactivate my profile",
      "how do I delete my account", "deactivate my account", "remove me from the website", "account delete korbo kivabe",
      "amar account bondho korte chai", "অ্যাকাউন্ট ডিলিট করব কীভাবে", "আমার তথ্য মুছে ফেলতে চাই", "I don't want to be a donor anymore",
      "unsubscribe from roktolagbe", "close my account permanently", "donor list theke naam kete dao",
    ],
    answer: {
      en: "There's no self-service delete button yet. Send a request through the **Complaint box** (category \"Something else\") and the team will deactivate your account.\n\nMeanwhile you can turn off your **availability switch** and hide yourself from the **leaderboard** in your donor profile.",
      bn: "এখনো নিজে অ্যাকাউন্ট মুছে ফেলার বোতাম নেই। **অভিযোগ বাক্সে** (বিভাগ \"অন্য কিছু\") অনুরোধ পাঠান, টিম আপনার অ্যাকাউন্ট বন্ধ করে দেবে।\n\nততক্ষণ ড্যাশবোর্ডে **প্রাপ্যতার সুইচ** বন্ধ রাখতে এবং রক্তদাতা প্রোফাইল থেকে **লিডারবোর্ডে** নিজেকে লুকাতে পারেন।",
    },
    links: [link("/complaints", "Complaint box", "অভিযোগ বাক্স")],
    chip: { en: "Delete my account", bn: "অ্যাকাউন্ট মুছে ফেলা" },
    follow: ["availability_switch", "complaint_box", "phone_privacy"],
  },
  {
    id: "language_switch",
    examples: [
      "change language", "bangla te dekhte chai", "language option", "site in english please", "english version", "ভাষা বদলাব কীভাবে", "ইংরেজিতে দেখতে চাই", "switch to english",
      "how do I change the language", "switch to bangla", "can I use the site in bengali", "english e dekhao", "bhasha change korbo kivabe",
      "ভাষা পরিবর্তন করব কীভাবে", "বাংলায় দেখতে চাই", "change language to english", "site ta bangla te korbo", "is there a bangla version",
      "ইংরেজিতে কথা বলো",
    ],
    answer: {
      en: "Use the **English / বাংলা** switch in the top menu to change the site's language any time.\n\nYou can also just write to me in Bangla, English or Banglish; I'll understand.",
      bn: "উপরের মেনুর **English / বাংলা** সুইচ দিয়ে যেকোনো সময় সাইটের ভাষা বদলাতে পারেন।\n\nআমাকে বাংলা, ইংরেজি বা বাংলিশে লিখলেও আমি বুঝব।",
    },
    chip: { en: "Change language", bn: "ভাষা পরিবর্তন" },
    follow: ["about_bot", "login_options"],
  },

  // ---------------------------------------------------------------- requests
  {
    id: "post_request",
    examples: [
      "post a request for blood", "how do I create a request", "put up a blood request", "need to post that my patient needs blood", "request post korbo kivabe", "rokter request dite chai", "রক্তের অনুরোধ পোস্ট", "অনুরোধ দেব কীভাবে", "request blood for patient", "new blood request",
      "how do I post a blood request", "request blood", "অনুরোধ কীভাবে পোস্ট করব", "request kivabe dibo", "how to ask for blood on this site",
      "where do I create a blood request", "kivabe rokter jonno post korbo", "রক্তের জন্য পোস্ট দিতে চাই", "post korte chai rokto lagbe",
      "make a new request for my patient", "request form kothay", "রক্ত চেয়ে অনুরোধ দেওয়ার নিয়ম", "how to request blood for my father",
      "blood chaoar request kemne dey",
    ],
    answer: {
      en: "To ask for blood: open **Request blood**, fill in the patient's blood group, bags needed, hospital, district and when it's needed. You can also paste or speak a message and we fill the form for you. Matching donors near the hospital can then be notified.\n\nYou need to be logged in with a phone number on your account.",
      bn: "রক্ত চাইতে: **রক্তের অনুরোধ করুন** খুলুন, রোগীর রক্তের গ্রুপ, কত ব্যাগ, হাসপাতাল, জেলা এবং কখন লাগবে তা লিখুন। চাইলে একটি বার্তা পেস্ট করুন বা বলুন, আমরা ফর্ম পূরণ করে দেব। এরপর হাসপাতালের কাছের উপযুক্ত রক্তদাতাদের জানানো যায়।\n\nএজন্য অ্যাকাউন্টে ফোন নম্বরসহ লগ ইন থাকতে হবে।",
    },
    links: [link("/requests/new", "Post a request", "অনুরোধ পোস্ট করুন")],
    chip: { en: "How do I request blood?", bn: "কীভাবে রক্তের অনুরোধ করব?" },
    follow: ["request_autofill", "how_matching_works", "mark_fulfilled"],
  },
  {
    id: "request_autofill",
    examples: [
      "voice input for request", "paste message to fill form", "speak the request", "auto fill from message", "message paste kore request", "bole bole request dewa", "ভয়েস দিয়ে অনুরোধ", "মেসেজ পেস্ট করলে ফর্ম পূরণ হয়?", "record voice to post request",
      "can I paste a whatsapp message to make a request", "voice request in bangla", "can I speak my request instead of typing",
      "facebook post copy kore request dibo", "mic e bole request kora jay", "ভয়েসে অনুরোধ দেওয়া যায়", "মেসেজ পেস্ট করে ফর্ম পূরণ",
      "auto fill request form", "type korte parina, bole dite chai", "the form filled wrong details", "how does the paste feature work",
      "বাংলায় বলে অনুরোধ করা যাবে",
    ],
    answer: {
      en: "On the request form, tap the **mic** and say the request in Bangla or English, or **paste** a message you got on WhatsApp or Facebook. We pick out the blood group, bags, phone, district, hospital and time and fill the form.\n\nIt can miss things, so **check every field** before posting.",
      bn: "অনুরোধের ফর্মে **মাইক** চেপে বাংলা বা ইংরেজিতে অনুরোধটি বলুন, অথবা হোয়াটসঅ্যাপ বা ফেসবুকে পাওয়া বার্তা **পেস্ট** করুন। আমরা রক্তের গ্রুপ, ব্যাগ, ফোন, জেলা, হাসপাতাল ও সময় খুঁজে ফর্ম পূরণ করে দিই।\n\nকিছু বাদ পড়তে পারে, তাই পোস্টের আগে **প্রতিটি ঘর দেখে নিন**।",
    },
    links: [link("/requests/new", "Post a request", "অনুরোধ পোস্ট করুন")],
    chip: { en: "Paste or speak a request", bn: "পেস্ট বা ভয়েসে অনুরোধ" },
    follow: ["post_request", "how_matching_works"],
  },
  {
    id: "how_matching_works",
    examples: [
      "do donors get to know when I post", "donor ra ki jante parbe amar request", "পোস্ট দিলে রক্তদাতারা কি খবর পায়",
      "will donors be notified", "how are donors alerted", "notify donors near hospital", "donor ra kivabe jane", "donor der notification pathabo", "রক্তদাতারা কীভাবে জানবে", "notify matching donors button",
      "how does matching work", "how do donors get notified about my request", "notify matching donors", "who gets notified when I post",
      "donor der kivabe janabo", "notify button ki kore", "দাতাদের কীভাবে জানানো হয়", "ম্যাচিং কীভাবে কাজ করে",
      "no new donors to notify", "notify limit reached", "send alert to donors near hospital", "request dile ki donor ra message pay",
      "how are donors matched to requests",
    ],
    answer: {
      en: "After posting, open your request and tap **Notify matching donors**. We alert donors whose blood group is **compatible**, who are **available and eligible**, and who live near the hospital.\n\nThere's a limit per request. If it says no new donors, try again later or widen your search on **Find donors**.",
      bn: "পোস্ট করার পর আপনার অনুরোধ খুলে **উপযুক্ত রক্তদাতাদের জানান** চাপুন। যাঁদের রক্তের গ্রুপ **মিলে যায়**, যাঁরা **প্রস্তুত ও যোগ্য** এবং হাসপাতালের কাছে থাকেন, তাঁদের বিজ্ঞপ্তি পাঠানো হয়।\n\nপ্রতি অনুরোধে একটি সীমা আছে। নতুন রক্তদাতা না থাকলে পরে আবার চেষ্টা করুন বা **রক্তদাতা খুঁজুন** পেজে খুঁজুন।",
    },
    chip: { en: "How does matching work?", bn: "ম্যাচিং কীভাবে কাজ করে?" },
    follow: ["post_request", "find_donors_tips", "notifications"],
  },
  {
    id: "how_to_respond",
    examples: [
      "how can I help someone who needs blood", "respond to blood request", "accept a request", "yes i can donate button", "request e response dibo", "rokto dite raji, ki korbo", "অনুরোধে সাড়া দেওয়ার নিয়ম", "কাউকে রক্ত দিতে চাই",
      "how do I respond to a request", "I want to donate to someone's request", "how to accept a blood request", "request e kivabe sara dibo",
      "ami ei rogike rokto dite chai", "অনুরোধে কীভাবে সাড়া দেব", "আমি রক্ত দিতে রাজি, কী করব", "what happens when I click yes I can donate",
      "i got a notification that someone needs my blood", "help korte chai request e", "how can I help a patient", "donate button kothay",
    ],
    answer: {
      en: "Open the request and tap **\"Yes, I can donate\"**. Your phone number is then shared with that requester (for this request only) and they'll contact you. You can also use **Message** to talk first.\n\nCheck you're eligible, and never pay or take money for blood.",
      bn: "অনুরোধটি খুলে **\"হ্যাঁ, আমি রক্ত দিতে পারব\"** চাপুন। তখন আপনার ফোন নম্বর শুধু এই অনুরোধের জন্য অনুরোধকারীর সাথে শেয়ার হবে এবং তিনি যোগাযোগ করবেন। আগে কথা বলতে **মেসেজ**-ও পাঠাতে পারেন।\n\nআপনি যোগ্য কি না দেখে নিন, আর রক্তের জন্য কখনো টাকা দেবেন বা নেবেন না।",
    },
    links: [link("/requests", "Open requests", "খোলা অনুরোধ")],
    chip: { en: "How do I help a request?", bn: "কীভাবে অনুরোধে সাড়া দেব?" },
    follow: ["open_requests", "my_eligibility", "before_donating"],
  },
  {
    id: "mark_fulfilled",
    examples: [
      "close my request", "mark fulfilled", "cancel request", "my request is done", "request cancel korbo", "অনুরোধ বন্ধ করব", "রক্ত পেয়েছি, পোস্ট সরাব কীভাবে", "remove my blood post", "fulfilled mark korbo",
      "how do I close my request", "I got the blood, how to mark fulfilled", "cancel my blood request", "request bondho korbo kivabe",
      "rokto peye gechi, post sorabo", "অনুরোধ বাতিল করব কীভাবে", "রক্ত পেয়ে গেছি, অনুরোধ বন্ধ করতে চাই", "update units received",
      "mark request in progress", "delete my request", "request complete kivabe dekhabo", "my requests kothay",
    ],
    answer: {
      en: "Open your request (Dashboard → **My requests**). You can:\n- **Mark in progress** and update **units received**\n- **Mark as fulfilled** once you have all the blood\n- **Cancel request** if it's no longer needed (donors can't respond after that)\n\nClosing it quickly stops donors from travelling for nothing.",
      bn: "আপনার অনুরোধ খুলুন (ড্যাশবোর্ড → **আমার অনুরোধ**)। এখানে:\n- **চলমান** চিহ্নিত করে **কত ইউনিট পেয়েছেন** আপডেট করুন\n- সব রক্ত পেলে **পূরণ হয়েছে** চিহ্নিত করুন\n- আর দরকার না হলে **অনুরোধ বাতিল** করুন (এরপর রক্তদাতারা সাড়া দিতে পারবেন না)\n\nদ্রুত বন্ধ করলে রক্তদাতাদের অযথা যেতে হয় না।",
    },
    links: [link("/dashboard", "My requests", "আমার অনুরোধ")],
    chip: { en: "Close my request", bn: "অনুরোধ বন্ধ করা" },
    follow: ["post_request", "complaint_box"],
  },

  // ---------------------------------------------------------------- site features
  {
    id: "find_donors_tips",
    examples: [
      "উপজেলা বা ক্যাম্পাস দিয়ে খোঁজা", "ফিল্টার দিয়ে রক্তদাতা খোঁজা", "filter donors by group or club",
      "how to use donor search", "can't find any donor", "filter donors by campus", "search donors by upazila", "donor search kivabe kaj kore", "kono donor pai na", "রক্তদাতা পাচ্ছি না", "রক্তদাতা খোঁজার নিয়ম", "how to contact a donor", "donor er phone number dekhte pai na",
      "how do I search for donors", "no donors found what should I do", "how to use the find donors page", "donor khujbo kivabe site e",
      "donor pacchi na ki korbo", "রক্তদাতা খুঁজব কীভাবে", "কোনো রক্তদাতা পাওয়া যাচ্ছে না", "filter by upazila or campus",
      "why can't I see donor phone numbers", "search donors in my university", "include unavailable donors means",
      "donor er contact pabo kivabe",
    ],
    answer: {
      en: "On **Find donors**, filter by blood group, district, upazila, campus or group (log in to see contact details).\n- No results? Try a nearby district, remove upazila/campus filters, or include unavailable donors\n- Use **Call** if the number is public, or **Send a message**\n- Also **post a request** so matching donors get notified",
      bn: "**রক্তদাতা খুঁজুন** পেজে রক্তের গ্রুপ, জেলা, উপজেলা, ক্যাম্পাস বা গ্রুপ দিয়ে ফিল্টার করুন (যোগাযোগের তথ্য দেখতে লগ ইন করুন)।\n- কাউকে না পেলে পাশের জেলা দেখুন, উপজেলা/ক্যাম্পাস ফিল্টার সরান, বা অপ্রস্তুত রক্তদাতাসহ দেখুন\n- নম্বর দেখা গেলে **কল** করুন, নইলে **মেসেজ পাঠান**\n- সাথে একটি **অনুরোধ পোস্ট করুন**, যাতে উপযুক্ত রক্তদাতারা বিজ্ঞপ্তি পান",
    },
    links: [link("/donors", "Find donors", "রক্তদাতা খুঁজুন")],
    chip: { en: "Tips for finding donors", bn: "রক্তদাতা খোঁজার টিপস" },
    follow: ["find_donors_example", "post_request", "bank_stock"],
  },
  {
    id: "blood_banks_page",
    examples: [
      "blood bank list", "nearest blood bank", "24 hour blood bank", "blood bank contact number", "blood bank kothay", "ব্লাড ব্যাংক খুঁজব কীভাবে", "কাছের ব্লাড ব্যাংক", "blood bank address",
      "how do I find a blood bank near me", "list of blood banks", "blood banks open 24 hours", "blood bank er phone number",
      "kache kothay blood bank", "ব্লাড ব্যাংকের তালিকা", "২৪ ঘণ্টা খোলা ব্লাড ব্যাংক", "how to see blood bank stock", "is the stock shown accurate",
      "blood bank er thikana", "directions to blood bank", "নিকটস্থ ব্লাড ব্যাংক কোথায়",
    ],
    answer: {
      en: "Open **Blood banks** to search by name or district, and filter by **blood group in stock** or **open 24 hours**. Each bank's page shows live units per group, with **Call** and **Directions** buttons.\n\nStock is entered by bank staff and changes quickly, so **call before you travel**.",
      bn: "**ব্লাড ব্যাংক** পেজে নাম বা জেলা দিয়ে খুঁজুন, এবং **মজুদে থাকা রক্তের গ্রুপ** বা **২৪ ঘণ্টা খোলা** দিয়ে ফিল্টার করুন। প্রতিটি ব্যাংকের পেজে গ্রুপভিত্তিক মজুদ, সাথে **কল** ও **দিকনির্দেশনা** বোতাম আছে।\n\nমজুদ ব্যাংকের কর্মীরা দেন এবং দ্রুত বদলায়, তাই **যাওয়ার আগে ফোন করুন**।",
    },
    links: [link("/blood-banks", "Blood banks", "ব্লাড ব্যাংক")],
    chip: { en: "Find a blood bank", bn: "ব্লাড ব্যাংক খুঁজুন" },
    follow: ["bank_stock", "register_bank", "blood_components"],
  },
  {
    id: "register_bank",
    examples: [
      "ব্লাড ব্যাংকের জন্য অ্যাকাউন্ট", "আমাদের ব্লাড ব্যাংক রেজিস্টার করব", "blood bank account khulbo",
      "register blood bank", "list our blood bank", "join as a blood bank", "blood bank partner", "blood bank nibondhon", "ব্লাড ব্যাংক যুক্ত করব", "ব্লাড ব্যাংক রেজিস্ট্রেশন", "partner hospital registration", "bank portal",
      "how do I register my blood bank", "add our blood bank to roktolagbe", "I run a blood bank how to join", "blood bank registration",
      "amader blood bank add korbo kivabe", "ব্লাড ব্যাংক নিবন্ধন করব কীভাবে", "আমাদের ব্লাড ব্যাংক যুক্ত করতে চাই", "bank portal access",
      "how to update stock as blood bank staff", "blood bank approval koto din", "hospital blood bank partner hote chai",
    ],
    answer: {
      en: "Log in (with a phone number on your account) and open **Register a blood bank**. Fill in the bank's details and licence number. An **admin reviews and approves** it.\n\nOnce approved, use the **Bank portal** to update live stock, see nearby requests and record donations.",
      bn: "লগ ইন করুন (অ্যাকাউন্টে ফোন নম্বর থাকতে হবে) এবং **ব্লাড ব্যাংক নিবন্ধন** খুলুন। ব্যাংকের তথ্য ও লাইসেন্স নম্বর দিন। একজন **অ্যাডমিন যাচাই করে অনুমোদন** দেবেন।\n\nঅনুমোদনের পর **ব্যাংক পোর্টাল** থেকে মজুদ আপডেট, কাছের অনুরোধ দেখা এবং রক্তদান রেকর্ড করতে পারবেন।",
    },
    links: [link("/bank-portal/register", "Register a blood bank", "ব্লাড ব্যাংক নিবন্ধন")],
    chip: { en: "Register a blood bank", bn: "ব্লাড ব্যাংক নিবন্ধন" },
    follow: ["blood_banks_page", "donation_history"],
  },
  {
    id: "messaging",
    examples: [
      "text a donor privately", "direct message a donor", "ডোনারকে সরাসরি মেসেজ",
      "send message to donor", "chat with donor", "block user", "message requester", "message pathabo kivabe", "chat korbo kivabe", "মেসেজ পাঠাব কীভাবে", "ব্লক করব কীভাবে", "someone keeps texting me", "my messages",
      "how do I message a donor", "can I chat with the requester", "how to block someone", "someone is harassing me in messages",
      "donor ke message dibo kivabe", "block korbo kivabe", "রক্তদাতাকে মেসেজ পাঠাব কীভাবে", "কাউকে ব্লক করব কীভাবে",
      "where are my messages", "inbox kothay", "unblock a user", "private chat feature",
    ],
    answer: {
      en: "Tap **Message** on a donor card or a blood request to start a private chat. All your chats are under **Messages**.\n\nTo stop someone, open the chat's **options** and choose **Block** (you can unblock later). For harassment or scams, also report it in the **Complaint box**. Never share bank details or pay anyone for blood.",
      bn: "রক্তদাতার কার্ড বা রক্তের অনুরোধে **মেসেজ** চেপে ব্যক্তিগত চ্যাট শুরু করুন। সব চ্যাট **মেসেজ** পেজে পাবেন।\n\nকাউকে থামাতে চ্যাটের **অপশন** থেকে **ব্লক** করুন (পরে আনব্লক করা যায়)। হয়রানি বা প্রতারণা হলে **অভিযোগ বাক্সেও** জানান। কাউকে ব্যাংকের তথ্য দেবেন না বা রক্তের জন্য টাকা দেবেন না।",
    },
    links: [link("/messages", "Messages", "মেসেজ")],
    chip: { en: "Messaging and blocking", bn: "মেসেজ ও ব্লক" },
    follow: ["money_scam", "phone_privacy", "notifications"],
  },
  {
    id: "notifications",
    examples: [
      "I don't get any alerts", "alerts", "notification ashtese na",
      "notifications", "notification settings", "alerts not coming", "notification pai na", "notification dekhbo", "নোটিফিকেশন আসে না", "বিজ্ঞপ্তি কোথায়", "alert when someone needs blood",
      "where are my notifications", "I'm not getting notifications", "what notifications will I get", "notification kothay dekhbo",
      "notification ashe na keno", "নোটিফিকেশন কোথায় দেখব", "বিজ্ঞপ্তি পাচ্ছি না", "mark all notifications as read", "bell icon ki",
      "will I be alerted when someone needs my blood group", "donor respond korle ki janabe",
    ],
    answer: {
      en: "Tap the **bell** at the top or open **Notifications**. You're notified when a blood request **matches you**, when a donor **responds to your request**, and about request updates.\n\nNot getting donor alerts? Make sure your donor profile is complete and your **availability switch** is on.",
      bn: "উপরের **ঘণ্টা** আইকনে চাপুন বা **বিজ্ঞপ্তি** পেজ খুলুন। কোনো অনুরোধ **আপনার সাথে মিললে**, কোনো রক্তদাতা **আপনার অনুরোধে সাড়া দিলে** এবং অনুরোধের আপডেটে বিজ্ঞপ্তি পাবেন।\n\nরক্তদাতার বিজ্ঞপ্তি না পেলে দেখুন প্রোফাইল সম্পূর্ণ আছে কি না এবং **প্রাপ্যতার সুইচ** চালু কি না।",
    },
    links: [link("/notifications", "Notifications", "বিজ্ঞপ্তি")],
    chip: { en: "Notifications", bn: "বিজ্ঞপ্তি" },
    follow: ["availability_switch", "how_matching_works", "messaging"],
  },
  {
    id: "donation_history",
    examples: [
      "donation history", "my past donations", "donation not recorded", "verify my donation", "amar donation history", "donation count update hoy na", "রক্তদানের রেকর্ড", "আমার আগের রক্তদান", "how many times have I donated",
      "where is my donation history", "my donation is not showing", "how to get my donation verified", "donation record kothay",
      "amar donation count barche na", "রক্তদানের ইতিহাস কোথায়", "আমার রক্তদান রেকর্ড হয়নি", "verified donation mane ki",
      "pending verification donation", "I donated at a hospital not on the site", "koybar rokto diyechi dekhbo kivabe",
    ],
    answer: {
      en: "Your **Donation history** is on the **Dashboard**. When you donate at a **partner blood bank**, the staff record it and it shows as **Verified** (or Pending until they confirm). Verified donations count for the leaderboard.\n\nDonated somewhere else? Update your **last donation date** in your donor profile so your eligibility stays correct.",
      bn: "আপনার **রক্তদানের ইতিহাস** **ড্যাশবোর্ডে** আছে। **সহযোগী ব্লাড ব্যাংকে** রক্ত দিলে কর্মীরা তা রেকর্ড করেন এবং **যাচাইকৃত** দেখায় (নিশ্চিত না হওয়া পর্যন্ত অপেক্ষমাণ)। যাচাইকৃত রক্তদান লিডারবোর্ডে গোনা হয়।\n\nঅন্য কোথাও দিলে রক্তদাতা প্রোফাইলে **শেষ রক্তদানের তারিখ** আপডেট করুন, যাতে যোগ্যতা ঠিক থাকে।",
    },
    links: [link("/dashboard", "Open dashboard", "ড্যাশবোর্ড খুলুন")],
    chip: { en: "My donation history", bn: "আমার রক্তদানের ইতিহাস" },
    follow: ["leaderboard", "edit_donor_profile", "my_eligibility"],
  },
  {
    id: "leaderboard",
    examples: [
      "রক্তদাতাদের র‍্যাংক কীভাবে ঠিক হয়", "শীর্ষ ডোনার তালিকা", "top 10 donors",
      "leaderboard", "badges", "top donors", "silver hero badge", "gold hero", "leaderboard e kivabe ashbo", "badge ki ki ache", "লিডারবোর্ড", "ব্যাজ কীভাবে পাব", "donor ranking",
      "how does the leaderboard work", "top donors list", "what are the badges", "how do I get gold hero badge", "leaderboard e naam ashbe kivabe",
      "badge kivabe pabo", "লিডারবোর্ড কীভাবে কাজ করে", "সেরা রক্তদাতাদের তালিকা", "hide me from leaderboard", "leaderboard this month",
      "first drop badge mane", "ranking of donors",
    ],
    answer: {
      en: "The **donor leaderboard** ranks donors by donations recorded by partner blood banks, for **this month, this year or all time**.\n\nBadges: **First drop** (1), **Regular donor** (3), **Bronze hero** (5), **Silver hero** (10), **Gold hero** (25).\n\nYou can hide yourself in your donor profile; phone numbers are never shown.",
      bn: "**রক্তদাতা লিডারবোর্ড** সহযোগী ব্লাড ব্যাংকে রেকর্ড হওয়া রক্তদানের ভিত্তিতে র‍্যাংক করে, **এই মাস, এই বছর বা সর্বকালের** জন্য।\n\nব্যাজ: **প্রথম ফোঁটা** (১), **নিয়মিত রক্তদাতা** (৩), **ব্রোঞ্জ হিরো** (৫), **সিলভার হিরো** (১০), **গোল্ড হিরো** (২৫)।\n\nরক্তদাতা প্রোফাইল থেকে নিজেকে লুকাতে পারেন; ফোন নম্বর কখনো দেখানো হয় না।",
    },
    links: [link("/leaderboard", "Leaderboard", "লিডারবোর্ড")],
    chip: { en: "Leaderboard and badges", bn: "লিডারবোর্ড ও ব্যাজ" },
    follow: ["donation_history", "donations_per_year", "phone_privacy"],
  },
  {
    id: "complaint_box",
    examples: [
      "সমস্যা হলে কাকে বলব", "অ্যাপে সমস্যা", "kothay problem janabo",
      "complaint", "report a user", "report fake post", "file a complaint", "complain korbo", "complaint box kothay", "অভিযোগ করব কীভাবে", "অভিযোগ বাক্স", "report a bug", "contact admin",
      "how do I report a fake request", "where can I complain", "report a problem with the app", "contact the admin", "complain korbo kothay",
      "fake request report korbo", "অভিযোগ কোথায় করব", "ভুয়া অনুরোধ রিপোর্ট করতে চাই", "complaint reference code", "track my complaint",
      "a donor behaved badly", "contact support team", "app e bug ache", "how to contact roktolagbe",
    ],
    answer: {
      en: "Use the **Complaint box** to report a fake request, someone asking for money, bad behaviour, a blood bank, or an app problem. You'll get a **reference code** (like RL-XXXXXX).\n\nLogged in? Track replies under **My complaints**. Otherwise leave a phone or email. We keep your details private. For emergencies, call **999**.",
      bn: "**অভিযোগ বাক্সে** ভুয়া অনুরোধ, টাকা চাওয়া, খারাপ আচরণ, কোনো ব্লাড ব্যাংক বা অ্যাপের সমস্যা জানান। আপনি একটি **রেফারেন্স কোড** (যেমন RL-XXXXXX) পাবেন।\n\nলগ ইন থাকলে **আমার অভিযোগ**-এ উত্তর দেখুন, নইলে ফোন বা ইমেইল দিন। আপনার তথ্য গোপন রাখা হয়। জরুরি অবস্থায় **৯৯৯**-এ কল করুন।",
    },
    links: [link("/complaints", "Complaint box", "অভিযোগ বাক্স")],
    chip: { en: "Report a problem", bn: "সমস্যা জানান" },
    follow: ["money_scam", "messaging", "delete_account"],
  },
  {
    id: "money_scam",
    examples: [
      "they want me to pay", "someone is asking me to pay money", "টাকা না দিলে রক্ত দেবে না বলছে",
      "donor wants payment first", "বিকাশে টাকা চাইছে", "requester wants money before",
      "asked for money", "donor demands money", "pay for blood", "scam", "taka chaiche", "taka dite bolche", "টাকা চাইছে", "টাকা চাওয়া হয়েছে", "advance payment for blood", "send money for blood",
      "a donor is asking for money", "someone wants payment for blood", "requester asked me to send bkash", "is this a scam",
      "donor taka chacche", "rokto dite taka chay", "রক্তদাতা টাকা চাইছে", "রক্তের জন্য টাকা চাওয়া হচ্ছে", "they asked for advance payment",
      "bikash e taka pathate bolche", "fraud blood request", "should I pay the donor for transport",
    ],
    answer: {
      en: "**Don't pay.** Blood donation on RoktoLagbe is always voluntary and free; never send money (bKash, Nagad or otherwise) to anyone for blood.\n\nPlease **report it** in the **Complaint box** under \"Someone asked for money\", and **block** them in Messages. Never share OTP codes or passwords.",
      bn: "**টাকা দেবেন না।** RoktoLagbe-এ রক্তদান সবসময় স্বেচ্ছায় ও বিনামূল্যে; রক্তের জন্য কাউকে কোনোভাবে (বিকাশ, নগদ বা অন্য) টাকা পাঠাবেন না।\n\n**অভিযোগ বাক্সে** \"কেউ টাকা চেয়েছে\" বিভাগে **জানান**, এবং মেসেজে তাকে **ব্লক** করুন। কখনো ওটিপি কোড বা পাসওয়ার্ড শেয়ার করবেন না।",
    },
    links: [link("/complaints", "Report it", "অভিযোগ জানান")],
    chip: { en: "Someone asked for money", bn: "কেউ টাকা চাইছে" },
    follow: ["complaint_box", "messaging", "is_free"],
  },
  {
    id: "is_free",
    examples: [
      "free", "is this service free", "any fee", "cost", "do I need to pay", "taka lagbe?", "fee koto", "টাকা লাগবে?", "বিনামূল্যে কি", "free service",
      "is it free", "is roktolagbe free to use", "do I have to pay to find donors", "do donors get paid", "ei site use korte ki taka lage",
      "free naki", "রক্ত পেতে কি টাকা লাগে", "এই সেবা কি বিনামূল্যে", "is there any charge", "can I sell my blood",
      "do blood banks charge money", "subscription fee ache",
    ],
    answer: {
      en: "Yes. **RoktoLagbe is completely free**, and donors give blood **voluntarily and for free**. Never pay a donor, and never sell blood.\n\nHospitals or blood banks may charge their own fees for screening tests, bags and processing; ask them directly. If anyone asks you for money for blood, report it.",
      bn: "হ্যাঁ। **RoktoLagbe সম্পূর্ণ বিনামূল্যে**, আর রক্তদাতারা **স্বেচ্ছায় ও বিনামূল্যে** রক্ত দেন। রক্তদাতাকে টাকা দেবেন না, রক্ত বিক্রিও করবেন না।\n\nহাসপাতাল বা ব্লাড ব্যাংক পরীক্ষা, ব্যাগ ও প্রক্রিয়াকরণের জন্য নিজস্ব ফি নিতে পারে; তাদের কাছে জেনে নিন। কেউ রক্তের জন্য টাকা চাইলে জানান।",
    },
    chip: { en: "Is it free?", bn: "এটা কি বিনামূল্যে?" },
    follow: ["money_scam", "become_donor", "about_bot"],
  },

  // ---------------------------------------------------------------- small talk
  {
    id: "thanks",
    examples: [
      "thank u", "thnx", "thanks a ton", "many thanks", "dhonnobad apnake", "ধন্যবাদ ভাই", "very helpful, thanks",
      "thanks", "thank you", "thank you so much", "ok thanks", "okay", "accha thik ache", "thanks a lot, that helped", "dhonnobad", "onek dhonnobad", "thanks bhai",
      "ধন্যবাদ", "অনেক ধন্যবাদ", "shukriya", "ty", "great, thanks", "jazakallah khair", "that was helpful",
    ],
    answer: {
      en: "You're welcome! Anything else I can help with? 🙂",
      bn: "আপনাকেও ধন্যবাদ! আর কিছু জানতে চান?",
    },
    follow: ["find_donors_example", "who_can_donate", "post_request"],
  },
  {
    id: "goodbye",
    examples: [
      "bye bye", "see ya", "goodbye for now", "ok tata", "bidai", "আবার দেখা হবে", "later",
      "bye", "goodbye", "see you", "ok bye", "allah hafez", "khoda hafez", "pore kotha hobe", "আল্লাহ হাফেজ", "বিদায়", "good night",
      "talk to you later", "that's all for now", "accha thik ache bye",
    ],
    answer: {
      en: "Take care! If you or someone you know needs blood, I'm here any time. And if you can, consider becoming a donor. 🩸",
      bn: "ভালো থাকবেন! আপনার বা পরিচিত কারো রক্ত লাগলে যেকোনো সময় আমাকে জিজ্ঞেস করবেন। পারলে রক্তদাতা হওয়ার কথাও ভাবুন। 🩸",
    },
    follow: ["become_donor"],
  },
  {
    id: "about_bot",
    examples: [
      "what kind of help do you give", "what are you able to do",
      "what can I ask you", "what topics do you answer", "apni ki ki uttor diben",
      "what can you help with", "what do you do", "what is your purpose", "tumi ki ki jano", "আপনি কী করতে পারেন", "what questions can I ask", "menu", "options", "about this site",
      "who are you", "what can you do", "what is this chatbot", "help", "how can you help me", "tumi ke", "tumi ki korte paro",
      "তুমি কে", "তুমি কী কী করতে পারো", "what is roktolagbe", "roktolagbe ki", "রক্তলাগবে কী", "what services do you offer",
      "kon kon bishoye help koren",
    ],
    answer: {
      en: "I'm the **RoktoLagbe assistant**. RoktoLagbe connects blood donors, patients and blood banks across Bangladesh. I can:\n- Count available donors and check blood bank stock\n- Show open blood requests\n- Explain who can donate and how to prepare\n- Guide you through the site: requests, profile, messages and more",
      bn: "আমি **RoktoLagbe সহকারী**। RoktoLagbe সারা বাংলাদেশে রক্তদাতা, রোগী ও ব্লাড ব্যাংককে যুক্ত করে। আমি পারি:\n- প্রস্তুত রক্তদাতার সংখ্যা ও ব্লাড ব্যাংকের মজুদ জানাতে\n- খোলা রক্তের অনুরোধ দেখাতে\n- কারা রক্ত দিতে পারেন ও কীভাবে প্রস্তুতি নেবেন তা বোঝাতে\n- সাইট ব্যবহারে সাহায্য করতে: অনুরোধ, প্রোফাইল, মেসেজ ইত্যাদি",
    },
    follow: ["find_donors_example", "who_can_donate", "post_request", "bank_stock"],
  },
  {
    id: "are_you_human",
    examples: [
      "are you real", "bot naki manush", "is this a robot", "am i chatting with a machine", "আপনি কি এআই", "human agent", "talk to a person",
      "are you a human", "am I talking to a real person", "are you a bot", "are you AI", "tumi ki manush", "apni ki robot",
      "তুমি কি মানুষ", "আপনি কি রোবট", "is this chatgpt", "real person er sathe kotha bolte chai", "can I talk to a human",
    ],
    answer: {
      en: "I'm an automated assistant, not a person. I answer common questions and can check live donor and stock numbers.\n\nTo reach the RoktoLagbe team, use the **Complaint box**. In an emergency, call **999**.",
      bn: "আমি একটি স্বয়ংক্রিয় সহকারী, মানুষ নই। সাধারণ প্রশ্নের উত্তর দিই এবং রক্তদাতা ও মজুদের সর্বশেষ সংখ্যা দেখতে পারি।\n\nRoktoLagbe টিমের সাথে যোগাযোগ করতে **অভিযোগ বাক্স** ব্যবহার করুন। জরুরি অবস্থায় **৯৯৯**-এ কল করুন।",
    },
    links: [link("/complaints", "Contact the team", "টিমের সাথে যোগাযোগ")],
    follow: ["about_bot", "complaint_box"],
  },
];
