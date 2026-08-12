"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { MathText } from "./math-text";

/** Grouped LaTeX cheatsheet — each row is (title, latex-source). The source
 *  is rendered via MathText inline so admins see the actual output next to
 *  the syntax they'd type. Groups roughly ordered from most-common to
 *  advanced so the top of the modal covers the 80% case. */
const GROUPS: { title: string; items: { label: string; src: string }[] }[] = [
  {
    title: "Asosiy sintaksis",
    items: [
      { label: "Inline formula", src: "Matn ichida $x^2 + 1$" },
      { label: "Blok formula (alohida qator)", src: "$$\\int_0^1 x^2\\,dx$$" },
      { label: "Daraja (yuqori indeks)", src: "$x^2$, $a^{n+1}$" },
      { label: "Pastki indeks", src: "$x_1$, $a_{ij}$" },
      { label: "Kasr", src: "$\\frac{a}{b}$" },
      { label: "Ildiz", src: "$\\sqrt{x}$, $\\sqrt[3]{x}$" },
    ],
  },
  {
    title: "Belgilar va amallar",
    items: [
      { label: "Ko'paytirish", src: "$a \\cdot b$, $a \\times b$" },
      { label: "Bo'lish", src: "$a \\div b$" },
      { label: "Plyus-minus", src: "$x = \\pm 5$" },
      { label: "Kichikroq/katta yoki teng", src: "$a \\leq b$, $a \\geq b$" },
      { label: "Teng emas / taxminan", src: "$a \\neq b$, $\\pi \\approx 3.14$" },
      { label: "Cheksizlik", src: "$\\infty$" },
    ],
  },
  {
    title: "Grek harflari",
    items: [
      { label: "Kichik alifbo", src: "$\\alpha, \\beta, \\gamma, \\delta$" },
      { label: "Ko'p ishlatiladigan", src: "$\\pi, \\theta, \\phi, \\omega$" },
      { label: "Katta alifbo", src: "$\\Delta, \\Sigma, \\Pi, \\Omega$" },
      { label: "Boshqa", src: "$\\lambda, \\mu, \\sigma, \\epsilon$" },
    ],
  },
  {
    title: "Trigonometriya va logarifm",
    items: [
      { label: "Sinus, kosinus, tangens", src: "$\\sin x, \\cos x, \\tan x$" },
      { label: "Kotangens, sekans", src: "$\\cot x, \\sec x$" },
      { label: "Teskari funksiyalar", src: "$\\arcsin x, \\arctan x$" },
      { label: "Logarifm", src: "$\\log x, \\ln x, \\log_2 x$" },
    ],
  },
  {
    title: "Integrallar va limitlar",
    items: [
      { label: "Aniq integral", src: "$$\\int_a^b f(x)\\,dx$$" },
      { label: "Yig'indi", src: "$$\\sum_{i=1}^n i^2$$" },
      { label: "Ko'paytma", src: "$$\\prod_{i=1}^n a_i$$" },
      { label: "Limit", src: "$$\\lim_{x \\to \\infty} \\frac{1}{x}$$" },
      { label: "Hosila", src: "$f'(x), \\frac{d}{dx} f$" },
    ],
  },
  {
    title: "To'plamlar va mantiq",
    items: [
      { label: "A'zolik", src: "$x \\in A$, $y \\notin B$" },
      { label: "Qism to'plam", src: "$A \\subset B$, $A \\subseteq B$" },
      { label: "Birlashma / kesishma", src: "$A \\cup B$, $A \\cap B$" },
      { label: "Bo'sh to'plam", src: "$\\emptyset$" },
      { label: "Barcha uchun / mavjud", src: "$\\forall x, \\exists y$" },
    ],
  },
  {
    title: "Matritsa va ko'p qatorli",
    items: [
      {
        label: "2×2 matritsa",
        src: "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$",
      },
      {
        label: "Aniqlovchi",
        src: "$$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc$$",
      },
    ],
  },
  {
    title: "Ehtiyot bo'ling",
    items: [
      { label: "$ belgisining o'zi kerak bo'lsa", src: "Narx \\$100" },
      { label: "Foiz belgisi", src: "50\\%" },
      { label: "Katta qavs", src: "$\\left( \\frac{a}{b} \\right)$" },
      { label: "Probel formula ichida", src: "$a\\,b$ yoki $a\\ b$" },
    ],
  },
];

export function FormulaHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1">
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Formula qo'llanmasi</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formula (LaTeX) qo'llanmasi</DialogTitle>
          <DialogDescription>
            Matn ichida formulani <code>$...$</code> (kichik) yoki
            <code> $$...$$ </code> (alohida qator) ichiga oling. Har qator
            chapida — LaTeX kodi, o'ngida — real ko'rinishi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {GROUPS.map((g) => (
            <section key={g.title} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
                {g.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-x-4 gap-y-2 text-sm">
                {g.items.map((item, i) => (
                  <FormulaRow key={i} label={item.label} src={item.src} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormulaRow({ label, src }: { label: string; src: string }) {
  return (
    <div className="rounded-md border p-2 space-y-1 bg-muted/20">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <code className="block text-[11px] font-mono break-all leading-snug">
        {src}
      </code>
      <div className="border-t pt-1">
        <MathText as="div" text={src} className="text-sm" />
      </div>
    </div>
  );
}
