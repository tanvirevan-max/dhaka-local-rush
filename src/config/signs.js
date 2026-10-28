// Sign atlas definitions. All text is fictional / generic (no real brands).
// kind: 'shop' | 'ad' | 'road' | 'gate'
// Each entry is drawn into one cell (256x64) of a single atlas texture (one draw call for all signs).
export const SIGN_DEFS = [
  // --- shops (0-15)
  { t: 'আল-আমিন ফার্মেসি', bg: '#1f8a4c', fg: '#ffffff', kind: 'shop' },
  { t: 'রহমান জেনারেল স্টোর', bg: '#c0392b', fg: '#fff3c4', kind: 'shop' },
  { t: 'বিসমিল্লাহ হোটেল', bg: '#f1c40f', fg: '#7b1010', kind: 'shop' },
  { t: 'ঢাকা মিষ্টান্ন ভান্ডার', bg: '#e67e22', fg: '#ffffff', kind: 'shop' },
  { t: 'মা টেলিকম ও ফ্লেক্সিলোড', bg: '#2980b9', fg: '#ffffff', kind: 'shop' },
  { t: 'নিউ ফ্যাশন টেইলার্স', bg: '#8e44ad', fg: '#ffe9ff', kind: 'shop' },
  { t: 'সততা বই ঘর', bg: '#ecf0f1', fg: '#1b4f72', kind: 'shop' },
  { t: 'চা-নাস্তা • ভর্তা ঘর', bg: '#16a085', fg: '#fffbe0', kind: 'shop' },
  { t: 'জনতা ক্লিনিক ও ডায়াগনস্টিক', bg: '#ffffff', fg: '#c0392b', kind: 'shop' },
  { t: 'তাজা ফল ও সবজি', bg: '#27ae60', fg: '#fff9c4', kind: 'shop' },
  { t: 'ইসলামিয়া ইলেকট্রনিক্স', bg: '#34495e', fg: '#f9e79f', kind: 'shop' },
  { t: 'কাচ্চি ভাই বিরিয়ানি', bg: '#a93226', fg: '#ffeaa7', kind: 'shop' },
  { t: 'সুমন মোবাইল গ্যালারি', bg: '#1abc9c', fg: '#0b2b3a', kind: 'shop' },
  { t: 'শাহী বেকারি', bg: '#f5cba7', fg: '#6e2c00', kind: 'shop' },
  { t: 'তাঁতঘর শাড়ি কালেকশন', bg: '#d81b60', fg: '#fff0f6', kind: 'shop' },
  { t: 'বাংলা হার্ডওয়্যার', bg: '#455a64', fg: '#ffd54f', kind: 'shop' },
  // --- ads / billboards (16-21)
  { t: 'ঝটপট বার্গার — সেরা স্বাদ!', bg: '#ffb300', fg: '#b71c1c', kind: 'ad' },
  { t: 'ঝড়-গতির ইন্টারনেট ৫০০ টাকায়', bg: '#1565c0', fg: '#ffffff', kind: 'ad' },
  { t: 'নিরাপদ সড়ক চাই', bg: '#2e7d32', fg: '#ffffff', kind: 'ad' },
  { t: 'টু-লেট • ফ্ল্যাট ভাড়া হবে', bg: '#fdd835', fg: '#000000', kind: 'ad' },
  { t: 'সবুজ ঢাকা, পরিচ্ছন্ন ঢাকা', bg: '#00897b', fg: '#ffffff', kind: 'ad' },
  { t: 'ক্যাম্পাস কোচিং — ভর্তি চলছে', bg: '#6a1b9a', fg: '#fff59d', kind: 'ad' },
  // --- road signs (22-33)
  { t: 'মিরপুর', bg: '#0b6b3a', fg: '#ffffff', kind: 'road', arrow: 'right' },
  { t: 'আগারগাঁও', bg: '#0b6b3a', fg: '#ffffff', kind: 'road', arrow: 'right' },
  { t: 'বাড্ডা • গুলশান', bg: '#0b6b3a', fg: '#ffffff', kind: 'road', arrow: 'left' },
  { t: 'রামপুরা', bg: '#0b6b3a', fg: '#ffffff', kind: 'road', arrow: 'right' },
  { t: 'মিরপুর-১০ গোলচত্বর', bg: '#0b6b3a', fg: '#ffffff', kind: 'road', arrow: 'right' },
  { t: 'বাস স্টপ  BUS STOP', bg: '#1565c0', fg: '#ffffff', kind: 'road' },
  { t: 'ফুটওভার ব্রিজ', bg: '#1565c0', fg: '#ffffff', kind: 'road' },
  { t: 'গতিসীমা ৪০ কিমি', bg: '#ffffff', fg: '#c62828', kind: 'road', border: '#c62828' },
  { t: 'ধীরে চলুন • স্কুল', bg: '#fdd835', fg: '#111111', kind: 'road', border: '#111111' },
  { t: 'মেট্রোরেল', bg: '#00695c', fg: '#ffffff', kind: 'road' },
  { t: 'আগারগাঁও মেট্রো স্টেশন', bg: '#00695c', fg: '#ffffff', kind: 'road' },
  { t: 'মিরপুর-১০ মেট্রো স্টেশন', bg: '#00695c', fg: '#ffffff', kind: 'road' },
  // --- zone gates (34-38)
  { t: 'বাড্ডা  •  BADDA', bg: '#0d47a1', fg: '#ffd600', kind: 'gate' },
  { t: 'রামপুরা  •  RAMPURA', bg: '#b71c1c', fg: '#ffe082', kind: 'gate' },
  { t: 'মিরপুর  •  MIRPUR', bg: '#1b5e20', fg: '#fff59d', kind: 'gate' },
  { t: 'মিরপুর ১০  •  MIRPUR 10', bg: '#4a148c', fg: '#ffe57f', kind: 'gate' },
  { t: 'আগারগাঁও  •  AGARGAON', bg: '#004d40', fg: '#ffffff', kind: 'gate' },
  // --- landmarks (39-43)
  { t: 'মিরপুর স্টেডিয়াম', bg: '#8e1b1b', fg: '#fff3c4', kind: 'gate' },
  { t: 'আদর্শ উচ্চ বিদ্যালয়', bg: '#1a4f8b', fg: '#ffffff', kind: 'gate' },
  { t: 'সরকারি অফিস ভবন', bg: '#2e5339', fg: '#f4f1de', kind: 'gate' },
  { t: 'সড়ক দুর্ঘটনা রোধ করুন', bg: '#c62828', fg: '#ffffff', kind: 'ad' },
  { t: 'ঈদ মোবারক', bg: '#00796b', fg: '#ffeb3b', kind: 'ad' },
];

export const SIGN = {
  SHOPS: Array.from({ length: 16 }, (_, i) => i),
  ADS: [16, 17, 18, 19, 20, 21],
  TO_MIRPUR: 22, TO_AGARGAON: 23, TO_BADDA: 24, TO_RAMPURA: 25, MIRPUR10: 26,
  BUS_STOP: 27, FOOTBRIDGE: 28, SPEED: 29, SCHOOL: 30, METRO: 31, METRO_AGARGAON: 32, METRO_MIRPUR10: 33,
  GATES: [34, 35, 36, 37, 38],
  STADIUM: 39, SCHOOL_GATE: 40, GOVT: 41, SAFE_ROAD: 42, EID: 43,
};
