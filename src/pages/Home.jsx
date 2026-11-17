import { Link } from "react-router-dom";
import {
  Search,
  PhoneCall,
  UserPlus,
  ShieldCheck,
  Zap,
  HeartHandshake,
} from "lucide-react";
import BloodGroupPicker from "../components/BloodGroupPicker";
import StatCounter from "../components/StatCounter";

const steps = [
  {
    icon: Search,
    title: "Search",
    text: "Filter donors by blood group and location to find a match near you.",
  },
  {
    icon: PhoneCall,
    title: "Connect",
    text: "Call or message a donor directly and arrange the donation.",
  },
  {
    icon: UserPlus,
    title: "Join",
    text: "Register as a donor in a few minutes and be ready when someone needs you.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Trusted profiles",
    text: "Donor and blood bank details are managed and kept up to date by our team.",
  },
  {
    icon: Zap,
    title: "Fast matching",
    text: "Urgent requests are highlighted so help reaches patients sooner.",
  },
  {
    icon: HeartHandshake,
    title: "Community powered",
    text: "Donors, hospitals, and blood banks working together on one platform.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-red-dark via-brand-red to-brand-blue text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
              Donate Blood. Save Lives.
            </p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
              One drop of blood can give someone a second chance.
            </h1>
            <p className="mt-4 max-w-lg text-red-50">
              RoktoLagbe connects blood donors, patients, and blood banks across
              Bangladesh, so help is never far away.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/donors"
                className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-red transition hover:bg-red-50"
              >
                Find a Donor
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-white/70 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Become a Donor
              </Link>
            </div>
          </div>

          <BloodGroupPicker />
        </div>
      </section>

      {/* Stats (sample numbers: replace with real data from the API later) */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 rounded-2xl bg-white p-8 shadow-sm md:grid-cols-4">
          <StatCounter end={500} suffix="+" label="Registered Donors" />
          <StatCounter end={120} suffix="+" label="Requests Fulfilled" />
          <StatCounter end={25} suffix="+" label="Partner Blood Banks" />
          <StatCounter end={64} label="Districts" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold text-brand-blue">How it works</h2>
        <p className="mt-2 text-center text-gray-500">Three simple steps</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-brand-red">
                <Icon size={26} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-800">
                {i + 1}. {title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why RoktoLagbe */}
      <section className="bg-blue-50/60 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-brand-blue">
            Why RoktoLagbe?
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-white p-6 shadow-sm">
                <Icon className="text-brand-blue" size={28} />
                <h3 className="mt-3 text-lg font-semibold text-gray-800">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-brand-blue-dark px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-bold">Ready to save a life?</h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">
            Join as a donor today, or post a request if someone needs blood urgently.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="rounded-lg bg-brand-red px-6 py-3 font-semibold transition hover:bg-brand-red-dark"
            >
              Become a Donor
            </Link>
            <Link
              to="/requests"
              className="rounded-lg border border-white/60 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              View Blood Requests
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}