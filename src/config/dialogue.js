// Contextual Bengali (Bangladeshi / Dhaka colloquial) voice lines.
// Each line: { id, t: text, who: speaker } — `id` is also the key used in public/assets/audio/manifest.json
// to attach a real recording later (voice/<id>.mp3). Without a recording the browser's bn voice speaks it (if present)
// and an on-screen subtitle is always shown.
//
// who: helper = bus helper (হেল্পার), driver = other drivers, rick = rickshaw puller, ped = pedestrians,
//      pass = passengers, police = police loudspeaker.
// Priorities: 1 = ambient chatter, 2 = reaction, 3 = important (police / crash).

const L = (id, t, who) => ({ id, t, who });

export const DIALOGUE = {
  // ---- Helper calling passengers (ambient, per zone) -------------------------------------------------
  call_badda: [
    L('call_badda_1', 'বাড্ডা! বাড্ডা! লিংক রোড, গুলশান!', 'helper'),
    L('call_badda_2', 'বাড্ডা যাবেন? উঠেন উঠেন!', 'helper'),
    L('call_badda_3', 'ভাই, বাড্ডা-গুলশান! সিট খালি আছে!', 'helper'),
  ],
  call_rampura: [
    L('call_rampura_1', 'রামপুরা! রামপুরা ব্রিজ! নামবেন তো আগে আসেন!', 'helper'),
    L('call_rampura_2', 'রামপুরা-মালিবাগ, সামনে আসেন ভাই!', 'helper'),
    L('call_rampura_3', 'টিভি সেন্টার, টিভি সেন্টার, রামপুরা!', 'helper'),
  ],
  call_mirpur: [
    L('call_mirpur_1', 'মিরপুর! মিরপুর! সোজা মিরপুর!', 'helper'),
    L('call_mirpur_2', 'মিরপুর বারো, চৌদ্দ, ষোলো! আসেন আসেন!', 'helper'),
    L('call_mirpur_3', 'চিড়িয়াখানা, মিরপুর! ওঠেন ভাই!', 'helper'),
  ],
  call_mirpur10: [
    L('call_mirpur10_1', 'মিরপুর দশ! দশ নম্বর গোলচত্বর! নামেন নামেন!', 'helper'),
    L('call_mirpur10_2', 'দশ নম্বর! দশ নম্বর! পিছনে জায়গা আছে!', 'helper'),
    L('call_mirpur10_3', 'ভাই, মিরপুর দশ যাবেন? উঠে পড়েন!', 'helper'),
  ],
  call_agargaon: [
    L('call_agargaon_1', 'আগারগাঁও, আগারগাঁও!', 'helper'),
    L('call_agargaon_2', 'আগারগাঁও মেট্রো, তালতলা, শ্যামলী! আসেন!', 'helper'),
    L('call_agargaon_3', 'শেরেবাংলা নগর, আগারগাঁও! ভিতরে যান ভাই!', 'helper'),
  ],
  call_generic: [
    L('call_gen_1', 'সামনে আসেন, সামনে আসেন!', 'helper'),
    L('call_gen_2', 'ভাড়া দেন ভাই, খুচরা দেন!', 'helper'),
    L('call_gen_3', 'ভিতরে যান, ভিতরে জায়গা আছে!', 'helper'),
    L('call_gen_4', 'লাস্ট সিট, লাস্ট সিট!', 'helper'),
    L('call_gen_5', 'পিছনে যান ভাই, পিছনে ফাঁকা!', 'helper'),
    L('call_gen_6', 'ওস্তাদ, গাড়ি ছাড়েন, গাড়ি ছাড়েন!', 'helper'),
  ],
  // ---- Bus stop / pickup -----------------------------------------------------------------------------
  stop_approach: [
    L('stop_app_1', 'স্টপেজ, স্টপেজ! প্যাসেঞ্জার আছে ওস্তাদ!', 'helper'),
    L('stop_app_2', 'ওস্তাদ, ধীরে ধীরে, লোক উঠবে!', 'helper'),
  ],
  stop_board: [
    L('stop_board_1', 'উঠেন উঠেন, তাড়াতাড়ি উঠেন!', 'helper'),
    L('stop_board_2', 'চলেন চলেন, গাড়ি ছাড়বে!', 'helper'),
    L('stop_board_3', 'এই যে মামা, উঠে পড়েন!', 'helper'),
  ],
  stop_done: [
    L('stop_done_1', 'ঠিক আছে ওস্তাদ, ছাড়েন!', 'helper'),
    L('stop_done_2', 'রাইট ওস্তাদ, রাইট!', 'helper'),
  ],
  stop_missed: [
    L('stop_missed_1', 'আরে ওস্তাদ, থামলেন না কেন!', 'helper'),
  ],
  // ---- Helper reactions to traffic ------------------------------------------------------------------
  helper_warn: [
    L('helper_warn_1', 'ভাই, সামনে দেখেন!', 'helper'),
    L('helper_warn_2', 'আরেকটু সামনে যান!', 'helper'),
    L('helper_warn_3', 'ওস্তাদ, সামনে ফাঁকা নাই!', 'helper'),
    L('helper_warn_4', 'ব্রেক ধরেন ওস্তাদ, ব্রেক!', 'helper'),
    L('helper_warn_5', 'লেফট কাটেন, লেফট কাটেন!', 'helper'),
  ],
  helper_go: [
    L('helper_go_1', 'চলেন, চলেন!', 'helper'),
    L('helper_go_2', 'চালান ওস্তাদ, জোরে চালান!', 'helper'),
    L('helper_go_3', 'ছাড়েন ছাড়েন, কেউ থাকবে না পিছনে!', 'helper'),
  ],
  helper_praise: [
    L('helper_praise_1', 'আরে বাহ ওস্তাদ, দারুণ কাটাইলেন!', 'helper'),
    L('helper_praise_2', 'কেয়াবাত ওস্তাদ, কেয়াবাত!', 'helper'),
    L('helper_praise_3', 'ওস্তাদ আপনি না একটা জিনিস!', 'helper'),
    L('helper_praise_4', 'এই না হলে বাসওয়ালা!', 'helper'),
  ],
  helper_crash: [
    L('helper_crash_1', 'হায় হায়, গাড়ির কী অবস্থা!', 'helper'),
    L('helper_crash_2', 'ওরে বাবা রে! আস্তে চালান ওস্তাদ!', 'helper'),
    L('helper_crash_3', 'মালিক শুনলে চাকরি নাই ওস্তাদ!', 'helper'),
  ],
  helper_police: [
    L('helper_police_1', 'ওস্তাদ, পুলিশ! পুলিশ পিছনে!', 'helper'),
    L('helper_police_2', 'পুলিশ ধরলে শেষ, চাপেন ওস্তাদ, চাপেন!', 'helper'),
    L('helper_police_3', 'সাইরেন শুনতেছেন না? জোরে চালান!', 'helper'),
  ],
  helper_escape: [
    L('helper_escape_1', 'বাঁচলাম রে বাবা! পুলিশ পিছনে পড়ছে!', 'helper'),
    L('helper_escape_2', 'ধুর, পুলিশ ফেল! ওস্তাদ জিন্দাবাদ!', 'helper'),
  ],
  helper_boost: [
    L('helper_boost_1', 'ওরে বাপ রে, উইড়া যাইতেছি!', 'helper'),
    L('helper_boost_2', 'চাপ চাপ চাপ! জোরে চাপেন!', 'helper'),
  ],
  helper_start: [
    L('helper_start_1', 'চলো ওস্তাদ, গাড়ি ছাড়ো! বিসমিল্লাহ!', 'helper'),
  ],
  helper_zone: [
    L('helper_zone_1', 'এসে গেছি, সামনে সব নামবেন!', 'helper'),
  ],
  // ---- Other road users --------------------------------------------------------------------------
  react_driver: [
    L('react_drv_1', 'এই, সাবধানে!', 'driver'),
    L('react_drv_2', 'আরে ভাই, দেখেশুনে চালান!', 'driver'),
    L('react_drv_3', 'কী করেন ভাই!', 'driver'),
    L('react_drv_4', 'চোখে দেখেন না নাকি!', 'driver'),
    L('react_drv_5', 'পাগল হইছেন নাকি?', 'driver'),
    L('react_drv_6', 'বাস দিয়া কি রেস দিচ্ছেন?', 'driver'),
    L('react_drv_7', 'এই মামা, লাইসেন্স কই পাইছেন!', 'driver'),
  ],
  react_rick: [
    L('react_rick_1', 'ও মামা, মাইরা ফেলবেন নাকি!', 'rick'),
    L('react_rick_2', 'আরে আরে আরে! রিকশা পইড়া যাইব!', 'rick'),
    L('react_rick_3', 'আস্তে যান মামা, গরিবের রিকশা!', 'rick'),
    L('react_rick_4', 'আমার পেটে লাথি দিয়েন না ভাই!', 'rick'),
  ],
  react_cng: [
    L('react_cng_1', 'এই বাস! সিএনজি দেখেন না!', 'driver'),
    L('react_cng_2', 'ভাই, মিটারও চলে নাই, গাড়ি ভাঙবেন নাকি!', 'driver'),
  ],
  react_moto: [
    L('react_moto_1', 'ওই ওই! বাইক সরেন, সরেন!', 'driver'),
    L('react_moto_2', 'এভাবে চালায় কেউ!', 'driver'),
  ],
  react_ped: [
    L('react_ped_1', 'ওরে বাবা রে!', 'ped'),
    L('react_ped_2', 'দেখে চালান ভাই!', 'ped'),
    L('react_ped_3', 'রাস্তায় মানুষ থাকে, বুঝেন না?', 'ped'),
    L('react_ped_4', 'বেপরোয়া চালাচ্ছে, ধরেন ধরেন!', 'ped'),
    L('react_ped_5', 'একটু আস্তে চালান, ভাই!', 'ped'),
  ],
  react_pass: [
    L('react_pass_1', 'ভাই, আস্তে চালান, ভিতরে ঝাঁকি লাগে!', 'pass'),
    L('react_pass_2', 'আল্লাহ রে, মাথা ঠুকে গেল!', 'pass'),
    L('react_pass_3', 'ড্রাইভার সাহেব, আমি নামব সামনে!', 'pass'),
  ],
  // ---- Police -------------------------------------------------------------------------------------
  police_chase: [
    L('police_chase_1', 'বাস থামান! বাস থামান! সাইড করেন!', 'police'),
    L('police_chase_2', 'গাড়ি থামান, এক্ষুনি থামান!', 'police'),
    L('police_chase_3', 'ঠিক আছে, আর পালাতে পারবেন না!', 'police'),
  ],
  police_bust: [
    L('police_bust_1', 'ধরা পড়ছেন! গাড়ি থেকে নামেন!', 'police'),
  ],
};

// Pools picked when the player does something (used by Game.js reaction logic)
export const VOICE_POOLS = {
  zoneCall: { badda: 'call_badda', rampura: 'call_rampura', mirpur: 'call_mirpur', mirpur10: 'call_mirpur10', agargaon: 'call_agargaon' },
};

// Voice timing / mixing rules
export const VOICE_RULES = {
  globalCooldown: 1.6,        // seconds between any two lines (unless higher priority)
  perCategoryCooldown: 6,     // same category cannot repeat within this time
  ambientEvery: [9, 16],      // helper passenger calls roughly this often
  maxQueue: 1,
};
