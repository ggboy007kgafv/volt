import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";

type ChatMsg = { from: "bot" | "user"; text: string };

/* ------------------------------------------------------------------ */
/* Built-in product knowledge — answers stay accurate to the site copy */
/* ------------------------------------------------------------------ */
const KNOWLEDGE: { topics: string[]; keywords: string[]; answer: string }[] = [
  {
    topics: ["Flavors"],
    keywords: ["flavor", "flavour", "strawberry", "orange", "lemon", "grape", "taste", "variety", "choose", "selection", "what do you have", "which can"],
    answer:
      "Volt Strike Energy currently comes in 4 flavors, each $3.49 for a 355 ml can:\n\n• Strawberry Strike — bright, jammy strawberry rush with a clean electric finish (4.9★)\n• Orange Strike — bold sun-ripened orange heat with a sharp, zesty buzz (4.9★)\n• Lemon Strike — crisp, sour lemon voltage that cuts clean through the charge (4.8★)\n• Grape Strike — cold, heavy grape with a dark-fruit depth that lingers (4.9★)\n\nYou can browse them in the Flavors section with price, size, and ratings on every card.",
  },
  {
    topics: ["Price & size"],
    keywords: ["price", "cost", "how much", "expensive", "cheap", "money", "dollar", "$", "ml", "size", "ounce", "oz", "big", "pack", "case"],
    answer:
      "Every Volt can is $3.49 and holds 355 ml (about 12 fl oz).\n\nEach flavor is priced the same — see the Products section to flip through Strawberry, Orange, Lemon, and Grape, all with their ratings and review counts.",
  },
  {
    topics: ["Caffeine"],
    keywords: ["caffeine", "caffiene", "energy", "kick", "boost", "wake", "mg", "milligram", "strength", "how strong", "crash"],
    answer:
      "Volt is built to deliver a clean, serious energy kick — no chalky aftertaste, no heavy crash.\n\nThe exact caffeine milligram amount is still pending the final approved product label, along with the rest of the official nutrition panel. As soon as the label is locked, the exact number will be published on the Nutrition section.",
  },
  {
    topics: ["Nutrition & ingredients"],
    keywords: ["nutrition", "calorie", "sugar", "fat", "sodium", "carb", "protein", "ingredient", "sweetener", "diet", "healthy", "label", "what's inside", "vegan", "gluten", "allergen"],
    answer:
      "The full nutrition panel — calories, total fat, sodium, total carbohydrates, total sugars, protein, and caffeine — is marked as Pending Label until the approved product label is available. Final quantities will be entered directly from it.\n\nSame for ingredients: the list is being confirmed from the final product label. Reviewers describe it as clean with zero sugar crash — but official values will be published in the Nutrition & Ingredients panels the moment the label is confirmed.",
  },
  {
    topics: ["Where to buy"],
    keywords: ["buy", "order", "where", "store", "shop", "retail", "amazon", "online", "shipping", "delivery", "ship", "stockist", "location", "near", "wholesale", "distributor", "sell"],
    answer:
      "Volt is currently a showcase site — the Products section lets you explore each flavor, price ($3.49 / 355 ml), and ratings, but online ordering isn't open yet.\n\nFor retail, wholesale, or distribution inquiries, reach out through the contact form and the team will get back to you.",
  },
  {
    topics: ["Reviews"],
    keywords: ["review", "rating", "rate", "star", "testimonial", "people say", "what do people", "feedback", "score", "verified"],
    answer:
      "Volt has 1,247 verified reviews averaging 4.9★ across all flavors:\n\n• Strawberry Strike — 4.9★ (430 reviews)\n• Orange Strike — 4.9★ (290 reviews)\n• Lemon Strike — 4.8★ (240 reviews)\n• Grape Strike — 4.9★ (287 reviews)\n\nReviewers call it \"clean, no chalk, no crash\" — you can read the full quotes in the Reviews section, where each card also lets you drop your own bubble rating.",
  },
  {
    topics: ["Volt brand"],
    keywords: ["what is volt", "who are you", "about", "brand", "company", "story", "energy drink", "hello", "hi", "hey", "volt strike", "charge"],
    answer:
      "Volt Strike Energy is an energy drink built on a simple idea: power, in motion. Clean bold flavor, zero heaviness, and a charge that keeps up with you — wrapped in a look that's all green current and liquid glass.\n\nThe site is a cinematic product film — scroll the Film section to watch the full sequence play, then dive into Ingredients, About Volt, Flavors, Products, and Reviews.",
  },
];

const FALLBACK =
  "I'm still learning that one! I can help with:\n\n• Flavors & taste\n• Price & can size\n• Caffeine & energy\n• Nutrition & ingredients\n• Where to buy\n• Reviews & ratings\n\nOr tap a quick question below 👇";

const QUICK_QUESTIONS = [
  "Which flavors do you have?",
  "Price and can size?",
  "How much caffeine?",
  "Nutrition facts",
  "Where can I buy Volt?",
  "What do reviews say?",
];

function answerFor(question: string): string {
  const q = question.toLowerCase();
  let best = { score: 0, answer: FALLBACK };
  for (const item of KNOWLEDGE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (kw.length > 1 && q.includes(kw)) score += kw.length;
    }
    if (score > best.score) best = { score, answer: item.answer };
  }
  return best.answer;
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      from: "bot",
      text: "Hey 👋 I'm the Volt assistant. Ask me about flavors, price, caffeine, nutrition, where to buy, or what people are saying.",
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ask = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    setMsgs((m) => [...m, { from: "user", text }]);
    setInput("");
    setThinking(true);
    const delay = 500 + Math.min(text.length * 4, 700) + Math.random() * 350;
    timersRef.current.push(
      window.setTimeout(() => {
        setMsgs((m) => [...m, { from: "bot", text: answerFor(text) }]);
        setThinking(false);
      }, delay),
    );
  };

  return (
    <>
      {/* Floating launcher — bottom right */}
      <button
        type="button"
        className={`volt-support-fab${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close Volt assistant" : "Open Volt assistant"}
      >
        {open ? (
          <X size={24} strokeWidth={2.4} />
        ) : (
          <Sparkles size={22} strokeWidth={2.2} />
        )}
      </button>

      {open && (
        <section className="volt-support-panel" aria-label="Volt AI assistant">
          <header className="volt-support-head">
            <div className="volt-support-orb">
              <Sparkles size={17} strokeWidth={2.2} />
            </div>
            <div className="volt-support-title">
              <strong>Volt Assistant</strong>
              <span>
                <i className="volt-support-dot" aria-hidden="true" /> AI support · online
              </span>
            </div>
            <button
              type="button"
              className="volt-support-close"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </header>

          <div className="volt-support-msgs" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`volt-chat-row ${m.from}`}>
                {m.from === "bot" && <span className="volt-chat-avatar">V</span>}
                <p className="volt-chat-bubble">{m.text}</p>
              </div>
            ))}
            {thinking && (
              <div className="volt-chat-row bot">
                <span className="volt-chat-avatar">V</span>
                <p className="volt-chat-bubble volt-chat-typing" aria-label="Typing">
                  <i />
                  <i />
                  <i />
                </p>
              </div>
            )}
          </div>

          <div className="volt-support-chips" aria-label="Quick questions">
            {QUICK_QUESTIONS.map((q) => (
              <button type="button" key={q} onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>

          <form
            className="volt-support-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Volt…"
              aria-label="Message the Volt assistant"
              maxLength={500}
            />
            <button type="submit" aria-label="Send message" disabled={!input.trim() || thinking}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}
