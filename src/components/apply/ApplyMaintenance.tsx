import Link from "next/link";
import type { Locale } from "@/src/lib/i18n/config";

const copy: Record<Locale, { eyebrow: string; title: string; body: string; home: string; support: string }> = {
  en: {
    eyebrow: "Application service update",
    title: "Applications are temporarily paused",
    body: "We are upgrading our secure application service. No sensitive information is being accepted while this work is completed.",
    home: "Back to home",
    support: "Contact support",
  },
  hi: {
    eyebrow: "आवेदन सेवा अपडेट",
    title: "आवेदन अस्थायी रूप से रोके गए हैं",
    body: "हम अपनी सुरक्षित आवेदन सेवा को बेहतर बना रहे हैं। यह कार्य पूरा होने तक कोई संवेदनशील जानकारी स्वीकार नहीं की जा रही है।",
    home: "होम पर वापस जाएँ",
    support: "सहायता से संपर्क करें",
  },
  bn: {
    eyebrow: "আবেদন পরিষেবা আপডেট",
    title: "আবেদন সাময়িকভাবে বন্ধ আছে",
    body: "আমরা আমাদের নিরাপদ আবেদন পরিষেবা উন্নত করছি। কাজটি শেষ না হওয়া পর্যন্ত কোনো সংবেদনশীল তথ্য গ্রহণ করা হচ্ছে না।",
    home: "হোমে ফিরে যান",
    support: "সহায়তার সঙ্গে যোগাযোগ করুন",
  },
  te: {
    eyebrow: "దరఖాస్తు సేవ నవీకరణ",
    title: "దరఖాస్తులు తాత్కాలికంగా నిలిపివేయబడ్డాయి",
    body: "మేము మా సురక్షిత దరఖాస్తు సేవను మెరుగుపరుస్తున్నాము. పని పూర్తయ్యే వరకు సున్నితమైన సమాచారం స్వీకరించబడదు.",
    home: "హోమ్‌కు తిరిగి వెళ్లండి",
    support: "సహాయాన్ని సంప్రదించండి",
  },
  mr: {
    eyebrow: "अर्ज सेवा अद्यतन",
    title: "अर्ज तात्पुरते थांबवले आहेत",
    body: "आम्ही आमची सुरक्षित अर्ज सेवा सुधारत आहोत. हे काम पूर्ण होईपर्यंत कोणतीही संवेदनशील माहिती स्वीकारली जाणार नाही.",
    home: "मुख्यपृष्ठावर परत जा",
    support: "सहाय्याशी संपर्क साधा",
  },
  ta: {
    eyebrow: "விண்ணப்பச் சேவை புதுப்பிப்பு",
    title: "விண்ணப்பங்கள் தற்காலிகமாக நிறுத்தப்பட்டுள்ளன",
    body: "எங்கள் பாதுகாப்பான விண்ணப்பச் சேவையை மேம்படுத்துகிறோம். பணி முடியும் வரை முக்கியமான தகவல்கள் ஏற்கப்படாது.",
    home: "முகப்புக்குத் திரும்பு",
    support: "ஆதரவைத் தொடர்புகொள்",
  },
  kn: {
    eyebrow: "ಅರ್ಜಿ ಸೇವೆ ನವೀಕರಣ",
    title: "ಅರ್ಜಿಗಳನ್ನು ತಾತ್ಕಾಲಿಕವಾಗಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ",
    body: "ನಾವು ನಮ್ಮ ಸುರಕ್ಷಿತ ಅರ್ಜಿ ಸೇವೆಯನ್ನು ಸುಧಾರಿಸುತ್ತಿದ್ದೇವೆ. ಕೆಲಸ ಪೂರ್ಣಗೊಳ್ಳುವವರೆಗೆ ಸೂಕ್ಷ್ಮ ಮಾಹಿತಿಯನ್ನು ಸ್ವೀಕರಿಸಲಾಗುವುದಿಲ್ಲ.",
    home: "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    support: "ಸಹಾಯವನ್ನು ಸಂಪರ್ಕಿಸಿ",
  },
  ml: {
    eyebrow: "അപേക്ഷാ സേവന അപ്ഡേറ്റ്",
    title: "അപേക്ഷകൾ താൽക്കാലികമായി നിർത്തിയിരിക്കുന്നു",
    body: "ഞങ്ങളുടെ സുരക്ഷിത അപേക്ഷാ സേവനം മെച്ചപ്പെടുത്തുകയാണ്. പ്രവർത്തനം പൂർത്തിയാകുന്നതുവരെ സ്വകാര്യ വിവരങ്ങൾ സ്വീകരിക്കില്ല.",
    home: "ഹോമിലേക്ക് മടങ്ങുക",
    support: "സഹായവുമായി ബന്ധപ്പെടുക",
  },
};

export function ApplyMaintenance({ locale }: { locale: Locale }) {
  const text = copy[locale];
  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-nt-slate-200 bg-white px-6 py-12 text-center shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:px-10 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c2410c]">
        {text.eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-nt-slate-900 sm:text-4xl">
        {text.title}
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-nt-slate-600">
        {text.body}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#c2410c] px-5 py-3 font-semibold text-white outline-offset-4 hover:bg-[#9a3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c2410c]"
        >
          {text.home}
        </Link>
        <a
          href="mailto:support@navdhan.app"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-nt-slate-300 bg-white px-5 py-3 font-semibold text-nt-slate-900 outline-offset-4 hover:bg-nt-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-slate-900"
        >
          {text.support}
        </a>
      </div>
    </section>
  );
}
